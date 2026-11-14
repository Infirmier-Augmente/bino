import { z } from 'zod';

/** Identifiant opaque (uuid, slug de scénario…). */
export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

/** Horodatage ISO 8601 avec fuseau, ex. "2026-11-14T16:05:00+01:00". */
export const IsoDateTime = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** Date ISO, ex. "1959-03-02". */
export const IsoDate = z.iso.date();
export type IsoDate = z.infer<typeof IsoDate>;

/**
 * Appareils (systèmes) utilisés pour ranger l'information.
 * Trame de relève "par appareil" du kit Foch + douleur, psy et général.
 */
export const Appareil = z.enum([
  'neuro',
  'respiratoire',
  'hemodynamique',
  'digestif',
  'renal',
  'cutane',
  'dispositifs',
  'douleur',
  'psy',
  'general',
]);
export type Appareil = z.infer<typeof Appareil>;

export const APPAREIL_LABELS: Record<Appareil, string> = {
  neuro: 'Neuro',
  respiratoire: 'Respiratoire',
  hemodynamique: 'Hémodynamique',
  digestif: 'Digestif',
  renal: 'Rénal / urinaire',
  cutane: 'Cutané',
  dispositifs: 'Dispositifs',
  douleur: 'Douleur',
  psy: 'Psychique / comportement',
  general: 'Général',
};

/** Ordre d'affichage des appareils dans une fiche de relève. */
export const APPAREIL_ORDER: readonly Appareil[] = [
  'neuro',
  'respiratoire',
  'hemodynamique',
  'digestif',
  'renal',
  'cutane',
  'dispositifs',
  'douleur',
  'psy',
  'general',
];

/**
 * D'où vient une information. Règle produit : AUCUNE information affichée sans source.
 * - dictation : extrait verbatim d'une dictée (offsets dans le transcript)
 * - record    : donnée du dossier patient (DPI simulé)
 * - nurse     : saisie ou correction manuelle de l'IDE
 */
export const SourceRef = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('dictation'),
    transmissionId: Id,
    quote: z.string(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('record'),
    field: z.string(),
    label: z.string(),
  }),
  z.object({
    kind: z.literal('nurse'),
    nurseId: Id,
    at: IsoDateTime,
  }),
]);
export type SourceRef = z.infer<typeof SourceRef>;

/** Une phrase affichable, toujours rattachée à au moins une source. */
export const SourcedItem = z.object({
  id: Id,
  text: z.string().min(1),
  sources: z.array(SourceRef).min(1),
  /** true si l'IDE a modifié la formulation proposée. */
  edited: z.boolean(),
});
export type SourcedItem = z.infer<typeof SourcedItem>;

/** Item clinique rangé par appareil (surveillance, soin de routine…). */
export const ClinicalItem = SourcedItem.extend({
  appareil: Appareil,
});
export type ClinicalItem = z.infer<typeof ClinicalItem>;
