import { describe, expect, it } from 'vitest';
import {
  createChunker,
  createPcmPipeline,
  createResampler,
  downmix,
  floatToPcm16,
  levelFromDb,
  levelFromRms,
  pcm16ToFloat,
  rms,
  toArrayBuffer,
} from './pcm';

const sine = (n: number, rate: number, hz = 440, amp = 0.5) =>
  Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / rate));

describe('conversion flottant ↔ PCM 16 bits', () => {
  it('borne les valeurs et respecte les extrêmes', () => {
    expect(Array.from(floatToPcm16(Float32Array.from([0, 1, -1, 2, -2, 0.5])))).toEqual([
      0, 32767, -32768, 32767, -32768, 16384,
    ]);
  });
  it('aller-retour fidèle à 1/32768 près', () => {
    const back = pcm16ToFloat(floatToPcm16(Float32Array.from([0.25, -0.75, 0.1])));
    expect(back[0]).toBeCloseTo(0.25, 4);
    expect(back[1]).toBeCloseTo(-0.75, 4);
    expect(back[2]).toBeCloseTo(0.1, 4);
  });
  it('stéréo entrelacée → mono (moyenne)', () => {
    expect(Array.from(downmix(Float32Array.from([1, 0, 0.5, 0.5, -1, 1]), 2))).toEqual([
      0.5, 0.5, 0,
    ]);
  });
});

describe('createResampler', () => {
  it('48 kHz → 24 kHz : moitié moins d’échantillons, moyenne de chaque paire', () => {
    const r = createResampler(48_000, 24_000);
    expect(Array.from(r(Float32Array.from([1, 0, 0.5, 0.5])))).toEqual([0.5, 0.5]);
  });
  it('en flux : le total ne dépend pas du découpage en morceaux (44,1 kHz)', () => {
    const input = sine(44_100, 44_100);
    const whole = createResampler(44_100, 24_000)(input);
    const r = createResampler(44_100, 24_000);
    let total = 0;
    for (let i = 0; i < input.length; i += 1000) total += r(input.subarray(i, i + 1000)).length;
    expect(Math.abs(total - whole.length)).toBeLessThanOrEqual(1);
    expect(Math.abs(whole.length - 24_000)).toBeLessThanOrEqual(1);
  });
  it('garde la forme du signal (sinusoïde de 440 Hz : même niveau)', () => {
    const out = createResampler(48_000, 24_000)(sine(4800, 48_000));
    expect(rms(out)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });
  it('monte en fréquence par interpolation (16 kHz → 24 kHz)', () => {
    const out = createResampler(16_000, 24_000)(Float32Array.from([0, 1, 0, -1, 0]));
    expect(out.length).toBe(6);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(2 / 3, 5);
  });
  it('même fréquence : rien à faire', () => {
    const input = Float32Array.from([0.1, 0.2]);
    expect(createResampler(24_000, 24_000)(input)).toBe(input);
  });
});

describe('createChunker', () => {
  it('découpe en trames fixes et rend le reste à la fin', () => {
    const c = createChunker(4);
    expect(c.push(Int16Array.from([1, 2, 3]))).toEqual([]);
    const chunks = c.push(Int16Array.from([4, 5, 6, 7, 8, 9, 10]));
    expect(chunks.map((x) => Array.from(x))).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    expect(Array.from(c.flush() ?? [])).toEqual([9, 10]);
    expect(c.flush()).toBeNull();
  });
});

describe('niveau du micro', () => {
  it('silence = 0, voix forte = 1, échelle en dB', () => {
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(1)).toBe(1);
    expect(levelFromDb(-160)).toBe(0);
    expect(levelFromDb(-33.5)).toBeCloseTo(0.5, 2);
    expect(levelFromDb(Number.NEGATIVE_INFINITY)).toBe(0);
  });
  it('RMS d’entiers 16 bits ramené à 0–1', () => {
    expect(rms(Int16Array.from([16384, -16384]))).toBeCloseTo(0.5, 5);
    expect(rms(new Int16Array(0))).toBe(0);
  });
});

describe('createPcmPipeline', () => {
  it('déjà au bon format : trames de 100 ms (2 400 échantillons à 24 kHz)', () => {
    const p = createPcmPipeline(24_000);
    const { chunks, level } = p.push(new Int16Array(5000).fill(8000), 24_000);
    expect(chunks.map((c) => c.length)).toEqual([2400, 2400]);
    expect(level).toBeGreaterThan(0.5);
    expect(p.flush()?.length).toBe(200);
  });
  it('flottants 48 kHz stéréo → PCM 16 bits mono 24 kHz', () => {
    const p = createPcmPipeline(24_000);
    const stereo = new Float32Array(9600).fill(0.5);
    const { chunks } = p.push(stereo, 48_000, 2);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.[0]).toBe(16384);
  });
  it('copie exacte des octets d’une trame', () => {
    const view = Int16Array.from([1, 2, 3, 4]).subarray(1, 3);
    const buf = toArrayBuffer(view);
    expect(buf.byteLength).toBe(4);
    expect(Array.from(new Int16Array(buf))).toEqual([2, 3]);
  });
});
