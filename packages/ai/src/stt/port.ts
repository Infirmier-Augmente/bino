/**
 * PORT SPEECH-TO-TEXT (côté serveur). Optionnel : sans STT serveur, l'app utilise
 * la reconnaissance vocale du navigateur ou la dictée du clavier du téléphone.
 */
export interface TranscriptionRequest {
  audio: Uint8Array;
  mimeType: string;
  /** Code langue BCP-47 court, "fr" par défaut. */
  language?: string;
  /** Vocabulaire à favoriser (lexique soignant). */
  prompt?: string;
  signal?: AbortSignal;
}

export interface TranscriptionResult {
  text: string;
  durationSec: number | null;
}

export interface SttPort {
  readonly id: string;
  readonly ready: boolean;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export class NoStt implements SttPort {
  readonly id = 'none';
  readonly ready = false;
  async transcribe(): Promise<TranscriptionResult> {
    throw new Error(
      'Aucun speech-to-text serveur configuré (STT_PROVIDER=none). Utilise la dictée du clavier ou du navigateur.',
    );
  }
}
