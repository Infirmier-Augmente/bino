/**
 * PORT SPEECH-TO-TEXT EN DIRECT (côté serveur) : texte PROVISOIRE pendant la dictée, par
 * SEGMENT. Un segment = le son ajouté entre deux `cut()` (numérotés 0, 1, 2… dans l'ordre).
 * Le texte définitif de chaque segment vient du port fichier (`SttPort`) : ce port ne sert
 * qu'à l'affichage au fil de l'eau. Indépendant du fournisseur (adaptateur OpenAI Realtime).
 */

export interface LiveSttOptions {
  /** Code langue BCP-47 court, "fr" par défaut. */
  language?: string;
  /** Vocabulaire à favoriser (lexique soignant). */
  prompt?: string;
  /** Session ouverte chez le fournisseur (le son ajouté avant est gardé et envoyé). */
  onReady?: () => void;
  /**
   * Morceau de texte provisoire du segment `segment`, à concaténer. Un fournisseur en retard
   * peut encore en envoyer pour un segment déjà coupé : l'index reste juste.
   */
  onDelta: (text: string, segment: number) => void;
  /** Échec du fournisseur : la session est morte (une seule fois). */
  onError: (error: Error) => void;
}

export interface LiveSttSession {
  /** Ajoute du son PCM 16 bits little-endian mono (au débit `sampleRate` du port). */
  append(pcm16le: Uint8Array): void;
  /** Termine le segment en cours : le son qui suit appartient au segment suivant. */
  cut(): void;
  /**
   * Fin du son : termine le dernier segment et attend son texte provisoire (ou `timeoutMs`).
   * Ne rejette jamais ; se résout aussi si la session est fermée ou en échec.
   */
  finish(timeoutMs?: number): Promise<void>;
  /** Ferme la session (idempotent). Plus aucun rappel ensuite. */
  close(): void;
}

export interface LiveSttPort {
  readonly id: string;
  readonly ready: boolean;
  /** Débit attendu par `append` (Hz). */
  readonly sampleRate: number;
  open(options: LiveSttOptions): LiveSttSession;
}

export class NoLiveStt implements LiveSttPort {
  readonly id = 'none';
  readonly ready = false;
  readonly sampleRate = 24_000;
  open(): LiveSttSession {
    throw new Error(
      'Aucune transcription en direct configurée (STT_PROVIDER=openai et STT_LIVE_MODEL requis).',
    );
  }
}
