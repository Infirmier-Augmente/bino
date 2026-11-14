import { z } from 'zod';

/**
 * TRANSCRIPTION EN DIRECT — protocole WebSocket entre l'app et l'API (hors contrat JSON, comme
 * `POST /transcriptions`). L'app n'appelle JAMAIS un fournisseur d'IA : elle envoie le son à
 * l'API, qui garde les clés et reste indépendante du fournisseur (port `LiveSttPort`).
 *
 * Déroulé :
 *   1. l'app ouvre `ws(s)://<api>/transcriptions/live` et envoie aussitôt le son du micro
 *      (trames BINAIRES : PCM 16 bits little-endian, mono, 24 kHz), sans attendre « ready » ;
 *   2. l'API renvoie des `delta` : texte PROVISOIRE, à ajouter bout à bout pendant la dictée ;
 *   3. à l'arrêt, l'app envoie `{"type":"stop"}` ; l'API retranscrit TOUT l'enregistrement avec
 *      le meilleur modèle (contexte complet, nombres en chiffres) et renvoie `final`, qui
 *      REMPLACE le texte provisoire ; puis l'API ferme la connexion.
 *   4. `error` : l'app garde ce qu'elle a et propose de réessayer.
 */

export const LIVE_TRANSCRIPTION_PATH = '/transcriptions/live';

/** Format du son envoyé par l'app (trames binaires). */
export const LIVE_AUDIO_FORMAT = {
  sampleRate: 24_000,
  channels: 1,
  encoding: 'pcm16le',
} as const;

/** Durée maximale d'une dictée en direct (au-delà, l'API arrête et transcrit). */
export const LIVE_MAX_SECONDS = 300;

/** Message texte de l'app vers l'API. */
export const LiveClientMessage = z.object({ type: z.literal('stop') });
export type LiveClientMessage = z.infer<typeof LiveClientMessage>;

/** Messages de l'API vers l'app. */
export const LiveServerMessage = z.discriminatedUnion('type', [
  /** Session ouverte chez le fournisseur (le son reçu avant est gardé, rien n'est perdu). */
  z.object({ type: z.literal('ready'), engine: z.string() }),
  /** Morceau de texte provisoire, à concaténer. */
  z.object({ type: z.literal('delta'), text: z.string() }),
  /** Texte définitif de toute la dictée : remplace le provisoire. */
  z.object({
    type: z.literal('final'),
    text: z.string(),
    durationSec: z.number().nonnegative().nullable(),
    engine: z.string(),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type LiveServerMessage = z.infer<typeof LiveServerMessage>;
