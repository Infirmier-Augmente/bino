/** Moteur qui transforme la voix en texte dans la fiche « Nouveau compte rendu ». */
export type DictationEngine = 'live' | 'server' | 'web-speech' | 'keyboard';

export interface DictationEngineInputs {
  /** Transcription en direct configurée côté API (texte pendant la dictée, `sttLive`). */
  liveSttReady: boolean;
  /** Transcription configurée côté API (`STT_PROVIDER` ≠ none : OpenAI, Groq, auto-hébergé…). */
  serverSttReady: boolean;
  /** Reconnaissance vocale du navigateur disponible (web uniquement). */
  webSpeechAvailable: boolean;
}

/**
 * La dictée en direct passe en premier : texte mot à mot pendant la dictée, puis texte
 * définitif retranscrit par le serveur. Sinon la transcription serveur à la fin (même moteur
 * sur tous les appareils, vocabulaire soignant transmis au modèle). La reconnaissance du
 * navigateur ne sert qu'en secours (Chrome Android répète des mots en mode continu).
 */
export function chooseDictationEngine({
  liveSttReady,
  serverSttReady,
  webSpeechAvailable,
}: DictationEngineInputs): DictationEngine {
  if (liveSttReady) return 'live';
  if (serverSttReady) return 'server';
  if (webSpeechAvailable) return 'web-speech';
  return 'keyboard';
}
