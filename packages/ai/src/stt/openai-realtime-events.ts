import { z } from 'zod';

/**
 * Transport et évènements de l'API Realtime d'OpenAI (transcription), validés avec zod à la
 * frontière. Le socket est injectable : WebSocket natif de Node par défaut, faux en test.
 */

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

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** URL WebSocket Realtime (transcription) à partir de l'URL HTTP de l'API (`STT_BASE_URL`). */
export function realtimeTranscriptionUrl(baseUrl: string | null): string {
  const base = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '').replace(/^http/, 'ws');
  return `${base}/realtime?intent=transcription`;
}

// ─── Évènements reçus ──────────────────────────────────────────────────────────────────────

const ItemId = z.string().min(1);
const Base = z.object({ type: z.string() });
const Delta = z.object({ delta: z.string(), item_id: ItemId.optional() });
const Committed = z.object({ item_id: ItemId });
const Completed = z.object({ transcript: z.string(), item_id: ItemId.optional() });
const ErrorBody = z.object({
  error: z.object({ message: z.string().optional(), code: z.string().nullish() }).nullish(),
});

export type RealtimeEvent =
  /** Texte provisoire ; `itemId` = l'élément (le segment) auquel il appartient. */
  | { kind: 'delta'; itemId: string | null; text: string }
  /** Le son reçu jusqu'au commit forme l'élément `itemId` (dans l'ordre des commits). */
  | { kind: 'committed'; itemId: string }
  | { kind: 'completed'; itemId: string | null }
  | { kind: 'failure'; error: Error }
  | { kind: 'ignored' };

function providerError(raw: unknown, fallback: string): Error {
  const parsed = ErrorBody.safeParse(raw);
  const e = parsed.success ? parsed.data.error : null;
  const detail = [e?.code, e?.message].filter(Boolean).join(' : ');
  return new Error(detail ? `${fallback} (${detail})` : fallback);
}

export function parseRealtimeEvent(data: string): RealtimeEvent {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return {
      kind: 'failure',
      error: new Error('Message illisible du fournisseur de transcription en direct.'),
    };
  }
  const base = Base.safeParse(raw);
  if (!base.success) return { kind: 'ignored' };
  switch (base.data.type) {
    case 'conversation.item.input_audio_transcription.delta': {
      const d = Delta.safeParse(raw);
      return d.success && d.data.delta
        ? { kind: 'delta', itemId: d.data.item_id ?? null, text: d.data.delta }
        : { kind: 'ignored' };
    }
    case 'input_audio_buffer.committed': {
      const c = Committed.safeParse(raw);
      return c.success ? { kind: 'committed', itemId: c.data.item_id } : { kind: 'ignored' };
    }
    case 'conversation.item.input_audio_transcription.completed': {
      const c = Completed.safeParse(raw);
      return c.success
        ? { kind: 'completed', itemId: c.data.item_id ?? null }
        : { kind: 'ignored' };
    }
    case 'conversation.item.input_audio_transcription.failed':
      return { kind: 'failure', error: providerError(raw, 'Transcription en direct échouée') };
    case 'error':
      return {
        kind: 'failure',
        error: providerError(raw, 'Erreur du fournisseur de transcription en direct'),
      };
    default:
      return { kind: 'ignored' }; // session.created, session.updated, conversation.item.added…
  }
}
