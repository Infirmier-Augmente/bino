import { z } from 'zod';

/** Mot de passe de démo partagé par les comptes du simulateur (pas une authentification réelle). */
export const DEFAULT_DEMO_PASSWORD = 'bino';

const Env = z.object({
  API_PORT: z.coerce.number().int().positive().default(8787),
  DATA_DIR: z.string().optional(),
  DEFAULT_SCENARIO: z.string().default('chir-bino'),
  /** Au premier démarrage : scénario rejoué jusqu'au bout (démo prête) ou laissé au début. */
  SIM_BOOT: z.enum(['start', 'end']).default('end'),
  /** Connexion de démo (matricule + ce mot de passe, casse et espaces ignorés). CPS / e-CPS en V2. */
  DEMO_PASSWORD: z.string().trim().min(1).default(DEFAULT_DEMO_PASSWORD),
});

export type ApiConfig = z.infer<typeof Env>;

export function apiConfigFromEnv(env: Record<string, string | undefined>): ApiConfig {
  return Env.parse(
    Object.fromEntries(Object.entries(env).map(([k, v]) => [k, v === '' ? undefined : v])),
  );
}
