import { z } from 'zod';
import { Appareil, ClinicalItem, Id, IsoDateTime, SourcedItem, SourceRef } from './common';
import { TransverseField } from './hospital';

/** Évaluation de gravité d'une cible : une SUGGESTION, jamais un verdict. */
export const SeverityLevel = z.enum(['routine', 'surveillance', 'preoccupant', 'urgent']);
export type SeverityLevel = z.infer<typeof SeverityLevel>;

export const SEVERITY_RANK: Record<SeverityLevel, number> = {
  routine: 0,
  surveillance: 1,
  preoccupant: 2,
  urgent: 3,
};

export const Severity = z.object({
  level: SeverityLevel,
  /** 0..1, null si le moteur ne fournit pas de confiance calibrée. */
  confidence: z.number().min(0).max(1).nullable(),
  engine: z.string(),
});
export type Severity = z.infer<typeof Severity>;

/** Transmission ciblée : Cible + Données / Actions / Résultats. */
export const DarTarget = z.object({
  id: Id,
  label: z.string().min(1),
  appareil: Appareil,
  data: z.array(SourcedItem),
  actions: z.array(SourcedItem),
  results: z.array(SourcedItem),
  severity: Severity.nullable(),
});
export type DarTarget = z.infer<typeof DarTarget>;

export const TransverseUpdate = SourcedItem.extend({
  field: TransverseField,
});
export type TransverseUpdate = z.infer<typeof TransverseUpdate>;

/** Macro-cible d'entrée (mode admission) : lève le blocage "pas de cible adaptée". */
export const AdmissionContent = z.object({
  motif: z.array(SourcedItem),
  antecedents: z.array(SourcedItem),
  histoire: z.array(SourcedItem),
  autonomie: z.array(SourcedItem),
  contexte: z.array(SourcedItem),
});
export type AdmissionContent = z.infer<typeof AdmissionContent>;

export const TransmissionContent = z.object({
  /** Cibles DAR (événements, problèmes, changements d'état). */
  targets: z.array(DarTarget),
  /** Paramètres de surveillance par appareil (pas de cible). */
  observations: z.array(ClinicalItem),
  /** Soins de routine → diagramme de soins (pas de cible). */
  routine: z.array(ClinicalItem),
  /** "Potentiellement à faire", formulé au conditionnel, tel que dicté. */
  todos: z.array(SourcedItem),
  /** Infos transverses (allergies, précautions, examens…) mentionnées dans la dictée. */
  transverse: z.array(TransverseUpdate),
  admission: AdmissionContent.nullable(),
});
export type TransmissionContent = z.infer<typeof TransmissionContent>;

export function emptyContent(): TransmissionContent {
  return { targets: [], observations: [], routine: [], todos: [], transverse: [], admission: null };
}

/**
 * Signalement = une QUESTION posée à l'infirmière, jamais un verdict.
 * ("Résultat non renseigné : quelle réévaluation ?")
 */
export const FlagKind = z.enum([
  'missing-result',
  'missing-transverse',
  'incoherence',
  'imprecision',
  'patient-ambiguous',
  'multiple-patients',
]);
export type FlagKind = z.infer<typeof FlagKind>;

export const Flag = z.object({
  id: Id,
  kind: FlagKind,
  question: z.string().min(1),
  targetId: Id.nullable(),
  sources: z.array(SourceRef),
  status: z.enum(['open', 'answered', 'dismissed']),
  answer: z.string().nullable(),
});
export type Flag = z.infer<typeof Flag>;

export const InputMethod = z.enum(['voice-device', 'voice-server', 'keyboard', 'simulation']);
export type InputMethod = z.infer<typeof InputMethod>;

export const TransmissionMode = z.enum(['transmission', 'admission']);
export type TransmissionMode = z.infer<typeof TransmissionMode>;

export const PatientCandidate = z.object({
  patientId: Id,
  score: z.number(),
  reasons: z.array(z.string()),
});
export type PatientCandidate = z.infer<typeof PatientCandidate>;

export const PatientResolution = z.object({
  status: z.enum(['resolved', 'ambiguous', 'unresolved', 'manual']),
  patientId: Id.nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  /** Comment le patient a été désigné dans la dictée ("monsieur du box 12"). */
  mention: z.string().nullable(),
  candidates: z.array(PatientCandidate),
  method: z.string(),
});
export type PatientResolution = z.infer<typeof PatientResolution>;

/** Élément proposé par l'IA mais écarté car non retrouvé dans la dictée (anti-invention). */
export const RejectedStatement = z.object({
  section: z.string(),
  text: z.string(),
  quote: z.string(),
  reason: z.enum(['quote-not-found', 'number-mismatch', 'empty']),
});
export type RejectedStatement = z.infer<typeof RejectedStatement>;

export const ReviewStatus = z.enum(['draft', 'validated', 'unreviewed']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  draft: 'À relire',
  validated: 'Validée',
  unreviewed: 'Non relue',
};

export const Transmission = z.object({
  id: Id,
  unitId: Id,
  nurseId: Id,
  patientId: Id.nullable(),
  mode: TransmissionMode,
  createdAt: IsoDateTime,
  dictation: z.object({
    transcript: z.string().min(1),
    inputMethod: InputMethod,
    durationSec: z.number().nonnegative().nullable(),
  }),
  resolution: PatientResolution,
  content: TransmissionContent,
  flags: z.array(Flag),
  review: z.object({
    status: ReviewStatus,
    by: Id.nullable(),
    at: IsoDateTime.nullable(),
  }),
  engine: z.object({
    /** ex. "deepseek:deepseek-chat", "heuristic". */
    structuring: z.string(),
    /** true si le fournisseur principal a échoué et que le moteur de secours a pris le relais. */
    degraded: z.boolean(),
    durationMs: z.number().nonnegative(),
    rejected: z.array(RejectedStatement),
  }),
});
export type Transmission = z.infer<typeof Transmission>;
