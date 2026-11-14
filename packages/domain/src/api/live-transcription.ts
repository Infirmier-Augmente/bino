import { z } from 'zod';

/**
 * TRANSCRIPTION EN DIRECT — protocole WebSocket entre l'app et l'API (hors contrat JSON, comme
 * `POST /transcriptions`). L'app n'appelle JAMAIS un fournisseur d'IA : elle envoie le son à
 * l'API, qui garde les clés et reste indépendante du fournisseur (port `LiveSttPort`).
 *
 * Déroulé (dictée découpée en SEGMENTS aux pauses de la voix) :
 *   1. l'app ouvre `ws(s)://<api>/transcriptions/live` et envoie aussitôt le son du micro
 *      (trames BINAIRES : PCM 16 bits little-endian, mono, 24 kHz), sans attendre « ready » ;
 *   2. l'API découpe le son aux pauses (`LIVE_SEGMENTATION`) : segments 0, 1, 2…
 *   3. pendant qu'on parle, `delta` = texte PROVISOIRE d'un segment, à ajouter bout à bout
 *      au texte provisoire de CE segment ;
 *   4. dès qu'un segment est terminé (pause), l'API le retranscrit avec le meilleur modèle
 *      (nombres en chiffres, texte déjà finalisé donné en contexte) et envoie `segment` : son
 *      texte DÉFINITIF, qui remplace le provisoire de ce segment (pendant la dictée) ;
 *   5. à l'arrêt, l'app envoie `{"type":"stop"}` ; l'API termine le dernier segment, puis envoie
 *      `final` = tous les segments définitifs bout à bout (même texte que l'écran), et ferme.
 *   6. `error` : l'app garde ce qu'elle a (provisoire compris) et propose de réessayer.
 *
 * Affichage : pour chaque segment, le définitif s'il est arrivé, sinon le provisoire.
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

/** Découpage en segments, côté API : à une pause de la voix, ou au plus tard après 15 s. */
export const LIVE_SEGMENTATION = {
  /** Silence qui termine un segment. */
  pauseMs: 700,
  /**
   * Pas de segment plus court : un segment isolé trop court perd le contexte (mesuré : 1,8 s
   * « pouls cent huit » → « Pouce en huit » à chaque essai, juste une fois fusionné).
   */
  minSegmentMs: 3_000,
  /** Au-delà, on coupe au moment le plus calme des dernières secondes. */
  maxSegmentMs: 15_000,
} as const;

/** Message texte de l'app vers l'API. */
export const LiveClientMessage = z.object({ type: z.literal('stop') });
export type LiveClientMessage = z.infer<typeof LiveClientMessage>;

const SegmentIndex = z.number().int().nonnegative();

/** Messages de l'API vers l'app. */
export const LiveServerMessage = z.discriminatedUnion('type', [
  /** Session ouverte chez le fournisseur (le son reçu avant est gardé, rien n'est perdu). */
  z.object({ type: z.literal('ready'), engine: z.string() }),
  /** Morceau de texte provisoire du segment `segment`, à concaténer. */
  z.object({ type: z.literal('delta'), segment: SegmentIndex, text: z.string() }),
  /** Texte définitif du segment `segment` : remplace son provisoire. */
  z.object({
    type: z.literal('segment'),
    segment: SegmentIndex,
    text: z.string(),
    engine: z.string(),
  }),
  /** Texte définitif de toute la dictée (segments bout à bout) : fin de la session. */
  z.object({
    type: z.literal('final'),
    text: z.string(),
    durationSec: z.number().nonnegative().nullable(),
    engine: z.string(),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type LiveServerMessage = z.infer<typeof LiveServerMessage>;
