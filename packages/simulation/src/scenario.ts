import type {
  CareUnit,
  HospitalState,
  Nurse,
  Patient,
  ScenarioEvent,
  ScenarioSummary,
  TransmissionMode,
} from '@infirmier/domain';

/** Dictée d'exemple proposée en démo (sans micro), sans être rejouée par le simulateur. */
export interface ScenarioSample {
  label: string;
  text: string;
  patientId: string | null;
  mode?: TransmissionMode;
}

/**
 * Un scénario = un état initial de l'hôpital + une chronologie d'événements
 * (dictées, entrées, priorités) que le simulateur rejoue à travers la VRAIE
 * pile applicative (API + pipeline IA). Sert à la démo, aux tests et à l'évaluation.
 */
export interface Scenario {
  id: string;
  title: string;
  description: string;
  tags: string[];
  /** Service affiché par défaut. */
  unitId: string;
  /** Heure simulée au chargement du scénario. */
  startsAt: string;
  units: CareUnit[];
  nurses: Nurse[];
  patients: Patient[];
  events: ScenarioEvent[];
  /** Exemples de dictée. Absents : les dictées des événements servent d'exemples. */
  samples?: ScenarioSample[];
}

export function defineScenario(s: Scenario): Scenario {
  const sorted = [...s.events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { ...s, events: sorted };
}

export function initialState(s: Scenario): HospitalState {
  return {
    schemaVersion: 1,
    clock: { mode: 'simulated', now: s.startsAt, anchoredAt: null },
    units: structuredClone(s.units),
    nurses: structuredClone(s.nurses),
    patients: structuredClone(s.patients),
    transmissions: [],
    dpiExports: [],
    simulation: { scenarioId: s.id, cursor: 0 },
  };
}

export function scenarioSummary(s: Scenario): ScenarioSummary {
  const last = s.events.at(-1);
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    unitId: s.unitId,
    tags: s.tags,
    eventCount: s.events.length,
    startsAt: s.startsAt,
    endsAt: last?.at ?? s.startsAt,
  };
}
