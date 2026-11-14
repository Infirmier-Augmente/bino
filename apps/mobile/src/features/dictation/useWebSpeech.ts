import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Types minimaux de la Web Speech API (absente des types DOM standards).
interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}
interface SpeechEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: SpeechResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const webSpeechSupported = (): boolean => getCtor() !== null;

export interface WebSpeechHandlers {
  /** Un morceau de phrase reconnu définitivement (à ajouter à la fin du texte). */
  onFinal(text: string): void;
  onError(kind: 'not-allowed' | 'other'): void;
}

/**
 * Reconnaissance vocale du navigateur : la transcription partielle s'affiche pendant la
 * dictée, chaque phrase reconnue est transmise à `onFinal`.
 */
export function useWebSpeech(lang = 'fr-FR') {
  const recRef = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(
    (handlers: WebSpeechHandlers) => {
      const Ctor = getCtor();
      if (!Ctor) {
        handlers.onError('other');
        return;
      }
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let pending = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const text = r?.[0]?.transcript ?? '';
          if (r?.isFinal) {
            if (text.trim()) handlers.onFinal(text.trim());
          } else pending += text;
        }
        setInterim(pending);
      };
      rec.onerror = (e) => {
        if (e.error === 'aborted' || e.error === 'no-speech') return;
        handlers.onError(
          e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'not-allowed' : 'other',
        );
      };
      rec.onend = () => {
        setListening(false);
        setInterim('');
        recRef.current = null;
      };
      recRef.current = rec;
      try {
        rec.start();
        setListening(true);
      } catch {
        handlers.onError('other');
      }
    },
    [lang],
  );

  useEffect(() => () => recRef.current?.abort(), []);

  return { listening, interim, start, stop };
}
