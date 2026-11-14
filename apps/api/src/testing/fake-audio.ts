/** Son synthétique PCM 16 bits LE mono 24 kHz pour les tests (aucune donnée réelle). */

const SR = 24_000;
const samples = (ms: number) => Math.round((SR * ms) / 1000);

/** « Voix » : sinusoïde à -15 dBFS environ. */
export function voice(ms: number): number[] {
  return Array.from({ length: samples(ms) }, (_, i) =>
    Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / SR)),
  );
}

export function quiet(ms: number): number[] {
  return new Array<number>(samples(ms)).fill(0);
}

export function pcm(...parts: number[][]): Uint8Array {
  const all = parts.flat();
  const out = new Uint8Array(all.length * 2);
  const view = new DataView(out.buffer);
  all.forEach((v, i) => {
    view.setInt16(i * 2, v, true);
  });
  return out;
}

/** Découpe en trames de `ms` (100 ms = 4 800 octets). */
export function frames(audio: Uint8Array, ms = 100): Uint8Array[] {
  const size = samples(ms) * 2;
  const out: Uint8Array[] = [];
  for (let i = 0; i < audio.byteLength; i += size) out.push(audio.slice(i, i + size));
  return out;
}

/** Octets de `ms` de son. */
export const bytesOf = (ms: number) => samples(ms) * 2;
