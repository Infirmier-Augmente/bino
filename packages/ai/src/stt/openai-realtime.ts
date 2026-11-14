import { z } from 'zod';
import type { LiveSttOptions, LiveSttPort, LiveSttSession } from './live-port';

/**
 * TRANSCRIPTION EN DIRECT via l'API Realtime d'OpenAI (session de type « transcription »).
 * Le son est relayé par NOTRE serveur : la clé ne quitte jamais l'API.
 * Mesures et choix : `gpt-live-transcribe` streame le texte pendant l'envoi (sans VAD serveur,
 * `turn_detection: null` obligatoire) ; `input_audio_buffer.commit` à la fin pour le dernier mot.
 */

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const SAMPLE_RATE = 24_000;
/** En dessous, OpenAI refuse le commit (« buffer too small ») : on ne le demande pas. */
const MIN_COMMIT_BYTES = (SAMPLE_RATE * 2) / 10;
/** Taille max d'un `input_audio_buffer.append` (la limite OpenAI est de 15 Mio en base64). */
const MAX_APPEND_BYTES = 512 * 1024;
const DEFAULT_FINISH_TIMEOUT_MS = 5_000;

// ─── Socket injectable (WebSocket natif de Node par défaut, faux en test) ──────────────────

export interface RealtimeSocketHandlers {
  onOpen(): void;
  onMessage(data: string): void;
  onError(error: Error): void;
  onClose(code: number, reason: string): void;
}

export interface RealtimeSocket {
  send(data: string): void;
  close(): void;
}

/** Les rappels ne doivent pas être appelés pendant la construction (toujours plus tard). */
export type RealtimeSocketFactory = (
  url: string,
  headers: Record<string, string>,
  handlers: RealtimeSocketHandlers,
) => RealtimeSocket;

export const nativeRealtimeSocket: RealtimeSocketFactory = (url, headers, handlers) => {
  // Node ≥ 22 : le WebSocket natif (undici) accepte des en-têtes, contrairement au navigateur.
  const ws = new WebSocket(url, { headers });
  ws.onopen = () => handlers.onOpen();
  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') handlers.onMessage(ev.data);
  };
  ws.onerror = (ev) => {
    const message = 'message' in ev && typeof ev.message === 'string' ? ev.message : '';
    handlers.onError(new Error(`WebSocket fournisseur : ${message || 'connexion impossible'}`));
  };
  ws.onclose = (ev) => handlers.onClose(ev.code, ev.reason);
  return {
    send: (data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    },
    close: () => {
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close();
    },
  };
};

// ─── Évènements du fournisseur (frontière : validés avec zod) ──────────────────────────────

const ProviderEvent = z.object({ type: z.string() });
const DeltaEvent = z.object({ delta: z.string() });
const CompletedEvent = z.object({ transcript: z.string() });
const ErrorEvent = z.object({
  error: z.object({ message: z.string().optional(), code: z.string().nullish() }).nullish(),
});

const EVENT = {
  delta: 'conversation.item.input_audio_transcription.delta',
  completed: 'conversation.item.input_audio_transcription.completed',
  failed: 'conversation.item.input_audio_transcription.failed',
  error: 'error',
} as const;

function providerError(raw: unknown, fallback: string): Error {
  const parsed = ErrorEvent.safeParse(raw);
  const e = parsed.success ? parsed.data.error : null;
  const detail = [e?.code, e?.message].filter(Boolean).join(' : ');
  return new Error(detail ? `${fallback} (${detail})` : fallback);
}

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

/** URL WebSocket Realtime (transcription) à partir de l'URL HTTP de l'API (`STT_BASE_URL`). */
export function realtimeTranscriptionUrl(baseUrl: string | null): string {
  const base = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '').replace(/^http/, 'ws');
  return `${base}/realtime?intent=transcription`;
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
    return new RealtimeSession(
      this.cfg,
      options,
      this.socketFactory,
      Math.max(2, Math.round((SAMPLE_RATE * 2 * this.batchMs) / 1000)),
    );
  }
}

type State = 'connecting' | 'open' | 'failed' | 'closed';

class RealtimeSession implements LiveSttSession {
  private state: State = 'connecting';
  private readonly socket: RealtimeSocket;
  private pending: Uint8Array[] = [];
  private pendingBytes = 0;
  private sentBytes = 0;
  private finishing = false;
  private committed = false;
  private completed = false;
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
    if (this.finishing || this.state === 'failed' || this.state === 'closed') return;
    if (pcm16le.byteLength === 0) return;
    this.pending.push(pcm16le);
    this.pendingBytes += pcm16le.byteLength;
    if (this.state === 'open' && this.pendingBytes >= this.batchBytes) this.flush();
  }

  finish(timeoutMs = DEFAULT_FINISH_TIMEOUT_MS): Promise<void> {
    if (this.state === 'failed' || this.state === 'closed' || this.completed) {
      return Promise.resolve();
    }
    const done = new Promise<void>((resolve) => this.waiters.push(resolve));
    if (!this.finishing) {
      this.finishing = true;
      this.timer = setTimeout(() => this.settle(), timeoutMs);
      if (this.state === 'open') this.commit();
    }
    return done;
  }

  close(): void {
    if (this.state === 'closed') return;
    const wasActive = this.state !== 'failed';
    this.state = 'closed';
    this.pending = [];
    this.pendingBytes = 0;
    this.settle();
    if (wasActive) this.socket.close();
  }

  // ─── Interne ───────────────────────────────────────────────────────────────────────────

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
    this.flush();
    this.options.onReady?.();
    if (this.finishing && this.state === 'open') this.commit();
  }

  private handleMessage(data: string): void {
    if (this.state !== 'open') return;
    let raw: unknown;
    try {
      raw = JSON.parse(data);
    } catch {
      this.fail(new Error('Message illisible du fournisseur de transcription en direct.'));
      return;
    }
    const event = ProviderEvent.safeParse(raw);
    if (!event.success) return;
    switch (event.data.type) {
      case EVENT.delta: {
        const delta = DeltaEvent.safeParse(raw);
        if (delta.success && delta.data.delta) this.options.onDelta(delta.data.delta);
        return;
      }
      case EVENT.completed: {
        if (CompletedEvent.safeParse(raw).success && this.committed) {
          this.completed = true;
          this.settle();
        }
        return;
      }
      case EVENT.failed:
        this.fail(providerError(raw, 'Transcription en direct échouée'));
        return;
      case EVENT.error:
        this.fail(providerError(raw, 'Erreur du fournisseur de transcription en direct'));
        return;
      default:
        return; // session.created, session.updated, input_audio_buffer.committed…
    }
  }

  private handleClose(code: number, reason: string): void {
    if (this.state === 'failed' || this.state === 'closed') return;
    if (this.completed) {
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
      const part = all.subarray(offset, Math.min(even, offset + MAX_APPEND_BYTES));
      this.socket.send(
        JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(part) }),
      );
    }
    this.sentBytes += even;
    const rest = all.subarray(even);
    this.pending = rest.byteLength > 0 ? [rest] : [];
    this.pendingBytes = rest.byteLength;
  }

  private commit(): void {
    this.flush();
    if (this.sentBytes < MIN_COMMIT_BYTES) {
      this.settle();
      return;
    }
    this.committed = true;
    this.socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
  }

  private fail(error: Error): void {
    if (this.state === 'failed' || this.state === 'closed') return;
    this.state = 'failed';
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
