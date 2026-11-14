import type { SampleDictation } from '@infirmier/domain';
import type { Scenario } from './scenario';
import { admissionNuit } from './scenarios/admission-nuit';
import { chirBino } from './scenarios/chir-bino';
import { medecineJournee } from './scenarios/medecine-journee';
import { reaBox12 } from './scenarios/rea-box12';

export * from './helpers';
export * from './hospital';
export * from './scenario';

/**
 * REGISTRE DES SCÉNARIOS. Ajouter un scénario : créer `scenarios/<id>.ts`
 * avec `defineScenario(...)`, puis l'ajouter ici. Les tests vérifient sa cohérence.
 */
export const SCENARIOS: readonly Scenario[] = [chirBino, reaBox12, medecineJournee, admissionNuit];

/** Scénario chargé au premier démarrage : la démo du front Bino. */
export const DEFAULT_SCENARIO_ID = chirBino.id;

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** Dictées d'exemple (mode démo sans micro) : celles déclarées, sinon celles des événements. */
export function sampleDictations(unitId?: string): SampleDictation[] {
  return SCENARIOS.filter((s) => !unitId || s.unitId === unitId).flatMap((s) =>
    s.samples
      ? s.samples.map((x, i) => ({
          id: `${s.id}:exemple:${i}`,
          scenarioId: s.id,
          label: x.label,
          text: x.text,
          mode: x.mode ?? 'transmission',
          patientId: x.patientId,
        }))
      : eventSamples(s),
  );
}

function eventSamples(s: Scenario): SampleDictation[] {
  return s.events.flatMap((e, i) =>
    e.type === 'dictation'
      ? [
          {
            id: `${s.id}:${i}`,
            scenarioId: s.id,
            label: e.label ?? e.text.slice(0, 40),
            text: e.text,
            mode: e.mode ?? 'transmission',
            patientId: e.patientId ?? null,
          },
        ]
      : [],
  );
}
