import type { LiveServerMessage } from '@infirmier/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesOf, frames, pcm, quiet, voice } from '../testing/fake-audio';
import { type FakeFileSttOptions, FakeLiveStt, fakeFileStt } from '../testing/fake-live';
import { LIVE_CLOSE, LiveDictation } from './live-dictation';
import { contextPrompt } from './segment-finalizer';

function setup(
  opts: {
    maxSeconds?: number;
    live?: FakeLiveStt;
    stt?: FakeFileSttOptions;
    segmentsTimeoutMs?: number;
  } = {},
) {
  const live = opts.live ?? new FakeLiveStt();
  const stt = fakeFileStt(opts.stt);
  const sent: LiveServerMessage[] = [];
  const closes: number[] = [];
  const logs: string[] = [];
  const dictation = new LiveDictation({
    live,
    stt,
    prompt: 'Transmissions infirmières.',
    send: (m) => sent.push(m),
    close: (code) => closes.push(code),
    log: (l) => logs.push(l),
    maxSeconds: opts.maxSeconds,
    // Ces tests portent sur le service, pas sur le seuil : segments courts de 1,5 s au moins.
    segmentation: { minSegmentMs: 1_500 },
    segmentsTimeoutMs: opts.segmentsTimeoutMs,
    retryDelayMs: 0,
  });
  dictation.start();
  const feed = (audio: Uint8Array) => {
    for (const f of frames(audio)) dictation.onAudio(f);
  };
  return { dictation, live, stt, sent, closes, logs, feed };
}

/** Deux phrases séparées d'une pause d'1 s : segment 0 = 2,7 s, segment 1 = 2,6 s. */
const TWO_SENTENCES = pcm(voice(2000), quiet(1000), voice(2000), quiet(300));
const SEG0 = bytesOf(2700);
const SEG1 = bytesOf(2600);

const settle = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const of = <T extends LiveServerMessage['type']>(sent: LiveServerMessage[], type: T) =>
  sent.filter((m): m is Extract<LiveServerMessage, { type: T }> => m.type === type);

afterEach(() => {
  vi.useRealTimers();
});

describe('LiveDictation : segments', () => {
  it('provisoire par segment, définitif dès la coupure, final = segments bout à bout', async () => {
    const { feed, dictation, sent, closes, stt, live } = setup();
    feed(TWO_SENTENCES);
    await settle();
    // Le segment 0 est définitif PENDANT la dictée (avant l'arrêt).
    expect(of(sent, 'segment')).toEqual([
      { type: 'segment', segment: 0, text: `[${SEG0} octets]`, engine: 'fake-stt' },
    ]);
    await dictation.stop('arrêt');
    const deltas = of(sent, 'delta');
    expect(deltas.filter((d) => d.segment === 0)).toHaveLength(27);
    expect(deltas.filter((d) => d.segment === 1)).toHaveLength(26);
    expect(of(sent, 'segment').map((s) => s.segment)).toEqual([0, 1]);
    expect(sent.at(-1)).toEqual({
      type: 'final',
      text: `[${SEG0} octets] [${SEG1} octets]`,
      durationSec: 5.3,
      engine: 'fake-stt',
    });
    expect(closes).toEqual([LIVE_CLOSE.final]);
    expect(live.sessions[0]).toMatchObject({ cuts: 1, finished: true, closed: true });
    expect(stt.requests.map((r) => r.audio.byteLength - 44)).toEqual([SEG0, SEG1]);
  });

  it('contexte : texte qui précède, définitif s’il est arrivé, sinon provisoire', async () => {
    const slow = setup({ stt: { delayMs: (call) => (call === 0 ? 30 : 0) } });
    slow.feed(TWO_SENTENCES);
    await slow.dictation.stop('arrêt');
    const provisional0 = Array.from({ length: 27 }, (_, i) => `mot${i + 1}`).join(' ');
    expect(slow.stt.requests[1]?.prompt).toBe(`Transmissions infirmières.\n\n${provisional0}`);

    const fast = setup();
    fast.feed(pcm(voice(2000), quiet(1000)));
    await settle();
    fast.feed(pcm(voice(2000)));
    await fast.dictation.stop('arrêt');
    expect(fast.stt.requests[1]?.prompt).toBe(`Transmissions infirmières.\n\n[${SEG0} octets]`);
  });

  it('finalisation dans le désordre : `segment` dans l’ordre d’arrivée, `final` dans l’ordre', async () => {
    const { feed, dictation, sent } = setup({ stt: { delayMs: (call) => (call === 0 ? 40 : 0) } });
    feed(TWO_SENTENCES);
    await dictation.stop('arrêt');
    expect(of(sent, 'segment').map((s) => s.segment)).toEqual([1, 0]);
    expect(of(sent, 'final')[0]?.text).toBe(`[${SEG0} octets] [${SEG1} octets]`);
    expect(sent.findIndex((m) => m.type === 'final')).toBe(sent.length - 1);
  });

  it('échec d’un segment : une retentative, puis repli sur son texte provisoire', async () => {
    const retried = setup({ stt: { fail: (call) => call === 0 } });
    retried.feed(TWO_SENTENCES);
    await retried.dictation.stop('arrêt');
    expect(retried.stt.requests).toHaveLength(3);
    expect(of(retried.sent, 'segment').find((m) => m.segment === 0)?.engine).toBe('fake-stt');

    const failing = setup({ stt: { fail: (_call, req) => req.audio.byteLength - 44 === SEG0 } });
    failing.feed(TWO_SENTENCES);
    await failing.dictation.stop('arrêt');
    const provisional = Array.from({ length: 27 }, (_, i) => `mot${i + 1}`).join(' ');
    expect(of(failing.sent, 'segment').find((s) => s.segment === 0)).toEqual({
      type: 'segment',
      segment: 0,
      text: provisional,
      engine: 'fake-live',
    });
    expect(of(failing.sent, 'final')[0]).toMatchObject({
      text: `${provisional} [${SEG1} octets]`,
      engine: 'fake-live + fake-stt',
    });
    expect(failing.logs[0]).toMatch(/1 repli\(s\) sur le provisoire/);
  });

  it('delta en retard : bon segment tant qu’il n’est pas définitif, ignoré ensuite', async () => {
    const slow = setup({ live: new FakeLiveStt(null, true), stt: { delayMs: () => 20 } });
    slow.feed(TWO_SENTENCES);
    await slow.dictation.stop('arrêt');
    expect(of(slow.sent, 'delta')).toContainEqual({ type: 'delta', segment: 0, text: ' (retard)' });

    const fast = setup({ live: new FakeLiveStt(null, true) });
    fast.feed(TWO_SENTENCES);
    await fast.dictation.stop('arrêt');
    expect(of(fast.sent, 'delta').some((d) => d.text === ' (retard)')).toBe(false);
    const seg0 = fast.sent.findIndex((m) => m.type === 'segment' && m.segment === 0);
    expect(fast.sent.slice(seg0).some((m) => m.type === 'delta' && m.segment === 0)).toBe(false);
  });

  it('à l’arrêt, un segment trop lent prend son provisoire ; son résultat tardif est ignoré', async () => {
    const { feed, dictation, sent } = setup({
      stt: { delayMs: (call) => (call === 1 ? 200 : 0) },
      segmentsTimeoutMs: 30,
    });
    feed(TWO_SENTENCES);
    await dictation.stop('arrêt');
    await settle(250);
    const seg1 = of(sent, 'segment').filter((s) => s.segment === 1);
    expect(seg1).toHaveLength(1);
    expect(seg1[0]?.engine).toBe('fake-live');
    expect(of(sent, 'final')[0]?.text).toMatch(new RegExp(`^\\[${SEG0} octets\\] mot28 `));
  });

  it('dernier segment sans parole ni provisoire : pas de transcription (rien d’inventé)', async () => {
    const { feed, dictation, sent, stt } = setup({ live: new FakeLiveStt(2) });
    feed(pcm(voice(2000), quiet(1500)));
    await dictation.stop('arrêt');
    expect(stt.requests).toHaveLength(1);
    expect(of(sent, 'segment').sort((a, b) => a.segment - b.segment)).toEqual([
      { type: 'segment', segment: 0, text: `[${SEG0} octets]`, engine: 'fake-stt' },
      { type: 'segment', segment: 1, text: '', engine: 'silence' },
    ]);
    expect(of(sent, 'final')[0]).toMatchObject({ text: `[${SEG0} octets]`, engine: 'fake-stt' });
  });

  it('contextPrompt : fin du texte précédent, coupée sur un mot', () => {
    expect(contextPrompt('Base.', '')).toBe('Base.');
    expect(contextPrompt('Base.', ' Chambre 12. ')).toBe('Base.\n\nChambre 12.');
    const long = `${'mot '.repeat(300)}fin`;
    const out = contextPrompt('Base.', long, 50);
    expect(out.startsWith('Base.\n\n…mot')).toBe(true);
    expect(out.endsWith('fin')).toBe(true);
    expect(out.length).toBeLessThanOrEqual('Base.\n\n…'.length + 50);
  });
});

