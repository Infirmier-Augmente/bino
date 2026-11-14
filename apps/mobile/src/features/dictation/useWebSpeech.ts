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

const ERRORS: Record<string, string> = {
  'not-allowed': 'Micro refusé : autorise-le dans le navigateur.',
  'no-speech': 'Rien entendu. Réessaie un peu plus près du micro.',
  network: 'Reconnaissance vocale indisponible (réseau).',
  'audio-capture': 'Aucun micro détecté.',
};

/**
 * Reconnaissance vocale du navigateur : le texte s'affiche PENDANT la dictée
 * ("dicter et voir en direct ce qui est écrit").
 */
export function useWebSpeech(lang = 'fr-FR') {
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef('');
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(
    (initial = '') => {
      const Ctor = getCtor();
      if (!Ctor) {
        setError('Reconnaissance vocale non disponible dans ce navigateur.');
        return;
      }
      finalRef.current = initial ? `${initial.trim()} ` : '';
      setFinalText(finalRef.current);
      setInterim('');
      setError(null);
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let pending = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const text = r?.[0]?.transcript ?? '';
          if (r?.isFinal) finalRef.current += `${text.trim()} `;
          else pending += text;
        }
        setFinalText(finalRef.current);
        setInterim(pending);
      };
      rec.onerror = (e) => setError(ERRORS[e.error] ?? `Erreur de reconnaissance (${e.error}).`);
      rec.onend = () => {
        setListening(false);
        setInterim('');
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    },
    [lang],
  );

  useEffect(() => () => recRef.current?.abort(), []);

  return {
    listening,
    text: `${finalText}${interim}`.trim(),
    finalText: finalText.trim(),
    interim,
    error,
    start,
    stop,
  };
}
