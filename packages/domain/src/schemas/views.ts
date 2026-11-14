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

export const PatientDetail = z.object({
  patient: Patient,
  summary: PatientSummary,
  priority: EffectivePriority,
  transmissions: z.array(Transmission),
});
export type PatientDetail = z.infer<typeof PatientDetail>;

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
