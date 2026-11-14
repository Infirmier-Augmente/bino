import { LIVE_AUDIO_FORMAT, LIVE_SEGMENTATION } from '@infirmier/domain';

/**
 * DÉCOUPAGE DE LA DICTÉE EN SEGMENTS aux pauses de la voix (fonction pure, sans I/O).
 *
 * Détection d'activité vocale par l'énergie : fenêtres de `windowMs`, niveau (dBFS) comparé à
 * un bruit de fond ADAPTATIF (10ᵉ centile des 3 dernières secondes, plafonné à
 * `maxNoiseFloorDb` pour qu'une parole continue ne devienne pas du « bruit ») + `speechOverNoiseDb`,
 * et jamais sous un plancher absolu `silenceFloorDb`. Un segment se termine :
 *   - après `pauseMs` de silence, s'il contient de la parole et dure au moins `minSegmentMs` ;
 *   - sinon, dans les `maxCutLookbackMs` qui précèdent `maxSegmentMs` : au premier blanc d'au
 *     moins `maxCutGapMs` (coupure décidée sur le moment : le direct reste aligné) ;
 *   - à défaut, à `maxSegmentMs`, au milieu du passage le plus calme des `maxCutLookbackMs`
 *     derniers (coupure dans le passé : le provisoire du direct déborde un peu sur la suite).
 * Les coupures tombent entre deux échantillons : bout à bout, les segments redonnent EXACTEMENT
 * le son reçu (seul un octet orphelin final, échantillon incomplet, est ignoré).
 */

export interface SegmenterConfig {
  sampleRate: number;
  pauseMs: number;
  minSegmentMs: number;
  maxSegmentMs: number;
  windowMs: number;
  maxCutLookbackMs: number;
  /** Blanc entre deux mots suffisant pour couper avant `maxSegmentMs` (plus long qu'une occlusive). */
  maxCutGapMs: number;
  /** Sous ce niveau (dBFS), une fenêtre est toujours du silence. */
  silenceFloorDb: number;
  /** Plafond du bruit de fond estimé (dBFS) : au-delà, c'est de la voix, pas du bruit. */
  maxNoiseFloorDb: number;
  /** Une fenêtre est de la parole si elle dépasse le bruit de fond d'au moins cet écart (dB). */
  speechOverNoiseDb: number;
  /** Parole minimale pour qu'un segment « contienne de la parole ». */
  minSpeechMs: number;
}

export const DEFAULT_SEGMENTER_CONFIG: SegmenterConfig = {
  sampleRate: LIVE_AUDIO_FORMAT.sampleRate,
  ...LIVE_SEGMENTATION,
  windowMs: 20,
  maxCutLookbackMs: 2_000,
  maxCutGapMs: 120,
  silenceFloorDb: -50,
  maxNoiseFloorDb: -35,
  speechOverNoiseDb: 10,
  minSpeechMs: 100,
};

export type SegmentCutReason = 'pause' | 'max' | 'end';

export interface PcmSegment {
  index: number;
  /** Premier échantillon (inclus) et dernier (exclu), comptés depuis le début de la dictée. */
  startSample: number;
  endSample: number;
  /** PCM 16 bits little-endian du segment. */
  pcm: Uint8Array;
  hasSpeech: boolean;
  reason: SegmentCutReason;
  /** Échantillon où la coupure a été décidée (= `endSample`, sauf coupure « max » : après). */
  decidedAtSample: number;
}

/**
 * Flux de sortie de `push`, dans l'ordre : le son (échantillons entiers) et les coupures au
 * moment où elles sont décidées. Relayer ce flux tel quel garde un fournisseur en direct
 * aligné sur les segments.
 */
export type SegmenterEvent =
  | { kind: 'audio'; pcm: Uint8Array }
  | { kind: 'segment'; segment: PcmSegment };

interface Window {
  start: number;
  db: number;
  speech: boolean;
}

const NOISE_HISTORY_MS = 3_000;
const NOISE_PERCENTILE = 0.1;

