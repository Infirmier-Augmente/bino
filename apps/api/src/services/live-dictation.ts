import {
  type LiveSttPort,
  type LiveSttSession,
  type PcmSegment,
  PcmSegmenter,
  pcm16DurationSec,
  type SegmenterConfig,
  type SttPort,
} from '@infirmier/ai';
import {
  LIVE_AUDIO_FORMAT,
  LIVE_MAX_SECONDS,
  LiveClientMessage,
  type LiveServerMessage,
} from '@infirmier/domain';
import { describeSession, type SegmentStat } from './live-report';
import { type FinalizedSegment, SegmentFinalizer, SILENCE_ENGINE } from './segment-finalizer';

/**
 * UNE DICTÉE EN DIRECT (indépendante du transport WebSocket, testable sans réseau).
 *
 * Le son est découpé en SEGMENTS aux pauses de la voix (`PcmSegmenter`). Pendant qu'on parle,
 * le port `LiveSttPort` donne le texte provisoire du segment en cours (`delta`). Dès qu'un
 * segment est coupé, le port fichier (`SttPort`, meilleur modèle) le retranscrit et son texte
 * définitif part en `segment`. À l'arrêt : dernier segment, puis `final` = les segments bout à
 * bout (le texte déjà affiché, sans réécriture). Si le direct tombe en panne, les segments
 * sont quand même finalisés ; si un segment échoue (deux fois), son provisoire le remplace.
 */

/** Codes de fermeture : 1000 après `final`, 1011 après `error`. */
export const LIVE_CLOSE = { final: 1000, error: 1011 } as const;

const FORMAT = { sampleRate: LIVE_AUDIO_FORMAT.sampleRate, channels: LIVE_AUDIO_FORMAT.channels };
const BYTES_PER_SECOND = 2 * FORMAT.channels * FORMAT.sampleRate;
/** Marge avant d'arrêter une connexion restée ouverte au-delà de la durée max (son lent). */
const WALL_CLOCK_GRACE_MS = 15_000;
/** Attente max du texte provisoire de la fin (il continue d'arriver pendant la finalisation). */
const LIVE_FINISH_TIMEOUT_MS = 5_000;
/** À l'arrêt, attente max des segments pas encore finalisés (sinon : texte provisoire). */
const DEFAULT_SEGMENTS_TIMEOUT_MS = 20_000;

export const LIVE_MESSAGES = {
  unavailable: 'Pas de transcription en direct configurée : utilise l’enregistrement classique.',
  noAudio: 'Aucun son reçu.',
} as const;

export interface LiveDictationDeps {
  live: LiveSttPort;
  stt: SttPort;
  /** Vocabulaire à favoriser (même consigne que `POST /transcriptions`). */
  prompt: string;
  send(message: LiveServerMessage): void;
  close(code: number, reason: string): void;
  /** Une ligne par dictée (durée, segments, latences, moteurs) : jamais le son, le texte ni une clé. */
  log?: (line: string) => void;
  maxSeconds?: number;
  /** Seuils de découpage (défaut : `LIVE_SEGMENTATION` du domaine). */
  segmentation?: Partial<SegmenterConfig>;
  segmentsTimeoutMs?: number;
  retryDelayMs?: number;
  now?: () => number;
}

type Phase = 'recording' | 'finalizing' | 'done';

export function safeErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  // Les messages des fournisseurs peuvent citer une clé (même masquée) : jamais dans les logs.
  return raw.replace(/\b(sk|key)-[\w*-]+/gi, '$1-…').slice(0, 200);
}

export class LiveDictation {
  private phase: Phase = 'recording';
  private readonly segmenter: PcmSegmenter;
  private readonly finalizer: SegmentFinalizer;
  private readonly provisional: string[] = [];
  private readonly segments: SegmentStat[] = [];
  private bytes = 0;
  private readonly maxBytes: number;
  private session: LiveSttSession | null = null;
  private liveError: string | null = null;
  private liveChars = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly abort = new AbortController();
  private readonly now: () => number;
  private readonly startedAt: number;

  constructor(private readonly deps: LiveDictationDeps) {
    this.segmenter = new PcmSegmenter(deps.segmentation);
    this.now = deps.now ?? Date.now;
    this.startedAt = this.now();
    const maxSeconds = deps.maxSeconds ?? LIVE_MAX_SECONDS;
    this.maxBytes = maxSeconds * BYTES_PER_SECOND;
    this.timer = setTimeout(
      () => void this.stop('durée max'),
      maxSeconds * 1000 + WALL_CLOCK_GRACE_MS,
    );
    this.finalizer = new SegmentFinalizer({
      stt: deps.stt,
      prompt: deps.prompt,
      provisionalEngine: deps.live.id,
      provisional: (i) => this.provisional[i] ?? '',
      onFinal: (s) => this.sendSegment(s),
      signal: this.abort.signal,
      now: this.now,
      retryDelayMs: deps.retryDelayMs,
    });
  }

  /** Ouvre la session de direct ; sans direct configuré : `error` puis fermeture. */
  start(): void {
    const { live, stt } = this.deps;
    if (!live.ready || !stt.ready) {
      this.fail(LIVE_MESSAGES.unavailable, 'direct non configuré');
      return;
    }
    if (live.sampleRate !== FORMAT.sampleRate) {
      this.liveError = `débit ${live.sampleRate} Hz incompatible`;
      return;
    }
    try {
      this.session = live.open({
        language: 'fr',
        prompt: this.deps.prompt,
        onReady: () => {
          if (this.phase !== 'done') this.deps.send({ type: 'ready', engine: live.id });
        },
        onDelta: (text, segment) => this.relayDelta(text, segment),
        onError: (e) => {
          this.liveError = safeErrorMessage(e);
        },
      });
    } catch (e) {
      this.liveError = safeErrorMessage(e);
    }
  }

