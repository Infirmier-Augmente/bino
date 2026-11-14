import type { LiveSttOptions, LiveSttPort, LiveSttSession } from './live-port';
import {
  nativeRealtimeSocket,
  parseRealtimeEvent,
  type RealtimeSocket,
  type RealtimeSocketFactory,
  realtimeTranscriptionUrl,
} from './openai-realtime-events';

export {
  nativeRealtimeSocket,
  type RealtimeSocket,
  type RealtimeSocketFactory,
  type RealtimeSocketHandlers,
  realtimeTranscriptionUrl,
} from './openai-realtime-events';

/**
 * TRANSCRIPTION EN DIRECT via l'API Realtime d'OpenAI (session de type « transcription »).
 * Le son est relayé par NOTRE serveur : la clé ne quitte jamais l'API.
 * Mesuré (nov. 2026) : `gpt-live-transcribe` streame le texte pendant l'envoi (sans VAD serveur,
 * `turn_detection: null` obligatoire). Chaque `input_audio_buffer.commit` clôt un élément
 * (`input_audio_buffer.committed`, dans l'ordre) ; les deltas portent l'`item_id` de l'élément,
 * déjà connu avant son commit. Segment n = n-ième commit.
 */

const SAMPLE_RATE = 24_000;
/** En dessous, OpenAI refuse le commit (« buffer too small ») : on complète par du silence. */
const MIN_COMMIT_BYTES = (SAMPLE_RATE * 2) / 10;
/** Taille max d'un `input_audio_buffer.append` (la limite OpenAI est de 15 Mio en base64). */
const MAX_APPEND_BYTES = 512 * 1024;
const DEFAULT_FINISH_TIMEOUT_MS = 5_000;
const CUT = 'cut';

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export interface OpenAiRealtimeConfig {
  model: string;
  apiKey: string;
  baseUrl: string | null;
}

export class OpenAiRealtimeLiveStt implements LiveSttPort {
  readonly id: string;
  readonly ready = true;
  readonly sampleRate = SAMPLE_RATE;

  constructor(
    private readonly cfg: OpenAiRealtimeConfig,
    private readonly socketFactory: RealtimeSocketFactory = nativeRealtimeSocket,
    /** Son regroupé par paquets d'environ `batchMs` avant envoi (moins de messages). */
    private readonly batchMs = 100,
  ) {
    this.id = `openai-realtime:${cfg.model}`;
  }

  open(options: LiveSttOptions): LiveSttSession {
    const batchBytes = Math.max(2, Math.round((SAMPLE_RATE * 2 * this.batchMs) / 1000));
    return new RealtimeSession(this.cfg, options, this.socketFactory, batchBytes);
  }
}

type State = 'connecting' | 'open' | 'failed' | 'closed';

