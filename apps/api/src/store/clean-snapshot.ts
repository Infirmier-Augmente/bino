import { aiConfigFromEnv, createAiServices, randomIds } from '@infirmier/ai';
import type { HospitalState } from '@infirmier/domain';
import { initialState, type Scenario } from '@infirmier/simulation';
import { HospitalService } from '../services/hospital-service';
import { SimulationService } from '../services/simulation-service';
import { HospitalStore } from './store';

/** Journée fictive rejouée par le moteur local, sans les notes ajoutées ensuite. */
export async function cleanScenarioSnapshot(scenario: Scenario): Promise<HospitalState> {
  const ai = createAiServices(aiConfigFromEnv({}), { logger: { warn: () => {} } });
  const store = HospitalStore.inMemory(initialState(scenario));
  const hospital = new HospitalService({ store, ai, ids: randomIds });
  const simulation = new SimulationService(store, hospital);
  await simulation.load(scenario.id, 'end');
  return structuredClone(store.snapshot);
}
