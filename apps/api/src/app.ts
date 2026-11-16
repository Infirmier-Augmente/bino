import type { AiServices, IdFactory } from '@infirmier/ai';
import { randomIds } from '@infirmier/ai';
import type { Scenario } from '@infirmier/simulation';
import { SCENARIOS } from '@infirmier/simulation';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { registerContract } from './http/contract-adapter';
import { AppError } from './http/errors';
import { createHandlers } from './http/routes';
import { registerTranscription } from './http/transcription';
import { HospitalService } from './services/hospital-service';
import { SimulationService } from './services/simulation-service';
import type { HospitalStore } from './store/store';

export const VERSION = '0.1.0';

export interface AppDeps {
  store: HospitalStore;
  ai: AiServices;
  ids?: IdFactory;
  scenarios?: readonly Scenario[];
  realNow?: () => Date;
  logRequests?: boolean;
  /** Si défini, seule une requête portant ce secret (le Worker) est acceptée. */
  edgeSecret?: string;
}

export function createApp(deps: AppDeps) {
  const ids = deps.ids ?? randomIds;
  const hospital = new HospitalService({
    store: deps.store,
    ai: deps.ai,
    ids,
    realNow: deps.realNow,
  });
  const simulation = new SimulationService(
    deps.store,
    hospital,
    deps.scenarios ?? SCENARIOS,
    deps.realNow,
  );

  const app = new Hono();
  // API destinée au réseau de l'hôpital (démo : tout le monde en local). À restreindre en production.
  app.use('*', cors());
  if (deps.logRequests) {
    app.use('*', async (c, next) => {
      const t0 = Date.now();
      await next();
      console.info(`${c.req.method} ${c.req.path} → ${c.res.status} (${Date.now() - t0} ms)`);
    });
  }

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        { error: { code: err.code, message: err.message, details: err.details } },
        err.status,
      );
    }
    console.error('[api] erreur inattendue', err);
    return c.json({ error: { code: 'internal', message: 'Erreur interne du serveur.' } }, 500);
  });
  app.notFound((c) =>
    c.json({ error: { code: 'route-not-found', message: `Route inconnue : ${c.req.path}` } }, 404),
  );

  if (deps.edgeSecret) {
    const secret = deps.edgeSecret;
    app.use('*', async (c, next) => {
      if (c.req.header('x-bino-edge') !== secret) {
        throw new AppError(401, 'edge-required', 'Cette API n’accepte que le site Bino.');
      }
      await next();
    });
  }

  registerContract(
    app,
    createHandlers({ hospital, simulation, status: () => deps.ai.status(VERSION) }),
  );
  registerTranscription(app, deps.ai.stt);

  return { app, hospital, simulation };
}
