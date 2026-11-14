import { useEffect, useRef, useState } from 'react';
import { currentApiUrl } from '@/features/api/client';
import {
  createLiveClient,
  type LiveClient,
  liveFailureAction,
  liveResultText,
  liveTranscriptionUrl,
} from '@/lib/live-transcription';
import { CaptureError } from './capture.types';
import {
  DICTATION_UNAVAILABLE,
  LIVE_FAILED,
  LIVE_KEPT,
  LIVE_MAX_REACHED,
  MIC_REFUSED,
} from './messages';
import { usePcmCapture } from './usePcmCapture';

export type LivePhase = 'idle' | 'recording' | 'finalizing';

/** Attente max du texte définitif après l'arrêt (d'habitude ~1 s). */
export const FINAL_TIMEOUT_MS = 20_000;
/** Connexion pas ouverte au bout de ce délai : on bascule sur l'enregistrement classique. */
export const CONNECT_TIMEOUT_MS = 4_000;

const WS_CONNECTING = 0;

export interface LiveCallbacks {
  /** Texte à AJOUTER au brouillon : le définitif, ou le provisoire en secours. */
  onText(text: string): void;
  onError(message: string): void;
  /** La dictée en direct n'a pas pu démarrer : passer à l'enregistrement transcrit à la fin. */
  onFallback(): void;
}

interface Session {
  client: LiveClient;
  socket: WebSocket | null;
  callbacks: LiveCallbacks;
  settled: boolean;
  timers: ReturnType<typeof setTimeout>[];
  done: Promise<void>;
  resolve: () => void;
}

/**
 * DICTÉE EN DIRECT : le son du micro part en continu vers l'API (WebSocket), le texte
 * provisoire s'affiche mot à mot, puis à l'arrêt le texte définitif de toute la dictée le
 * remplace. Le micro et la connexion démarrent EN MÊME TEMPS ; le son capté avant
 * l'ouverture est gardé en file (`createLiveClient`) : rien n'est perdu.
 */
export function useLiveDictation(onLevel: (level: number) => void) {
  const capture = usePcmCapture();
  const [phase, setPhase] = useState<LivePhase>('idle');
  const [provisional, setProvisional] = useState('');
  const current = useRef<Session | null>(null);

  const settle = (s: Session, text: string, error: string | null, fallback = false) => {
    if (s.settled) return;
    s.settled = true;
    for (const t of s.timers) clearTimeout(t);
    capture.stop();
    try {
      s.socket?.close();
    } catch {
      // Déjà fermée.
    }
    if (current.current === s) {
      current.current = null;
      setPhase('idle');
      setProvisional('');
      onLevel(0);
    }
    if (text) s.callbacks.onText(text);
    if (error) s.callbacks.onError(error);
    if (fallback) s.callbacks.onFallback();
    s.resolve();
  };

  const onFailure = (s: Session, message: string | null) => {
    const { client } = s;
    if (liveFailureAction(client) === 'fallback') {
      settle(s, '', null, true);
      return;
    }
    const kept = client.provisional.trim();
    settle(s, kept, kept ? LIVE_KEPT : (message ?? LIVE_FAILED));
  };

  /** Démarre tout de suite (état « enregistrement » affiché avant même l'accès au micro). */
  const start = (callbacks: LiveCallbacks) => {
    if (current.current) return;
    let resolve = () => {};
    const done = new Promise<void>((r) => {
      resolve = r;
    });
    const client = createLiveClient(
      { send: (data) => s.socket?.send(data) },
      {
        onProvisional: (text) => {
          if (current.current === s) setProvisional(text);
        },
        // Final sans arrêt demandé : durée maximale atteinte, l'API a arrêté et transcrit.
        onFinal: (text) =>
          settle(
            s,
            liveResultText(s.client.provisional, text),
            s.client.stopped ? null : LIVE_MAX_REACHED,
          ),
        onFailure: (message) => onFailure(s, message),
      },
    );
    const s: Session = {
      client,
      socket: null,
      callbacks,
      settled: false,
      timers: [],
      done,
      resolve,
    };
    current.current = s;
    setPhase('recording');
    setProvisional('');

    try {
      const socket = new WebSocket(liveTranscriptionUrl(currentApiUrl()));
      socket.binaryType = 'arraybuffer';
      socket.onopen = () => client.opened();
      socket.onmessage = (e: MessageEvent) => client.received(e.data);
      socket.onclose = () => client.closed();
      s.socket = socket;
      s.timers.push(
        setTimeout(() => {
          if (socket.readyState === WS_CONNECTING) client.closed();
        }, CONNECT_TIMEOUT_MS),
      );
    } catch {
      client.closed();
    }
    if (s.settled) return;

    capture.start({ onChunk: (chunk) => client.sendAudio(chunk), onLevel }).catch((e: unknown) => {
      const refused = e instanceof CaptureError && e.kind === 'refused';
      settle(s, '', refused ? MIC_REFUSED : DICTATION_UNAVAILABLE);
    });
  };

  /** Arrête le micro ; se résout quand le texte (définitif ou de secours) est ajouté. */
  const stop = (): Promise<void> => {
    const s = current.current;
    if (!s) return Promise.resolve();
    if (!s.client.stopped) {
      capture.stop(); // le son restant part avant le message d'arrêt
      s.client.stop();
      setPhase('finalizing');
      onLevel(0);
      s.timers.push(
        setTimeout(() => {
          const kept = s.client.provisional.trim();
          settle(s, kept, kept ? LIVE_KEPT : LIVE_FAILED);
        }, FINAL_TIMEOUT_MS),
      );
    }
    return s.done;
  };

  // Écran fermé en pleine dictée (ex. déconnexion) : on arrête proprement, le texte définitif
  // arrive quand même dans le brouillon (gardé en mémoire).
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  });
  useEffect(() => () => void stopRef.current(), []);

  return { phase, provisional, start, stop };
}
