import { LIVE_TRANSCRIPTION_PATH, LiveServerMessage } from '@infirmier/domain';
import { type LiveSegments, liveDisplayText, reduceSegments } from './live-segments';

/**
 * DICTÉE EN DIRECT, côté app (logique pure). Le son part vers NOTRE API par WebSocket
 * (jamais vers un fournisseur d'IA) ; l'API renvoie, segment par segment (pauses de la voix),
 * un texte provisoire mot à mot puis le texte définitif qui le remplace ; à l'arrêt, `final`
 * = tous les segments définitifs bout à bout.
 */

/** `http://hote:8787` → `ws://hote:8787/transcriptions/live` (`https` → `wss`). */
export function liveTranscriptionUrl(apiUrl: string): string {
  const base = apiUrl.trim().replace(/\/+$/, '');
  return `${base.replace(/^http(s?):\/\//i, (_m, s: string) => `ws${s}://`)}${LIVE_TRANSCRIPTION_PATH}`;
}

/** Message texte reçu de l'API, validé par le schéma partagé ; `null` si illisible. */
export function parseLiveMessage(data: unknown): LiveServerMessage | null {
  if (typeof data !== 'string') return null;
  try {
    const parsed = LiveServerMessage.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Ce qui est envoyé sur la connexion (son binaire ou message texte). */
export interface LiveSink {
  send(data: ArrayBuffer | string): void;
}

export interface LiveClientHandlers {
  /** Segments à afficher (définitif s'il est arrivé, sinon provisoire). */
  onSegments(segments: LiveSegments): void;
  /** Texte définitif de toute la dictée (fin de la session). */
  onFinal(text: string): void;
  /** Erreur annoncée par l'API, ou connexion fermée sans texte définitif. */
  onFailure(message: string | null): void;
}

/**
 * Client de la dictée en direct, indépendant du WebSocket (testable) : le son capté avant
 * l'ouverture de la connexion est gardé en file et envoyé dès l'ouverture, dans l'ordre :
 * rien de ce qui est dit juste après le toucher n'est perdu.
 */
export function createLiveClient(sink: LiveSink, handlers: LiveClientHandlers) {
  const queue: (ArrayBuffer | string)[] = [];
  let open = false;
  let stopped = false;
  let settled = false;
  let ready = false;
  let segments: LiveSegments = [];

  const emit = (data: ArrayBuffer | string) => {
    if (open) sink.send(data);
    else queue.push(data);
  };
  const fail = (message: string | null) => {
    if (settled) return;
    settled = true;
    handlers.onFailure(message);
  };

  return {
    /** Trame de son (PCM 16 bits mono 24 kHz). Ignorée après l'arrêt. */
    sendAudio(chunk: ArrayBuffer) {
      if (!stopped && !settled) emit(chunk);
    },
    /** Fin de la dictée : l'API termine le dernier segment et renvoie le texte définitif. */
    stop() {
      if (stopped || settled) return;
      stopped = true;
      emit(JSON.stringify({ type: 'stop' }));
    },
    opened() {
      open = true;
      for (const data of queue.splice(0)) sink.send(data);
    },
    received(data: unknown) {
      const msg = parseLiveMessage(data);
      if (!msg || settled) return;
      if (msg.type === 'ready') ready = true;
      else if (msg.type === 'delta' || msg.type === 'segment') {
        ready = true;
        const next = reduceSegments(segments, msg);
        if (next !== segments) {
          segments = next;
          handlers.onSegments(segments);
        }
      } else if (msg.type === 'final') {
        settled = true;
        handlers.onFinal(msg.text);
      } else fail(msg.message);
    },
    closed() {
      fail(null);
    },
    /** La session est ouverte chez le fournisseur (ou du texte est déjà arrivé). */
    get ready() {
      return ready;
    },
    get stopped() {
      return stopped;
    },
    get segments() {
      return segments;
    },
    /** Texte affiché : définitif là où il est arrivé, provisoire ailleurs. */
    get text() {
      return liveDisplayText(segments);
    },
  };
}

export type LiveClient = ReturnType<typeof createLiveClient>;

/**
 * Texte ajouté au compte rendu en fin de dictée : le définitif (tous les segments définitifs) ;
 * sinon ce qui est affiché (définitif là où il est arrivé, provisoire ailleurs).
 */
export function liveResultText(displayed: string, final: string | null): string {
  const best = final?.trim() ?? '';
  return best || displayed.trim();
}

/**
 * Que faire quand la dictée en direct échoue : si la session n'a jamais démarré et que l'IDE
 * parle encore, on bascule sans rien dire sur l'enregistrement transcrit à la fin ; sinon on
 * garde le texte affiché (elle le relit).
 */
export function liveFailureAction(s: {
  ready: boolean;
  stopped: boolean;
  text: string;
}): 'fallback' | 'keep-provisional' {
  return !s.ready && !s.stopped && !s.text.trim() ? 'fallback' : 'keep-provisional';
}

/** Durée d'enregistrement affichée : « 0:07 », « 1:23 », « 12:05 ». */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}
