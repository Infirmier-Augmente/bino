import { z } from 'zod';
import { Appareil, Id, IsoDateTime, SourcedItem, SourceRef } from './common';
import {
  CareUnit,
  HandoverTemplateId,
  Nurse,
  Patient,
  PriorityLevel,
  Sex,
  TransverseField,
} from './hospital';
import { DarTarget, Flag, Transmission } from './transmission';

// Vues calculées (jamais stockées) servies par l'API.

export const ShiftWindow = z.object({
  kind: z.enum(['jour', 'nuit']),
  start: IsoDateTime,
  end: IsoDateTime,
  label: z.string(),
});
export type ShiftWindow = z.infer<typeof ShiftWindow>;

export const PriorityReason = z.object({
  label: z.string(),
  weight: z.number(),
  sources: z.array(SourceRef),
});
export type PriorityReason = z.infer<typeof PriorityReason>;

export const PrioritySuggestion = z.object({
  level: PriorityLevel,
  score: z.number(),
  reasons: z.array(PriorityReason),
});
export type PrioritySuggestion = z.infer<typeof PrioritySuggestion>;

export const EffectivePriority = z.object({
  level: PriorityLevel,
  origin: z.enum(['manuelle', 'suggeree']),
  starred: z.boolean(),
  suggestion: PrioritySuggestion,
});
export type EffectivePriority = z.infer<typeof EffectivePriority>;

export const PatientSummary = z.object({
  id: Id,
  unitId: Id,
  room: z.string(),
  roomLabel: z.string(),
  displayName: z.string(),
  lastName: z.string(),
  firstName: z.string(),
  sex: Sex,
  age: z.number().int().nonnegative(),
  admissionReason: z.string(),
  admittedAt: IsoDateTime,
  /** "J5" = 5e jour d'hospitalisation. */
  dayOfStay: z.string(),
  assignedNurseId: Id.nullable(),
});
export type PatientSummary = z.infer<typeof PatientSummary>;

export const TransmissionCounts = z.object({
  total: z.number().int(),
  draft: z.number().int(),
  validated: z.number().int(),
  unreviewed: z.number().int(),
  openFlags: z.number().int(),
});
export type TransmissionCounts = z.infer<typeof TransmissionCounts>;

/** Ligne de la liste "Mes patients" et de la vue service. */
export const PatientListItem = z.object({
  patient: PatientSummary,
  priority: EffectivePriority,
  counts: TransmissionCounts,
  headline: z.array(SourcedItem),
  alerts: z.array(z.string()),
  lastTransmissionAt: IsoDateTime.nullable(),
});
export type PatientListItem = z.infer<typeof PatientListItem>;

export const UnitBoard = z.object({
  unit: CareUnit,
  shift: ShiftWindow,
  now: IsoDateTime,
  rows: z.array(PatientListItem),
  totals: TransmissionCounts,
});
export type UnitBoard = z.infer<typeof UnitBoard>;

export const HandoverSection = z.object({
  key: z.union([Appareil, z.enum(['evenements', 'surveillance', 'soins'])]),
  title: z.string(),
  items: z.array(SourcedItem),
});
export type HandoverSection = z.infer<typeof HandoverSection>;

export const TransverseLine = z.object({
  field: TransverseField,
  label: z.string(),
  status: z.enum(['renseigne', 'non-renseigne']),
  summary: z.string(),
  items: z.array(SourcedItem),
});
export type TransverseLine = z.infer<typeof TransverseLine>;

/** Fiche de relève par patient (exemple B du kit). */
export const HandoverSheet = z.object({
  patient: PatientSummary,
  template: HandoverTemplateId,
  shift: ShiftWindow,
  generatedAt: IsoDateTime,
  headline: z.array(SourcedItem),
  targets: z.array(DarTarget),
  sections: z.array(HandoverSection),
  transverse: z.array(TransverseLine),
  todos: z.array(SourcedItem),
  openFlags: z.array(Flag),
  counts: TransmissionCounts,
  priority: EffectivePriority,
  /** Transmissions du poste, dans l'ordre chronologique (pour remonter aux sources). */
  transmissionIds: z.array(Id),
});
export type HandoverSheet = z.infer<typeof HandoverSheet>;

// ─── NEWS2 et dossier médical (aide au calcul, entrées toujours affichées) ───

/** Points NEWS2 par paramètre (0 à 3). La diastolique ne compte pas. */
export const News2Points = z.object({
  respiratoryRate: z.number().int().min(0).max(3),
  spo2: z.number().int().min(0).max(3),
  oxygen: z.number().int().min(0).max(3),
  systolic: z.number().int().min(0).max(3),
  heartRate: z.number().int().min(0).max(3),
  temperature: z.number().int().min(0).max(3),
  consciousness: z.number().int().min(0).max(3),
});
export type News2Points = z.infer<typeof News2Points>;

