import type { LiveServerMessage } from '@infirmier/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeLiveStt, fakeFileStt } from '../testing/fake-live';
import { LIVE_CLOSE, LiveDictation } from './live-dictation';

function setup(opts: { maxSeconds?: number; failAfterBytes?: number } = {}) {
  const live = new FakeLiveStt(opts.failAfterBytes ?? null);
  const stt = fakeFileStt();
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
  });
  dictation.start();
  return { dictation, live, stt, sent, closes, logs };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe('LiveDictation', () => {
  it('au-delà de la durée max : arrêt automatique, le surplus est ignoré', async () => {
    const { dictation, stt, sent, closes } = setup({ maxSeconds: 1 });
    dictation.onAudio(new Uint8Array(40_000));
    dictation.onAudio(new Uint8Array(40_000)); // 1 s = 48 000 octets
    dictation.onAudio(new Uint8Array(40_000));
    await settle();
    expect(stt.requests[0]?.audio.byteLength).toBe(44 + 48_000);
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

  it('une ligne de log par dictée, sans texte ni clé', async () => {
    const { dictation, logs } = setup({ failAfterBytes: 2 });
    dictation.onAudio(new Uint8Array(4800));
    await dictation.stop('arrêt');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^\[live\] 0\.1 s de son \(4800 octets\)/);
    expect(logs[0]).toMatch(/en panne/);
    expect(logs[0]).not.toMatch(/sk-test-123/);
    expect(logs[0]).not.toMatch(/Texte final/);
  });

  it('un second « stop » ou du son après l’arrêt sont sans effet', async () => {
    const { dictation, stt, sent } = setup();
    dictation.onAudio(new Uint8Array(4800));
    const first = dictation.stop('arrêt');
    dictation.onAudio(new Uint8Array(4800));
    await dictation.stop('arrêt');
    await first;
    expect(stt.requests).toHaveLength(1);
    expect(stt.requests[0]?.audio.byteLength).toBe(44 + 4800);
    expect(sent.filter((m) => m.type === 'final')).toHaveLength(1);
  });
});