function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1 && chunks[0]) return chunks[0];
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export class PcmSegmenter {
  private readonly cfg: SegmenterConfig;
  private readonly windowSamples: number;
  private index = 0;
  private carry: number | null = null;
  /** Son du segment en cours (échantillons entiers). */
  private chunks: Uint8Array[] = [];
  private bytes = 0;
  private segStart = 0;
  private sample = 0;
  private winSumSq = 0;
  private winCount = 0;
  private windows: Window[] = [];
  private readonly noise: number[] = [];

  constructor(config: Partial<SegmenterConfig> = {}) {
    this.cfg = { ...DEFAULT_SEGMENTER_CONFIG, ...config };
    this.windowSamples = Math.max(1, Math.round((this.cfg.sampleRate * this.cfg.windowMs) / 1000));
  }

  /** Ajoute du son ; renvoie le son accepté et les segments terminés par ce morceau. */
  push(chunk: Uint8Array): SegmenterEvent[] {
    const data = this.withCarry(chunk);
    const out: SegmenterEvent[] = [];
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let p = 0;
    let audioFrom = 0;
    while (p < data.byteLength) {
      const take = Math.min((this.windowSamples - this.winCount) * 2, data.byteLength - p);
      for (let i = p; i < p + take; i += 2) {
        const v = view.getInt16(i, true);
        this.winSumSq += v * v;
      }
      this.chunks.push(data.subarray(p, p + take));
      this.bytes += take;
      this.winCount += take / 2;
      this.sample += take / 2;
      p += take;
      if (this.winCount === this.windowSamples) {
        const segment = this.closeWindow();
        if (segment) {
          if (p > audioFrom) out.push({ kind: 'audio', pcm: data.subarray(audioFrom, p) });
          audioFrom = p;
          out.push({ kind: 'segment', segment });
        }
      }
    }
    if (data.byteLength > audioFrom) out.push({ kind: 'audio', pcm: data.subarray(audioFrom) });
    return out;
  }

  /** Fin de la dictée : le son restant forme le dernier segment (null s'il est vide). */
  flush(): PcmSegment | null {
    this.carry = null;
    if (this.bytes < 2) return null;
    return this.cutAt(this.sample, 'end');
  }

  // ─── Interne ─────────────────────────────────────────────────────────────────────────────

  /** Copie du morceau, précédé de l'octet orphelin du précédent ; garde l'octet impair final. */
  private withCarry(chunk: Uint8Array): Uint8Array {
    const total = (this.carry === null ? 0 : 1) + chunk.byteLength;
    const even = total - (total % 2);
    const data = new Uint8Array(even);
    const head = this.carry !== null && even > 0 ? 1 : 0;
    if (head === 1 && this.carry !== null) data[0] = this.carry;
    data.set(chunk.subarray(0, even - head), head);
    if (total % 2 === 0) this.carry = null;
    else if (total > 1) this.carry = chunk[chunk.byteLength - 1] ?? null;
    else this.carry = this.carry ?? chunk[0] ?? null;
    return data;
  }

  private closeWindow(): PcmSegment | null {
    const rms = Math.sqrt(this.winSumSq / this.windowSamples);
    const db = 20 * Math.log10(Math.max(rms, 1e-3) / 32_768);
    this.winSumSq = 0;
    this.winCount = 0;
    const noise = Math.min(this.noiseFloorDb(), this.cfg.maxNoiseFloorDb);
    const threshold = Math.max(this.cfg.silenceFloorDb, noise + this.cfg.speechOverNoiseDb);
    const window: Window = { start: this.sample - this.windowSamples, db, speech: db > threshold };
    this.windows.push(window);
    this.rememberNoise(db);

    const durationMs = this.ms(this.sample - this.segStart);
    if (
      this.hasSpeech(this.windows) &&
      durationMs >= this.cfg.minSegmentMs &&
      this.silentRunMs() >= this.cfg.pauseMs
    ) {
      return this.cutAt(this.sample, 'pause');
    }
    const nearMax = durationMs >= this.cfg.maxSegmentMs - this.cfg.maxCutLookbackMs;
    if (nearMax && this.hasSpeech(this.windows) && this.silentRunMs() >= this.cfg.maxCutGapMs) {
      return this.cutAt(this.sample, 'max');
    }
    if (durationMs >= this.cfg.maxSegmentMs) return this.cutAt(this.quietestPoint(), 'max');
    return null;
  }

  private rememberNoise(db: number): void {
    this.noise.push(db);
    const max = Math.round(NOISE_HISTORY_MS / this.cfg.windowMs);
    if (this.noise.length > max) this.noise.splice(0, this.noise.length - max);
  }

  private noiseFloorDb(): number {
    if (this.noise.length === 0) return Number.NEGATIVE_INFINITY;
    const sorted = [...this.noise].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * NOISE_PERCENTILE)] ?? Number.NEGATIVE_INFINITY;
  }

  private hasSpeech(windows: readonly Window[]): boolean {
    const speech = windows.reduce((n, w) => n + (w.speech ? 1 : 0), 0);
    return speech * this.cfg.windowMs >= this.cfg.minSpeechMs;
  }

  private silentRunMs(): number {
    let n = 0;
    for (let i = this.windows.length - 1; i >= 0 && !this.windows[i]?.speech; i--) n++;
    return n * this.cfg.windowMs;
  }

  /** Milieu du passage le plus calme des dernières secondes (entre deux échantillons). */
  private quietestPoint(): number {
    const lookback = Math.round(this.cfg.maxCutLookbackMs / this.cfg.windowMs);
    const from = Math.max(0, this.windows.length - lookback);
    let best = from;
    for (let i = from; i < this.windows.length; i++) {
      if ((this.windows[i]?.db ?? 0) < (this.windows[best]?.db ?? 0)) best = i;
    }
    // Passage calme autour du minimum (à 1 dB près) : on coupe en son milieu.
    const quiet = (i: number) => (this.windows[i]?.db ?? 0) <= (this.windows[best]?.db ?? 0) + 1;
    let a = best;
    let b = best;
    while (a - 1 >= from && quiet(a - 1)) a--;
    while (b + 1 < this.windows.length && quiet(b + 1)) b++;
    const first = this.windows[a]?.start ?? this.segStart;
    const last = (this.windows[b]?.start ?? this.segStart) + this.windowSamples;
    return Math.max(this.segStart + 1, Math.round((first + last) / 2));
  }

  /** Termine le segment à l'échantillon `at` (≤ échantillon courant) ; la suite reste en cours. */
  private cutAt(at: number, reason: SegmentCutReason): PcmSegment {
    const all = concat(this.chunks, this.bytes);
    const cutByte = (at - this.segStart) * 2;
    const kept = this.windows.filter((w) => w.start + this.windowSamples <= at);
    const segment: PcmSegment = {
      index: this.index++,
      startSample: this.segStart,
      endSample: at,
      pcm: all.subarray(0, cutByte),
      hasSpeech: this.hasSpeech(reason === 'end' ? this.windows : kept),
      reason,
      decidedAtSample: this.sample,
    };
    const rest = all.subarray(cutByte);
    this.chunks = rest.byteLength > 0 ? [rest] : [];
    this.bytes = rest.byteLength;
    this.segStart = at;
    this.windows = this.windows.filter((w) => w.start >= at);
    return segment;
  }

  private ms(samples: number): number {
    return (samples * 1000) / this.cfg.sampleRate;
  }
}
