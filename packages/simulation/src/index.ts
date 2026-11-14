import type { SampleDictation } from '@infirmier/domain';
import type { Scenario } from './scenario';
import { admissionNuit } from './scenarios/admission-nuit';
import { medecineJournee } from './scenarios/medecine-journee';
import { reaBox12 } from './scenarios/rea-box12';

export * from './helpers';
export * from './hospital';
export * from './scenario';

/**
 * REGISTRE DES SCÉNARIOS. Ajouter un scénario : créer `scenarios/<id>.ts`
 * avec `defineScenario(...)`, puis l'ajouter ici. Les tests vérifient sa cohérence.
 */
export const SCENARIOS: readonly Scenario[] = [reaBox12, medecineJournee, admissionNuit];

export const DEFAULT_SCENARIO_ID = reaBox12.id;

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** Dictées d'exemple (mode démo sans micro), tirées des scénarios. */
export function sampleDictations(unitId?: string): SampleDictation[] {
  return SCENARIOS.filter((s) => !unitId || s.unitId === unitId).flatMap((s) =>
    s.events.flatMap((e, i) =>
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
    ),
  );
}
