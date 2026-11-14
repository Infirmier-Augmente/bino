import { describe, expect, it } from 'vitest';
import { type PcmSegment, PcmSegmenter, type SegmenterEvent } from './segmenter';

const SR = 24_000;
const samples = (ms: number) => Math.round((SR * ms) / 1000);

/** « Voix » : sinusoïde à -15 dBFS environ. */
function voice(ms: number, amplitude = 8000): number[] {
  return Array.from({ length: samples(ms) }, (_, i) =>
    Math.round(amplitude * Math.sin((2 * Math.PI * 220 * i) / SR)),
  );
}

/** Silence numérique, ou bruit de fond pseudo-aléatoire (déterministe) d'amplitude donnée. */
function quiet(ms: number, amplitude = 0): number[] {
  let seed = 42;
  return Array.from({ length: samples(ms) }, () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return Math.round(((seed / 2_147_483_648) * 2 - 1) * amplitude);
  });
}

function pcm(...parts: number[][]): Uint8Array {
  const all = parts.flat();
  const out = new Uint8Array(all.length * 2);
  const view = new DataView(out.buffer);
  all.forEach((v, i) => {
    view.setInt16(i * 2, v, true);
  });
  return out;
}

/** Donne le son par morceaux (tailles cycliques, impaires comprises), puis termine. */
function events(audio: Uint8Array, sizes: readonly number[] = [4800]): SegmenterEvent[] {
  const seg = new PcmSegmenter();
  const out: SegmenterEvent[] = [];
  let i = 0;
  let k = 0;
  while (i < audio.byteLength) {
    const size = sizes[k++ % sizes.length] ?? 4800;
    out.push(...seg.push(audio.subarray(i, i + size)));
    i += size;
  }
  const last = seg.flush();
  if (last) out.push({ kind: 'segment', segment: last });
  return out;
}

const run = (audio: Uint8Array, sizes?: readonly number[]): PcmSegment[] =>
  events(audio, sizes).flatMap((e) => (e.kind === 'segment' ? [e.segment] : []));

