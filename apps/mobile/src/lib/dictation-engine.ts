/** Moteur qui transforme la voix en texte dans la fiche « Nouveau compte rendu ». */
export type DictationEngine = 'server' | 'web-speech' | 'keyboard';

export interface DictationEngineInputs {
  /** Transcription configurée côté API (`STT_PROVIDER` ≠ none : OpenAI, Groq, auto-hébergé…). */
  serverSttReady: boolean;
  /** Reconnaissance vocale du navigateur disponible (web uniquement). */
  webSpeechAvailable: boolean;
}

/**
 * La transcription serveur passe en premier dès qu'elle est configurée : même moteur sur
 * tous les appareils, vocabulaire soignant transmis au modèle. La reconnaissance du
 * navigateur ne sert qu'en secours (Chrome Android répète des mots en mode continu).
 */
export function chooseDictationEngine({
  serverSttReady,
  webSpeechAvailable,
}: DictationEngineInputs): DictationEngine {
  if (serverSttReady) return 'server';
  if (webSpeechAvailable) return 'web-speech';
  return 'keyboard';
}
