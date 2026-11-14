import {
  type LiveSttPort,
  type LiveSttSession,
  pcm16DurationSec,
  pcm16ToWav,
  type SttPort,
} from '@infirmier/ai';
import {
  LIVE_AUDIO_FORMAT,
  LIVE_MAX_SECONDS,
  LiveClientMessage,
  type LiveServerMessage,
} from '@infirmier/domain';

/**
 * UNE DICTÉE EN DIRECT (indépendante du transport WebSocket, testable sans réseau).
 *
 * Pendant la dictée : tout le son reçu est gardé en mémoire ET relayé au port `LiveSttPort`,
 * dont le texte provisoire part au fil de l'eau (`delta`). À l'arrêt : TOUT le son est
 * retranscrit par le port fichier (`SttPort`, meilleur modèle, contexte complet, nombres en
 * chiffres) et le texte part en `final`, qui remplace le provisoire. Si le direct tombe en
 * panne, on continue d'enregistrer : `final` est produit quand même (rien n'est perdu).
 */

/** Codes de fermeture : 1000 après `final`, 1011 après `error`. */
export const LIVE_CLOSE = { final: 1000, error: 1011 } as const;

const FORMAT = { sampleRate: LIVE_AUDIO_FORMAT.sampleRate, channels: LIVE_AUDIO_FORMAT.channels };
const BYTES_PER_SECOND = 2 * FORMAT.channels * FORMAT.sampleRate;
/** Marge avant d'arrêter une connexion restée ouverte au-delà de la durée max (son lent). */
const WALL_CLOCK_GRACE_MS = 15_000;
/** Attente max de la fin du texte provisoire (il continue d'arriver pendant la transcription). */
const DEFAULT_FINISH_TIMEOUT_MS = 5_000;

export const LIVE_MESSAGES = {
  unavailable: 'Pas de transcription en direct configurée : utilise l’enregistrement classique.',
  noAudio: 'Aucun son reçu.',
  finalFailed: 'Transcription finale impossible : garde le texte provisoire et réessaie.',
} as const;

export interface LiveDictationDeps {
  live: LiveSttPort;
  stt: SttPort;
  /** Vocabulaire à favoriser (même consigne que `POST /transcriptions`). */
  prompt: string;
  send(message: LiveServerMessage): void;
  close(code: number, reason: string): void;
  /** Une ligne par dictée (durée, octets, moteurs) : jamais le son, le texte ni une clé. */
  log?: (line: string) => void;
  maxSeconds?: number;
  finishTimeoutMs?: number;
  now?: () => number;
}

type Phase = 'recording' | 'transcribing' | 'done';

function errorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  // Les messages des fournisseurs peuvent citer une clé (même masquée) : jamais dans les logs.
  return raw.replace(/\b(sk|key)-[\w*-]+/gi, '$1-…').slice(0, 200);
}

export class LiveDictation {
  private phase: Phase = 'recording';
  private readonly chunks: Uint8Array[] = [];
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
    this.now = deps.now ?? Date.now;
    this.startedAt = this.now();
    const maxSeconds = deps.maxSeconds ?? LIVE_MAX_SECONDS;
    this.maxBytes = maxSeconds * BYTES_PER_SECOND;
    this.timer = setTimeout(
      () => void this.stop('durée max'),
      maxSeconds * 1000 + WALL_CLOCK_GRACE_MS,
    );
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
        onDelta: (text) => {
          if (this.phase === 'done') return;
          this.liveChars += text.length;
          this.deps.send({ type: 'delta', text });
        },
        onError: (e) => {
          this.liveError = errorMessage(e);
        },
      });
    } catch (e) {
      this.liveError = errorMessage(e);
    }
  }

  /** Trame binaire : PCM 16 bits LE mono 24 kHz. Au-delà de la durée max : arrêt et transcription. */
  onAudio(chunk: Uint8Array): void {
    if (this.phase !== 'recording' || chunk.byteLength === 0) return;
    const room = this.maxBytes - this.bytes;
    const part = chunk.byteLength > room ? chunk.subarray(0, room) : chunk;
    if (part.byteLength > 0) {
      this.chunks.push(part);
      this.bytes += part.byteLength;
      if (!this.liveError) this.session?.append(part);
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
    const message = LiveClientMessage.safeParse(json);
    if (!message.success) {
      this.deps.log?.('[live] message texte ignoré (attendu : {"type":"stop"})');
      return;
    }
    void this.stop('arrêt');
  }

  /** Connexion coupée par l'app : on libère tout, sans transcrire. */
  onClientClose(): void {
    if (this.phase === 'done') return;
    const wasTranscribing = this.phase === 'transcribing';
    this.end();
    this.abort.abort();
    this.report(
      wasTranscribing ? 'app partie pendant la transcription' : 'app partie avant l’arrêt',
    );
  }

  /** Arrêt : retranscription de tout le son par le port fichier, puis `final` et fermeture. */
  async stop(reason: string): Promise<void> {
    if (this.phase !== 'recording') return;
    this.phase = 'transcribing';
    this.clearTimer();
    // Le direct transcrit la fin de la dictée pendant que le port fichier travaille.
    void this.session?.finish(this.deps.finishTimeoutMs ?? DEFAULT_FINISH_TIMEOUT_MS);
    if (this.bytes < 2) {
      this.fail(LIVE_MESSAGES.noAudio, `${reason}, aucun son`);
      return;
    }
    const t0 = this.now();
    const duration = pcm16DurationSec(this.bytes, FORMAT);
    try {
      const result = await this.deps.stt.transcribe({
        audio: pcm16ToWav(this.chunks, FORMAT),
        mimeType: 'audio/wav',
        language: 'fr',
        prompt: this.deps.prompt,
        signal: this.abort.signal,
      });
      if (this.closed()) return; // l'app est partie pendant la transcription
      this.end();
      this.deps.send({
        type: 'final',
        text: result.text,
        durationSec: result.durationSec ?? Math.round(duration * 10) / 10,
        engine: this.deps.stt.id,
      });
      this.deps.close(LIVE_CLOSE.final, 'final');
      this.report(`${reason}, final ${this.deps.stt.id} en ${this.seconds(this.now() - t0)}`);
    } catch (e) {
      if (this.closed()) return; // l'app est partie pendant la transcription
      this.fail(
        LIVE_MESSAGES.finalFailed,
        `${reason}, final ${this.deps.stt.id} en échec : ${errorMessage(e)}`,
      );
    }
  }

  // ─── Interne ─────────────────────────────────────────────────────────────────────────────

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
    this.chunks.length = 0;
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

  private report(outcome: string): void {
    const audio = pcm16DurationSec(this.bytes, FORMAT);
    const live = this.session
      ? `direct ${this.deps.live.id} ${this.liveChars} car.${this.liveError ? ` (en panne : ${this.liveError})` : ''}`
      : `direct indisponible${this.liveError ? ` (${this.liveError})` : ''}`;
    this.deps.log?.(
      `[live] ${audio.toFixed(1)} s de son (${this.bytes} octets) en ${this.seconds(this.now() - this.startedAt)} · ${live} · ${outcome}`,
    );
  }
}
