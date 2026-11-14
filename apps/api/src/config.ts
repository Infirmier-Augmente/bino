import { z } from 'zod';

const Env = z.object({
  API_PORT: z.coerce.number().int().positive().default(8787),
  DATA_DIR: z.string().optional(),
  DEFAULT_SCENARIO: z.string().default('rea-box12'),
  /** Au premier démarrage : scénario rejoué jusqu'au bout (démo prête) ou laissé au début. */
  SIM_BOOT: z.enum(['start', 'end']).default('end'),
});

export type ApiConfig = z.infer<typeof Env>;

export function apiConfigFromEnv(env: Record<string, string | undefined>): ApiConfig {
  return Env.parse(
    Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v === '' ? undefined : v])),
  );
}