describe('LiveDictation : limites', () => {
  it('au-delà de la durée max : arrêt automatique, le surplus est ignoré', async () => {
    const { dictation, stt, sent, closes } = setup({ maxSeconds: 1 });
    const audio = pcm(voice(1500));
    dictation.onAudio(audio.subarray(0, 40_000));
    dictation.onAudio(audio.subarray(40_000));
    await settle();
    expect(stt.requests.map((r) => r.audio.byteLength)).toEqual([44 + 48_000]);
    expect(sent.at(-1)).toMatchObject({ type: 'final', durationSec: 1 });
    expect(closes).toEqual([LIVE_CLOSE.final]);
  });

  it('connexion restée ouverte sans son : arrêtée après la durée max + marge', async () => {
    vi.useFakeTimers();
    const { sent, closes, stt } = setup({ maxSeconds: 1 });
    await vi.advanceTimersByTimeAsync(16_000);
    expect(sent.at(-1)).toEqual({ type: 'error', message: 'Aucun son reçu.' });
    expect(closes).toEqual([LIVE_CLOSE.error]);
    expect(stt.requests).toHaveLength(0);
  });

  it('une ligne de log par dictée : segments et latences, sans texte ni clé', async () => {
    const { feed, dictation, logs } = setup({ live: new FakeLiveStt(4800) });
    feed(TWO_SENTENCES);
    await dictation.stop('arrêt');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^\[live\] 5\.3 s de son \(254400 octets\)/);
    expect(logs[0]).toMatch(/2 segments \(pause 1, max 0, end 1 ; 2\.7\/2\.6 s\)/);
    expect(logs[0]).toMatch(/définitif après la coupure : \d\.\d\/\d\.\d s, médiane/);
    expect(logs[0]).toMatch(/en panne/);
    expect(logs[0]).not.toMatch(/sk-test-123|octets\]|mot1/);
  });

  it('un second « stop » ou du son après l’arrêt sont sans effet', async () => {
    const { dictation, stt, sent } = setup();
    dictation.onAudio(pcm(voice(500)));
    const first = dictation.stop('arrêt');
    dictation.onAudio(pcm(voice(500)));
    await dictation.stop('arrêt');
    await first;
    expect(stt.requests.map((r) => r.audio.byteLength)).toEqual([44 + bytesOf(500)]);
    expect(of(sent, 'final')).toHaveLength(1);
  });
});
