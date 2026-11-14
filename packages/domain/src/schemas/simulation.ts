import { z } from 'zod';
import { Appareil, Id, IsoDate, IsoDateTime } from './common';
import { CareUnit, Nurse, Patient, PriorityLevel, Sex } from './hospital';
import { Transmission, TransmissionMode } from './transmission';
import { DpiExport } from './views';

// ─── État complet de l'hôpital simulé (persisté en JSON côté API) ────────────

export const ClockState = z.object({
  mode: z.enum(['real', 'simulated']),
  /** Heure simulée courante (si mode = simulated). */
  now: IsoDateTime.nullable(),
});
export type ClockState = z.infer<typeof ClockState>;

export const HospitalState = z.object({
  schemaVersion: z.literal(1),
  clock: ClockState,
  units: z.array(CareUnit),
  nurses: z.array(Nurse),
  patients: z.array(Patient),
  transmissions: z.array(Transmission),
  dpiExports: z.array(DpiExport),
  simulation: z.object({
    scenarioId: z.string().nullable(),
    cursor: z.number().int().nonnegative(),
  }),
});
export type HospitalState = z.infer<typeof HospitalState>;

// ─── Scénarios ───────────────────────────────────────────────────────────────

export const NewPatientInput = z.object({
  unitId: Id,
  room: z.string().min(1),
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  sex: Sex,
  birthDate: IsoDate,
  admissionReason: z.string(),
  assignedNurseId: Id.nullable().optional(),
});
export type NewPatientInput = z.infer<typeof NewPatientInput>;

/** Ce que l'on attend de la structuration d'une dictée (sert à l'évaluation). */
export const DictationExpectation = z.object({
  patientId: Id.nullable().optional(),
  ambiguous: z.boolean().optional(),
  targets: z
    .array(
      z.object({
        /** Au moins un de ces mots doit apparaître dans le libellé de la cible. */
        labelAnyOf: z.array(z.string()).min(1),
        appareil: Appareil.optional(),
        missingResult: z.boolean().optional(),
      }),
    )
    .optional(),
  /** Mots-clés attendus dans les soins de routine (pas de cible). */
  routineAnyOf: z.array(z.string()).optional(),
  /** Mots-clés attendus dans "à faire". */
  todosAnyOf: z.array(z.string()).optional(),
  /** Chaînes qui ne doivent JAMAIS apparaître (inventions typiques). */
  forbidden: z.array(z.string()).optional(),
});
export type DictationExpectation = z.infer<typeof DictationExpectation>;

const EventBase = z.object({
  at: IsoDateTime,
  /** Phrase courte affichée dans le journal du simulateur. */
  label: z.string().optional(),
});

export const ScenarioEvent = z.discriminatedUnion('type', [
  EventBase.extend({
    type: z.literal('dictation'),
    nurseId: Id,
    text: z.string().min(1),
    mode: TransmissionMode.optional(),
    /** Patient présélectionné (dictée lancée depuis la fiche patient). */
    patientId: Id.optional(),
    /** Ce que fait l'IDE après relecture. */
    review: z.enum(['validate', 'defer', 'none']).optional(),
    expect: DictationExpectation.optional(),
  }),
  EventBase.extend({
    type: z.literal('admit'),
    patientId: Id,
    patient: NewPatientInput,
  }),
  EventBase.extend({
    type: z.literal('priority'),
    patientId: Id,
    nurseId: Id,
    starred: z.boolean().optional(),
    level: PriorityLevel.nullable().optional(),
  }),
  EventBase.extend({
    type: z.literal('narration'),
    text: z.string().min(1),
  }),
]);
export type ScenarioEvent = z.infer<typeof ScenarioEvent>;

export const ScenarioSummary = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  unitId: Id,
  tags: z.array(z.string()),
  eventCount: z.number().int(),
  startsAt: IsoDateTime,
  endsAt: IsoDateTime,
});
export type ScenarioSummary = z.infer<typeof ScenarioSummary>;

export const SimulationLogEntry = z.object({
  at: IsoDateTime,
  label: z.string(),
  transmissionId: Id.nullable(),
});

export const SimulationStatus = z.object({
  scenarioId: z.string().nullable(),
  title: z.string().nullable(),
  cursor: z.number().int(),
  total: z.number().int(),
  now: IsoDateTime,
  clockMode: z.enum(['real', 'simulated']),
  nextEvent: z.object({ at: IsoDateTime, type: z.string(), label: z.string() }).nullable(),
  log: z.array(SimulationLogEntry),
});
export type SimulationStatus = z.infer<typeof SimulationStatus>;
