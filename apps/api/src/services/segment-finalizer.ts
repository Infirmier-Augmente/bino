import { type PcmSegment, pcm16ToWav, type SttPort } from '@infirmier/ai';
import { LIVE_AUDIO_FORMAT } from '@infirmier/domain';

/**
 * TEXTE DÉFINITIF DE CHAQUE SEGMENT, dès qu'il est coupé : WAV du segment → port fichier
 * (`SttPort`, meilleur modèle), avec en contexte le texte qui précède (définitif s'il est
 * arrivé, sinon provisoire). Segments transcrits EN PARALLÈLE ; un échec est retenté une fois,
 * puis le texte provisoire du segment le remplace (rien n'est perdu).
 */

const FORMAT = { sampleRate: LIVE_AUDIO_FORMAT.sampleRate, channels: LIVE_AUDIO_FORMAT.channels };
/** Contexte donné au modèle : fin du texte qui précède (environ). */
export const CONTEXT_CHARS = 600;
/** Segment sans parole détectée ni texte provisoire : pas de transcription (évite d'inventer). */
export const SILENCE_ENGINE = 'silence';

export type SegmentSource = 'stt' | 'provisional' | 'silence';

export interface FinalizedSegment {
  index: number;
  text: string;
  engine: string;
  source: SegmentSource;
  /** Délai entre la coupure et le texte définitif. */
  latencyMs: number;
}

export interface SegmentFinalizerDeps {
  stt: SttPort;
  /** Consigne de base (vocabulaire soignant). */
  prompt: string;
  /** Moteur affiché quand le texte provisoire sert de définitif (repli). */
  provisionalEngine: string;
  /** Texte provisoire actuel d'un segment. */
  provisional(index: number): string;
  onFinal(segment: FinalizedSegment): void;
  signal: AbortSignal;
  now: () => number;
  retryDelayMs?: number;
}

/** Consigne + fin du texte précédent (coupée sur un mot), pour la continuité de la dictée. */
export function contextPrompt(base: string, previous: string, maxChars = CONTEXT_CHARS): string {
  const text = previous.replace(/\s+/g, ' ').trim();
  if (!text) return base;
  if (text.length <= maxChars) return `${base}\n\n${text}`;
  const tail = text.slice(-maxChars);
  const space = tail.indexOf(' ');
  return `${base}\n\n…${space >= 0 && space < 40 ? tail.slice(space + 1) : tail}`;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class SegmentFinalizer {
  private readonly results = new Map<number, FinalizedSegment>();
  private readonly running: Promise<void>[] = [];
  private submitted = 0;

  constructor(private readonly deps: SegmentFinalizerDeps) {}

  get count(): number {
    return this.submitted;
  }

  isFinal(index: number): boolean {
    return this.results.has(index);
  }

  /** Lance la transcription d'un segment qui vient d'être coupé (dans l'ordre des index). */
  submit(segment: PcmSegment): void {
    this.submitted = Math.max(this.submitted, segment.index + 1);
    const cutAt = this.deps.now();
    const prompt = contextPrompt(this.deps.prompt, this.textBefore(segment.index));
    this.running.push(
      this.transcribe(segment, prompt).then((r) => {
        this.settle({ index: segment.index, ...r, latencyMs: this.deps.now() - cutAt });
      }),
    );
  }

  /**
   * Attend tous les segments (au plus `timeoutMs`) ; ceux qui manquent prennent leur texte
   * provisoire. Renvoie les segments dans l'ordre.
   */
  async complete(timeoutMs: number): Promise<FinalizedSegment[]> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
      Promise.all(this.running),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
    if (timer) clearTimeout(timer);
    const out: FinalizedSegment[] = [];
    for (let i = 0; i < this.submitted; i++) {
      const done =
        this.results.get(i) ??
        this.settle({
          index: i,
          text: this.deps.provisional(i).trim(),
          engine: this.deps.provisionalEngine,
          source: 'provisional',
          latencyMs: timeoutMs,
        });
      out.push(done);
    }
    return out;
  }

  // ─── Interne ─────────────────────────────────────────────────────────────────────────────

  private textBefore(index: number): string {
    const parts: string[] = [];
    for (let i = 0; i < index; i++) {
      parts.push(this.results.get(i)?.text ?? this.deps.provisional(i));
    }
    return parts.join(' ');
  }

  private async transcribe(
    segment: PcmSegment,
    prompt: string,
  ): Promise<Pick<FinalizedSegment, 'text' | 'engine' | 'source'>> {
    const { stt, signal } = this.deps;
    if (!segment.hasSpeech && !this.deps.provisional(segment.index).trim()) {
      return { text: '', engine: SILENCE_ENGINE, source: 'silence' };
    }
    const audio = pcm16ToWav([segment.pcm], FORMAT);
    for (let attempt = 0; attempt < 2 && !signal.aborted; attempt++) {
      try {
        const result = await stt.transcribe({
          audio,
          mimeType: 'audio/wav',
          language: 'fr',
          prompt,
          signal,
        });
        return { text: result.text.trim(), engine: stt.id, source: 'stt' };
      } catch {
        if (attempt === 0 && !signal.aborted) await wait(this.deps.retryDelayMs ?? 300);
      }
    }
    return {
      text: this.deps.provisional(segment.index).trim(),
      engine: this.deps.provisionalEngine,
      source: 'provisional',
    };
  }

  /** Premier résultat d'un segment = le bon (un résultat tardif après le délai est ignoré). */
  private settle(segment: FinalizedSegment): FinalizedSegment {
    const known = this.results.get(segment.index);
    if (known) return known;
    this.results.set(segment.index, segment);
    this.deps.onFinal(segment);
    return segment;
  }
}
