import { type AiOverrides, aiConfigFromEnv, createAiServices, sequentialIds } from '@infirmier/ai';
import { type ApiClient, createApiClient } from '@infirmier/domain';
import { getScenario, initialState } from '@infirmier/simulation';
import { createApp } from '../app';
import { anchorClock } from '../services/clock';
import { HospitalStore } from '../store/store';

/** Heure "réelle" figée pour des tests reproductibles. */
export const REAL_NOW = new Date('2026-11-14T15:00:00Z');

/**
 * App complète pour les tests d'intégration : vraie pile HTTP, store en mémoire,
 * IA heuristique (déterministe, sans réseau), horloge simulée figée.
 */
export function createTestApp(
  opts: { scenarioId?: string; at?: string; ai?: AiOverrides; sessions?: boolean } = {},
) {
  const scenario = getScenario(opts.scenarioId ?? 'rea-box12');
  if (!scenario) throw new Error('scénario inconnu');
  const state = initialState(scenario);
  state.clock = anchorClock(opts.at ?? '2026-11-14T16:35:00+01:00', REAL_NOW);
  const store = HospitalStore.inMemory(state);
  const ai = createAiServices(aiConfigFromEnv({}), { logger: { warn: () => {} }, ...opts.ai });
  const realNow = () => REAL_NOW;
  const { app, hospital, simulation } = createApp({
    store,
    ai,
    ids: sequentialIds(),
    realNow,
    visitorSeed: opts.sessions ? structuredClone(store.snapshot) : undefined,
  });
  const client: ApiClient = createApiClient({
    baseUrl: 'http://api.test',
    fetch: ((input: string | URL | Request, init?: RequestInit) =>
      app.request(input instanceof Request ? input : String(input), init)) as typeof fetch,
  });
  return { app, client, store, hospital, simulation, scenario };
}

export const EXAMPLE_A =
  'Alors monsieur du box 12. Neuro, Glasgow 15, plus de sédation depuis ce matin. Respi, il a été extubé vers 10h, là il est sous lunettes à 3 litres, sécrétions sèches, la kiné est passée. Hémodynamique stable, la noradré a été arrêtée hier soir. J’ai refait le pansement du KT central, c’est propre. Par contre vers 16h il était agité, il a arraché sa SNG, j’ai appelé l’interne, on l’a reposée et la radio de contrôle est OK.';