class RealtimeSession implements LiveSttSession {
  private state: State = 'connecting';
  private readonly socket: RealtimeSocket;
  /** Avant l'ouverture : son et coupures, dans l'ordre. */
  private queued: (Uint8Array | typeof CUT)[] = [];
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;
  /** Octets envoyés dans le segment en cours (depuis le dernier commit). */
  private sentInSegment = 0;
  private commits = 0;
  private committedSeen = 0;
  private readonly segmentOfItem = new Map<string, number>();
  private readonly completed = new Set<number>();
  private finishing = false;
  /** Segment dont on attend la fin pour résoudre `finish`. */
  private lastSegment: number | null = null;
  private waiters: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cfg: OpenAiRealtimeConfig,
    private readonly options: LiveSttOptions,
    factory: RealtimeSocketFactory,
    private readonly batchBytes: number,
  ) {
    this.socket = factory(
      realtimeTranscriptionUrl(cfg.baseUrl),
      { Authorization: `Bearer ${cfg.apiKey}` },
      {
        onOpen: () => this.handleOpen(),
        onMessage: (data) => this.handleMessage(data),
        onError: (error) => this.fail(error),
        onClose: (code, reason) => this.handleClose(code, reason),
      },
    );
  }

  append(pcm16le: Uint8Array): void {
    if (!this.accepting() || pcm16le.byteLength === 0) return;
    if (this.state === 'connecting') {
      this.queued.push(pcm16le);
      return;
    }
    this.pending.push(pcm16le);
    this.pendingBytes += pcm16le.byteLength;
    if (this.pendingBytes >= this.batchBytes) this.flush();
  }

  cut(): void {
    if (!this.accepting()) return;
    if (this.state === 'connecting') this.queued.push(CUT);
    else this.commit();
  }

  finish(timeoutMs = DEFAULT_FINISH_TIMEOUT_MS): Promise<void> {
    if (this.state === 'failed' || this.state === 'closed') return Promise.resolve();
    const done = new Promise<void>((resolve) => this.waiters.push(resolve));
    if (!this.finishing) {
      this.finishing = true;
      this.timer = setTimeout(() => this.settle(), timeoutMs);
      if (this.state === 'open') this.finalCommit();
    }
    return done;
  }

  close(): void {
    if (this.state === 'closed') return;
    const wasActive = this.state !== 'failed';
    this.state = 'closed';
    this.queued = [];
    this.pending = [];
    this.pendingBytes = 0;
    this.settle();
    if (wasActive) this.socket.close();
  }

  // ─── Interne ───────────────────────────────────────────────────────────────────────────

  private accepting(): boolean {
    return !this.finishing && (this.state === 'connecting' || this.state === 'open');
  }

  private handleOpen(): void {
    if (this.state !== 'connecting') return;
    this.state = 'open';
    const transcription: Record<string, string> = {
      model: this.cfg.model,
      language: this.options.language ?? 'fr',
    };
    if (this.options.prompt) transcription.prompt = this.options.prompt;
    this.socket.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          type: 'transcription',
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: SAMPLE_RATE },
              transcription,
              turn_detection: null,
            },
          },
        },
      }),
    );
    const queued = this.queued;
    this.queued = [];
    for (const op of queued) {
      if (op === CUT) this.commit();
      else {
        this.pending.push(op);
        this.pendingBytes += op.byteLength;
      }
    }
    this.flush();
    this.options.onReady?.();
    if (this.finishing && this.state === 'open') this.finalCommit();
  }

  private handleMessage(data: string): void {
    if (this.state !== 'open') return;
    const event = parseRealtimeEvent(data);
    switch (event.kind) {
      case 'delta':
        this.options.onDelta(event.text, this.segmentOf(event.itemId));
        return;
      case 'committed':
        this.segmentOf(event.itemId);
        this.committedSeen += 1;
        return;
      case 'completed': {
        const segment = this.segmentOf(event.itemId);
        this.completed.add(segment);
        if (this.lastSegment !== null && this.completed.has(this.lastSegment)) this.settle();
        return;
      }
      case 'failure':
        this.fail(event.error);
        return;
      case 'ignored':
        return;
    }
  }

  /**
   * Segment d'un élément du fournisseur. Un élément encore inconnu est forcément le premier
   * pas encore confirmé par `committed` (les éléments sont clos dans l'ordre des commits).
   */
  private segmentOf(itemId: string | null): number {
    if (itemId === null) return this.committedSeen;
    const known = this.segmentOfItem.get(itemId);
    if (known !== undefined) return known;
    this.segmentOfItem.set(itemId, this.committedSeen);
    return this.committedSeen;
  }

  private handleClose(code: number, reason: string): void {
    if (this.state === 'failed' || this.state === 'closed') return;
    if (this.lastSegment !== null && this.completed.has(this.lastSegment)) {
      this.state = 'closed';
      return;
    }
    this.fail(new Error(`Fournisseur déconnecté (code ${code}${reason ? ` : ${reason}` : ''}).`));
  }

  /** Envoie le son en attente (taille paire : un échantillon fait 2 octets). */
  private flush(): void {
    if (this.state !== 'open' || this.pendingBytes < 2) return;
    const all = concat(this.pending, this.pendingBytes);
    const even = all.byteLength - (all.byteLength % 2);
    for (let offset = 0; offset < even; offset += MAX_APPEND_BYTES) {
      this.sendAudio(all.subarray(offset, Math.min(even, offset + MAX_APPEND_BYTES)));
    }
    const rest = all.subarray(even);
    this.pending = rest.byteLength > 0 ? [rest] : [];
    this.pendingBytes = rest.byteLength;
  }

  private sendAudio(bytes: Uint8Array): void {
    this.socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(bytes) }));
    this.sentInSegment += bytes.byteLength;
  }

  /** Clôt le segment en cours (complété par du silence s'il est trop court pour le fournisseur). */
  private commit(): void {
    this.flush();
    if (this.state !== 'open') return;
    if (this.sentInSegment < MIN_COMMIT_BYTES) {
      this.sendAudio(new Uint8Array(MIN_COMMIT_BYTES - this.sentInSegment));
    }
    this.socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    this.commits += 1;
    this.sentInSegment = 0;
  }

  /** Dernier segment : clos s'il a du son, puis on attend son texte. */
  private finalCommit(): void {
    this.flush();
    if (this.sentInSegment > 0) this.commit();
    this.lastSegment = this.commits - 1;
    if (this.lastSegment < 0 || this.completed.has(this.lastSegment)) this.settle();
  }

  private fail(error: Error): void {
    if (this.state === 'failed' || this.state === 'closed') return;
    this.state = 'failed';
    this.queued = [];
    this.pending = [];
    this.pendingBytes = 0;
    this.settle();
    this.socket.close();
    this.options.onError(error);
  }

  private settle(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve();
  }
}