  /** Trame binaire : PCM 16 bits LE mono 24 kHz. Au-delà de la durée max : arrêt. */
  onAudio(chunk: Uint8Array): void {
    if (this.phase !== 'recording' || chunk.byteLength === 0) return;
    const room = this.maxBytes - this.bytes;
    const part = chunk.byteLength > room ? chunk.subarray(0, room) : chunk;
    this.bytes += part.byteLength;
    for (const event of this.segmenter.push(part)) {
      if (event.kind === 'audio') {
        if (!this.liveError) this.session?.append(event.pcm);
      } else {
        if (!this.liveError) this.session?.cut();
        this.finalize(event.segment);
      }
    }
    if (this.bytes >= this.maxBytes) void this.stop('durée max');
  }

  /** Trame texte : seul `{"type":"stop"}` est attendu ; le reste est ignoré. */
  onText(raw: string): void {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      json = null;
    }
    if (!LiveClientMessage.safeParse(json).success) {
      this.deps.log?.('[live] message texte ignoré (attendu : {"type":"stop"})');
      return;
    }
    void this.stop('arrêt');
  }

  /** Connexion coupée par l'app : on libère tout, sans finir. */
  onClientClose(): void {
    if (this.phase === 'done') return;
    const outcome =
      this.phase === 'finalizing'
        ? 'app partie pendant la finalisation'
        : 'app partie avant l’arrêt';
    this.end();
    this.abort.abort();
    this.report(outcome);
  }

  /** Arrêt : dernier segment, attente de tous les segments, puis `final` et fermeture. */
  async stop(reason: string): Promise<void> {
    if (this.phase !== 'recording') return;
    this.phase = 'finalizing';
    this.clearTimer();
    const last = this.segmenter.flush();
    if (last) this.finalize(last);
    // Le direct transcrit la fin pendant la finalisation (provisoire de repli).
    void this.session?.finish(LIVE_FINISH_TIMEOUT_MS);
    if (this.finalizer.count === 0) {
      this.fail(LIVE_MESSAGES.noAudio, `${reason}, aucun son`);
      return;
    }
    const stoppedAt = this.now();
    const results = await this.finalizer.complete(
      this.deps.segmentsTimeoutMs ?? DEFAULT_SEGMENTS_TIMEOUT_MS,
    );
    if (this.closed()) return; // l'app est partie pendant la finalisation
    this.end();
    this.deps.send({
      type: 'final',
      text: results
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join(' '),
      durationSec: Math.round(pcm16DurationSec(this.bytes, FORMAT) * 10) / 10,
      engine: this.finalEngine(results),
    });
    this.deps.close(LIVE_CLOSE.final, 'final');
    this.report(`${reason}, final ${this.seconds(this.now() - stoppedAt)} après l’arrêt`, results);
  }

  // ─── Interne ─────────────────────────────────────────────────────────────────────────────

  private finalize(segment: PcmSegment): void {
    this.segments.push({
      reason: segment.reason,
      durationSec: pcm16DurationSec(segment.pcm.byteLength, FORMAT),
    });
    this.finalizer.submit(segment);
  }

  /** Pas de provisoire pour un segment déjà définitif (fournisseur en retard). */
  private relayDelta(text: string, segment: number): void {
    if (this.phase === 'done' || this.finalizer.isFinal(segment)) return;
    this.provisional[segment] = (this.provisional[segment] ?? '') + text;
    this.liveChars += text.length;
    this.deps.send({ type: 'delta', segment, text });
  }

  private sendSegment(s: FinalizedSegment): void {
    if (this.phase === 'done') return;
    this.deps.send({ type: 'segment', segment: s.index, text: s.text, engine: s.engine });
  }

  private finalEngine(results: readonly FinalizedSegment[]): string {
    const engines = [...new Set(results.map((s) => s.engine))].filter((e) => e !== SILENCE_ENGINE);
    return engines.length > 0 ? engines.join(' + ') : this.deps.stt.id;
  }

  private fail(message: string, detail: string): void {
    this.end();
    this.deps.send({ type: 'error', message });
    this.deps.close(LIVE_CLOSE.error, 'error');
    this.report(detail);
  }

  private end(): void {
    this.phase = 'done';
    this.clearTimer();
    this.session?.close();
  }

  /** Méthode (et non `this.phase === 'done'`) : la phase change pendant un `await`. */
  private closed(): boolean {
    return this.phase === 'done';
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private seconds(ms: number): string {
    return `${(ms / 1000).toFixed(1)} s`;
  }

  private report(outcome: string, results: readonly FinalizedSegment[] = []): void {
    this.deps.log?.(
      describeSession({
        audioSec: pcm16DurationSec(this.bytes, FORMAT),
        bytes: this.bytes,
        wallMs: this.now() - this.startedAt,
        live: this.session ? this.deps.live.id : null,
        liveChars: this.liveChars,
        liveError: this.liveError,
        segments: this.segments,
        results,
        outcome,
      }),
    );
  }
}
