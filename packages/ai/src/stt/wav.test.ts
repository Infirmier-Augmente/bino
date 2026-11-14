import { describe, expect, it } from 'vitest';
import { pcm16DurationSec, pcm16ToWav, WAV_HEADER_BYTES } from './wav';

const FORMAT = { sampleRate: 24_000, channels: 1 };
const ascii = (b: Uint8Array, from: number) => String.fromCharCode(...b.subarray(from, from + 4));

describe('pcm16ToWav', () => {
  it('écrit un en-tête WAV PCM 16 bits mono 24 kHz valide', () => {
    const wav = pcm16ToWav([new Uint8Array(48_000)], FORMAT);
    const view = new DataView(wav.buffer);
    expect(wav.byteLength).toBe(WAV_HEADER_BYTES + 48_000);
    expect(ascii(wav, 0)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 48_000);
    expect(ascii(wav, 8)).toBe('WAVE');
    expect(ascii(wav, 12)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint32(28, true)).toBe(48_000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(wav, 36)).toBe('data');
    expect(view.getUint32(40, true)).toBe(48_000);
  });

  it('met les morceaux bout à bout, dans l’ordre', () => {
    const wav = pcm16ToWav([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6, 7])], FORMAT);
    // 7 octets → 6 (un échantillon incomplet est ignoré)
    expect([...wav.subarray(WAV_HEADER_BYTES)]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new DataView(wav.buffer).getUint32(40, true)).toBe(6);
  });

  it('son vide : en-tête seul', () => {
    const wav = pcm16ToWav([], FORMAT);
    expect(wav.byteLength).toBe(WAV_HEADER_BYTES);
    expect(new DataView(wav.buffer).getUint32(40, true)).toBe(0);
  });

  it('durée en secondes', () => {
    expect(pcm16DurationSec(48_000, FORMAT)).toBe(1);
    expect(pcm16DurationSec(1_296_000, FORMAT)).toBe(27);
  });
});