export const News2Result = z.object({
  points: News2Points,
  total: z.number().int().nonnegative(),
  /** Niveau de la démo : ≥ 7 rouge, 5-6 orange, 3-4 ou un paramètre à 3 jaune, sinon vert. */
  level: PriorityLevel,
  /** Raison courte et factuelle, ex. « NEWS2 7 · FR 24, TA 98/62 ». */
  reason: z.string(),
});
export type News2Result = z.infer<typeof News2Result>;

/** Dispositif avec son jour de pose calculé (« J2 »). */
export const DeviceLine = z.object({
  id: Id,
  label: z.string(),
  day: z.string(),
});
export type DeviceLine = z.infer<typeof DeviceLine>;

export const PatientDetail = z.object({
  patient: Patient,
  summary: PatientSummary,
  priority: EffectivePriority,
  transmissions: z.array(Transmission),
  /** NEWS2 des dernières constantes (null sans relevé). */
  news2: News2Result.nullable(),
  devices: z.array(DeviceLine),
});
export type PatientDetail = z.infer<typeof PatientDetail>;

// ─── Transmissions de l'équipe (onglet « Tous ») et « Mes CR » ───────────────

/** Qui a dit quoi et quand, sous chaque puce : « Karim 14h05 ». */
export const SummaryContributor = z.object({
  nurseId: Id,
  firstName: z.string(),
  at: IsoDateTime,
  /** Heure locale du service, ex. « 14h05 ». */
  time: z.string(),
});
export type SummaryContributor = z.infer<typeof SummaryContributor>;

/**
 * Une puce du résumé d'un patient : un thème (« Douleur ») et les éléments SOURCÉS des comptes
 * rendus de toute l'équipe, sans aucune phrase générée (zéro information inventée).
 */
export const SummaryBullet = z.object({
  id: Id,
  theme: z.string(),
  /** Éléments repris tels quels des transmissions structurées, dans l'ordre chronologique. */
  items: z.array(SourcedItem).min(1),
  /** Texte affiché après « Thème : » (les textes des éléments, bout à bout). */
  text: z.string(),
  /** Auteurs et heures, dédoublonnés, du plus récent au plus ancien. */
  contributors: z.array(SummaryContributor),
  lastAt: IsoDateTime,
  /** Question ouverte sur ce thème (ex. résultat non renseigné), jamais une supposition. */
  question: z.string().nullable(),
});
export type SummaryBullet = z.infer<typeof SummaryBullet>;

export const PatientDigest = z.object({
  patient: PatientSummary,
  priority: EffectivePriority,
  news2: News2Result.nullable(),
  /** Du plus récent au plus ancien. */
  bullets: z.array(SummaryBullet),
  /** Nombre de comptes rendus du poste pour ce patient (0 = « Aucun compte rendu aujourd'hui »). */
  reportCount: z.number().int().nonnegative(),
});
export type PatientDigest = z.infer<typeof PatientDigest>;

export const UnitSummaries = z.object({
  unit: CareUnit,
  shift: ShiftWindow,
  now: IsoDateTime,
  rows: z.array(PatientDigest),
});
export type UnitSummaries = z.infer<typeof UnitSummaries>;

/** Un compte rendu du soignant connecté (« Mes CR »), texte intégral. */
export const NurseReport = z.object({
  transmissionId: Id,
  patient: PatientSummary.nullable(),
  createdAt: IsoDateTime,
  /** Heure locale du service, ex. « 10h20 ». */
  time: z.string(),
  transcript: z.string(),
  status: z.enum(['draft', 'validated', 'unreviewed']),
});
export type NurseReport = z.infer<typeof NurseReport>;

export const LoginResult = z.object({
  nurse: Nurse,
  unit: CareUnit,
});
export type LoginResult = z.infer<typeof LoginResult>;

export const SearchHit = z.object({
  transmissionId: Id,
  patientId: Id.nullable(),
  patientLabel: z.string(),
  createdAt: IsoDateTime,
  nurseId: Id,
  snippet: z.string(),
  /** Offsets de la correspondance DANS le snippet. */
  matchStart: z.number().int(),
  matchEnd: z.number().int(),
  /** Offsets dans le transcript complet. */
  sourceStart: z.number().int(),
  sourceEnd: z.number().int(),
});
export type SearchHit = z.infer<typeof SearchHit>;

export const RecapLine = z.object({
  patientId: Id,
  level: PriorityLevel,
  starred: z.boolean(),
  text: z.string(),
});
export type RecapLine = z.infer<typeof RecapLine>;

export const DpiExport = z.object({
  id: Id,
  patientId: Id,
  exportedAt: IsoDateTime,
  exportedBy: Id,
  format: z.literal('fhir-r4-bundle'),
  transmissionIds: z.array(Id),
  bundle: z.record(z.string(), z.unknown()),
});
export type DpiExport = z.infer<typeof DpiExport>;

export const SessionInfo = z.object({
  units: z.array(CareUnit),
  nurses: z.array(Nurse),
});
export type SessionInfo = z.infer<typeof SessionInfo>;
