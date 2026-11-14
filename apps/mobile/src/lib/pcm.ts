/**
 * SON DU MICRO → PCM 16 bits mono 24 kHz (format de la dictée en direct, voir
 * `LIVE_AUDIO_FORMAT` dans le domaine). Fonctions pures : la capture (navigateur ou natif)
 * ne fait que fournir des échantillons.
 */

/** Échantillons flottants (-1 à 1) → entiers 16 bits signés. */
export function floatToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}

/** Entiers 16 bits signés → flottants (-1 à 1). */
export function pcm16ToFloat(samples: Int16Array): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = (samples[i] ?? 0) / 0x8000;
  return out;
}

/** Canaux entrelacés [G, D, G, D…] → mono (moyenne). */
export function downmix(samples: Float32Array, channels: number): Float32Array {
  if (channels <= 1) return samples;
  const frames = Math.floor(samples.length / channels);
  const out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += samples[f * channels + c] ?? 0;
    out[f] = sum / channels;
  }
  return out;
}

/**
 * Rééchantillonneur en flux (garde la fin de chaque morceau pour le suivant : pas de
 * craquement entre deux morceaux). Pour descendre (48 kHz → 24 kHz), moyenne des échantillons
 * de chaque fenêtre (filtre anti-repliement simple, suffisant pour la voix) ; pour monter,
 * interpolation linéaire.
 */
export function createResampler(
  fromRate: number,
  toRate: number,
): (input: Float32Array) => Float32Array {
  const from = Math.round(fromRate);
  const to = Math.round(toRate);
  if (from === to) return (input) => input;
  let carry = new Float32Array(0);
  // Position du prochain échantillon de sortie, en 1/to d'échantillon d'entrée (entiers :
  // pas de dérive d'arrondi sur une longue dictée).
  let pos = 0;
  return (input) => {
    const data = new Float32Array(carry.length + input.length);
    data.set(carry);
    data.set(input, carry.length);
    const out: number[] = [];
    if (from > to) {
      while (Math.floor((pos + from) / to) <= data.length) {
        const start = Math.floor(pos / to);
        const end = Math.max(start + 1, Math.floor((pos + from) / to));
        let sum = 0;
        for (let k = start; k < end; k++) sum += data[k] ?? 0;
        out.push(sum / (end - start));
        pos += from;
      }
    } else {
      while (Math.floor(pos / to) + 1 < data.length) {
        const i = Math.floor(pos / to);
        const frac = (pos - i * to) / to;
        const a = data[i] ?? 0;
        const b = data[i + 1] ?? a;
        out.push(a + (b - a) * frac);
        pos += from;
      }
    }
    const consumed = Math.min(Math.floor(pos / to), data.length);
    carry = data.slice(consumed);
    pos -= consumed * to;
    return Float32Array.from(out);
  };
}

/**
 * Regroupe le son en trames de taille fixe (~100 ms) avant l'envoi. `flush` rend le reste
 * (fin de la dictée) pour que rien ne soit perdu.
 */
export function createChunker(samplesPerChunk: number) {
  let pending = new Int16Array(samplesPerChunk);
  let filled = 0;
  return {
    push(samples: Int16Array): Int16Array[] {
      const chunks: Int16Array[] = [];
      let offset = 0;
      while (offset < samples.length) {
        const take = Math.min(samplesPerChunk - filled, samples.length - offset);
        pending.set(samples.subarray(offset, offset + take), filled);
        filled += take;
        offset += take;
        if (filled === samplesPerChunk) {
          chunks.push(pending);
          pending = new Int16Array(samplesPerChunk);
          filled = 0;
        }
      }
      return chunks;
    },
    flush(): Int16Array | null {
      if (filled === 0) return null;
      const rest = pending.slice(0, filled);
      pending = new Int16Array(samplesPerChunk);
      filled = 0;
      return rest;
    },
  };
}

/** Niveau efficace (RMS) d'un morceau, entre 0 et 1. */
export function rms(samples: Float32Array | Int16Array): number {
  if (samples.length === 0) return 0;
  const scale = samples instanceof Int16Array ? 1 / 0x8000 : 1;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = (samples[i] ?? 0) * scale;
    sum += s * s;
  }
  return Math.sqrt(sum / samples.length);
}

/** Plage utile de la voix au micro d'un téléphone, en dB pleine échelle. */
const FLOOR_DB = -55;
const CEIL_DB = -12;

/** Niveau en dB pleine échelle → 0 (silence) à 1 (voix forte), pour l'animation du micro. */
export function levelFromDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db - FLOOR_DB) / (CEIL_DB - FLOOR_DB)));
}

/** RMS (0 à 1) → niveau affiché (0 à 1, échelle en dB : proche de l'oreille). */
export function levelFromRms(value: number): number {
  return value <= 0 ? 0 : levelFromDb(20 * Math.log10(value));
}

/**
 * Chaîne complète d'un morceau capté → trames prêtes à envoyer + niveau. Le rééchantillonneur
 * est recréé si le matériel change de fréquence (ex. casque Bluetooth branché en cours).
 */
export function createPcmPipeline(targetRate: number, chunkMs = 100) {
  const chunker = createChunker(Math.round((targetRate * chunkMs) / 1000));
  let rate = 0;
  let resample: (input: Float32Array) => Float32Array = (input) => input;
  return {
    push(
      samples: Float32Array | Int16Array,
      sampleRate: number,
      channels = 1,
    ): { chunks: Int16Array[]; level: number } {
      const level = levelFromRms(rms(samples));
      if (samples instanceof Int16Array && channels === 1 && sampleRate === targetRate) {
        return { chunks: chunker.push(samples), level };
      }
      if (sampleRate !== rate) {
        rate = sampleRate;
        resample = createResampler(sampleRate, targetRate);
      }
      const floats = samples instanceof Int16Array ? pcm16ToFloat(samples) : samples;
      return { chunks: chunker.push(floatToPcm16(resample(downmix(floats, channels)))), level };
    },
    flush: () => chunker.flush(),
  };
}

/** Copie exacte des octets d'une trame (un `subarray` partage le tampon d'origine). */
export function toArrayBuffer(samples: Int16Array): ArrayBuffer {
  const out = new ArrayBuffer(samples.byteLength);
  new Int16Array(out).set(samples);
  return out;
}
