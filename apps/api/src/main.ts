import { join, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { aiConfigFromEnv, createAiServices } from '@infirmier/ai';
import { DEFAULT_SCENARIO_ID, getScenario, initialState } from '@infirmier/simulation';
import { createApp, VERSION } from './app';
import { apiConfigFromEnv } from './config';
import { anchorClock } from './services/clock';
import { HospitalStore } from './store/store';

const config = apiConfigFromEnv(process.env);
const ai = createAiServices(aiConfigFromEnv(process.env));
const scenario = getScenario(config.DEFAULT_SCENARIO) ?? getScenario(DEFAULT_SCENARIO_ID);
if (!scenario) throw new Error(`Scénario inconnu : ${config.DEFAULT_SCENARIO}`);

const dataFile = config.DATA_DIR
  ? join(resolve(process.cwd(), '../..', config.DATA_DIR), 'state.json')
  : null;
const { store, fresh } = await HospitalStore.open(dataFile, () => initialState(scenario));

// Au redémarrage, l'horloge simulée reprend là où elle était ancrée.
if (!fresh && store.snapshot.clock.mode === 'simulated' && store.snapshot.clock.now) {
  const now = store.snapshot.clock.now;
  store.update((s) => {
    s.clock = anchorClock(now);
  });
}

const { app, simulation } = createApp({
  store,
  ai,
  logRequests: true,
  edgeSecret: process.env.API_EDGE_SECRET || undefined,
});

const bind = process.env.API_BIND || '0.0.0.0';
serve({ fetch: app.fetch, port: config.API_PORT, hostname: bind }, (info) => {
  const status = ai.status(VERSION);
  console.info(`
  Infirmier augmenté — API ${VERSION}
  ➜ écoute   http://${info.address}:${info.port}
  LLM        ${status.llm.provider}${status.llm.model ? ` (${status.llm.model})` : ''}${status.llm.fallback ? `, repli ${status.llm.fallback}` : ''}
  STT        ${status.stt.provider}
  Classifieur ${status.classifier.provider}
  État       ${dataFile ?? 'mémoire seule'}
`);
});

// Premier démarrage : la journée fictive est rejouée APRÈS l'ouverture du port
// (avec un vrai LLM, compter ~2 s par dictée ; l'app affiche les données au fil de l'eau).
if (fresh) {
  console.info(
    `[sim] premier démarrage : scénario « ${scenario.title} » (${config.SIM_BOOT === 'end' ? 'rejoué jusqu’au bout' : 'au début'})…`,
  );
  simulation
    .load(scenario.id, config.SIM_BOOT)
    .then(() => console.info('[sim] journée prête.'))
    .catch((e: unknown) => console.error('[sim] échec du rejeu initial', e));
}

const shutdown = async () => {
  await store.flush();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
