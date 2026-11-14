import {
  type ApiOutput,
  type ApiParsedInput,
  api,
  type EndpointDef,
  type EndpointName,
} from '@infirmier/domain';
import type { Context, Hono } from 'hono';
import type { z } from 'zod';
import { AppError } from './errors';

export type Handler<K extends EndpointName> = (
  input: ApiParsedInput<K>,
  c: Context,
) => ApiOutput<K> | Promise<ApiOutput<K>>;

/** Table des handlers : TypeScript exige un handler pour CHAQUE endpoint du contrat. */
export type Handlers = { [K in EndpointName]: Handler<K> };

function parse(schema: z.ZodType, value: unknown, where: string): unknown {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new AppError(
      400,
      'invalid-input',
      `Requête invalide (${where}) : ${r.error.issues
        .map((i) => `${i.path.join('.') || where} ${i.message}`)
        .join(' ; ')}`,
      r.error.issues,
    );
  }
  return r.data;
}

/**
 * Enregistre tous les endpoints du contrat : validation des entrées,
 * appel du handler, puis validation de la SORTIE (une réponse hors contrat = bug serveur).
 */
export function registerContract(app: Hono, handlers: Handlers): void {
  for (const name of Object.keys(api) as EndpointName[]) {
    const def = api[name] as EndpointDef;
    const handler = handlers[name] as unknown as (input: unknown, c: Context) => unknown;
    app.on(def.method, def.path, async (c) => {
      const params = def.params ? parse(def.params, c.req.param(), 'paramètres') : undefined;
      const query = def.query ? parse(def.query, c.req.query(), 'query') : undefined;
      let body: unknown;
      if (def.body) {
        let json: unknown;
        try {
          json = await c.req.json();
        } catch {
          throw new AppError(400, 'invalid-json', 'Corps JSON invalide.');
        }
        body = parse(def.body, json, 'corps');
      }
      const result = await handler({ params, query, body }, c);
      const out = def.response.safeParse(result);
      if (!out.success) {
        console.error(`[api] réponse hors contrat pour ${name}`, out.error.issues.slice(0, 5));
        throw new AppError(500, 'invalid-response', 'Réponse serveur non conforme au contrat.');
      }
      return c.json(out.data as object);
    });
  }
}