function joined(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

const summary = (segments: readonly PcmSegment[]) =>
  segments.map((s) => ({
    index: s.index,
    start: s.startSample,
    end: s.endSample,
    reason: s.reason,
    hasSpeech: s.hasSpeech,
  }));

describe('PcmSegmenter', () => {
  it('coupe après 700 ms de silence, à la fin de la pause détectée', () => {
    const audio = pcm(quiet(500), voice(2000), quiet(1000), voice(2000), quiet(300));
    expect(summary(run(audio))).toEqual([
      { index: 0, start: 0, end: samples(3200), reason: 'pause', hasSpeech: true },
      { index: 1, start: samples(3200), end: samples(5800), reason: 'end', hasSpeech: true },
    ]);
  });

  it('ne coupe pas un segment de moins de 1,5 s (hésitation)', () => {
    const audio = pcm(voice(300), quiet(900), voice(2000), quiet(1000), voice(500));
    const segments = run(audio);
    expect(segments.map((s) => [s.endSample, s.reason])).toEqual([
      [samples(3900), 'pause'],
      [samples(4700), 'end'],
    ]);
  });

  it('près de 15 s sans pause : coupe au premier blanc entre deux mots (décidé sur le moment)', () => {
    const audio = pcm(
      voice(13_500),
      voice(100, 2000), // baisse de voix trop courte pour couper
      voice(400),
      quiet(200), // 14,0 → 14,2 s : blanc entre deux mots
      voice(3000),
    );
    const segments = run(audio);
    expect(summary(segments)).toEqual([
      { index: 0, start: 0, end: samples(14_120), reason: 'max', hasSpeech: true },
      { index: 1, start: samples(14_120), end: samples(17_200), reason: 'end', hasSpeech: true },
    ]);
    expect(segments[0]?.decidedAtSample).toBe(segments[0]?.endSample);
  });

  it('15 s sans aucun blanc : coupe au milieu du passage le plus calme des 2 dernières s', () => {
    const audio = pcm(
      voice(13_500),
      voice(100, 2000), // baisse de voix, moins calme que le blanc qui suit
      voice(400),
      quiet(100), // 14,0 → 14,1 s : le plus calme, mais trop court pour couper sur le moment
      voice(3000),
    );
    const segments = run(audio);
    expect(summary(segments)).toEqual([
      { index: 0, start: 0, end: samples(14_050), reason: 'max', hasSpeech: true },
      { index: 1, start: samples(14_050), end: samples(17_100), reason: 'end', hasSpeech: true },
    ]);
    expect(segments[0]?.decidedAtSample).toBe(samples(15_000));
  });

  it('bruit de fond : seuil adaptatif, les pauses sont trouvées quand même', () => {
    const noisy = (ms: number) => quiet(ms, 300); // ≈ -45 dBFS
    const loud = (ms: number) => quiet(ms, 1500); // ≈ -31 dBFS, au-dessus du plancher absolu
    expect(
      run(pcm(noisy(400), voice(2000), noisy(1000), voice(1000))).map((s) => s.reason),
    ).toEqual(['pause', 'end']);
    expect(run(pcm(loud(400), voice(2000), loud(1000), voice(1000))).map((s) => s.reason)).toEqual([
      'pause',
      'end',
    ]);
  });

  it('pas de parole : pas de coupure à une pause, seulement à 15 s (segment sans parole)', () => {
    const segments = run(pcm(quiet(16_000)));
    expect(segments.map((s) => [s.reason, s.hasSpeech])).toEqual([
      ['max', false],
      ['end', false],
    ]);
  });

  it('aucun échantillon perdu ni répété, quelle que soit la taille des morceaux', () => {
    const audio = pcm(
      quiet(300),
      voice(1800),
      quiet(800),
      voice(16_000),
      quiet(900),
      voice(700),
      quiet(200),
    );
    const reference = run(audio);
    expect(reference.length).toBeGreaterThanOrEqual(3);
    for (const sizes of [[1], [3, 7001, 2], [960], [33_333, 5]]) {
      const segments = run(audio, sizes);
      expect(summary(segments)).toEqual(summary(reference));
      expect(joined(segments.map((s) => s.pcm))).toEqual(audio);
      segments.forEach((s, i) => {
        expect(s.pcm.byteLength).toBe((s.endSample - s.startSample) * 2);
        if (i > 0) expect(s.startSample).toBe(segments[i - 1]?.endSample);
      });
    }
  });

  it('flux : le son relayé tel quel, coupé au moment de chaque décision', () => {
    // 1er segment > minSegmentMs (3 s) pour que la pause le termine.
    const audio = pcm(quiet(300), voice(3200), quiet(800), voice(16_000), quiet(300));
    for (const sizes of [[4800], [7, 1001]]) {
      let relayed = 0;
      const decided: number[] = [];
      const parts: Uint8Array[] = [];
      for (const e of events(audio, sizes)) {
        if (e.kind === 'audio') {
          relayed += e.pcm.byteLength / 2;
          parts.push(e.pcm);
        } else {
          expect(e.segment.decidedAtSample).toBe(relayed);
          expect(e.segment.decidedAtSample).toBeGreaterThanOrEqual(e.segment.endSample);
          decided.push(e.segment.decidedAtSample - e.segment.endSample);
        }
      }
      // pause : décidée à la coupure ; max : un peu après (coupure dans le passé) ; fin.
      expect(decided[0]).toBe(0);
      expect(decided[1]).toBeGreaterThan(0);
      expect(joined(parts)).toEqual(audio);
    }
  });

  it('octet orphelin final ignoré ; rien à terminer → null', () => {
    const seg = new PcmSegmenter();
    expect(seg.flush()).toBeNull();
    seg.push(new Uint8Array([1]));
    expect(seg.flush()).toBeNull();
    seg.push(new Uint8Array([1, 2, 3]));
    expect(seg.flush()?.pcm).toEqual(new Uint8Array([1, 2]));
  });
});
