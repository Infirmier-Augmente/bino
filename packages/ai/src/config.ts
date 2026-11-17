import { z } from 'zod';

/**
 * Configuration IA lue depuis l'environnement (voir .env.example).
 * Changer de fournisseur = changer des variables d'environnement. Aucun code ne bouge.
 */

export const LLM_PROVIDERS = [
  'heuristic',
  'deepseek',
  'openai',
  'anthropic',
  'mistral',
  'google',
  'groq',
  'openai-compatible',
] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

export const STT_PROVIDERS = ['none', 'openai', 'groq', 'openai-compatible'] as const;
export type SttProviderName = (typeof STT_PROVIDERS)[number];

export const CLASSIFIER_PROVIDERS = ['heuristic', 'llm', 'jev'] as const;
export type ClassifierProviderName = (typeof CLASSIFIER_PROVIDERS)[number];

/** Modèles par défaut quand on est sûr de l'identifiant ; sinon LLM_MODEL est obligatoire. */
const DEFAULT_LLM_MODELS: Partial<Record<LlmProviderName, string>> = {
  deepseek: 'deepseek-chat',
};
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-chat';
const DEFAULT_OPENROUTER_STT_MODEL = 'openai/whisper-1';
const DEFAULT_STT_MODELS: Partial<Record<SttProviderName, string>> = {
  openai: 'whisper-1',
  groq: 'whisper-large-v3-turbo',
};

const emptyToNull = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : null));

export const AiConfig = z.object({
  llm: z.object({
    provider: z.enum(LLM_PROVIDERS),
    model: z.string().nullable(),
    apiKey: z.string().nullable(),
    baseUrl: z.string().nullable(),
    timeoutMs: z.number().int().positive(),
    fallback: z.enum(['heuristic', 'none']),
  }),
  stt: z.object({
    provider: z.enum(STT_PROVIDERS),
    model: z.string().nullable(),
    apiKey: z.string().nullable(),
    baseUrl: z.string().nullable(),
  }),
  classifier: z.object({
    provider: z.enum(CLASSIFIER_PROVIDERS),
    jevApiKey: z.string().nullable(),
    jevModel: z.string(),
    jevBaseUrl: z.string(),
  }),
});
export type AiConfig = z.infer<typeof AiConfig>;

const Env = z.object({
  LLM_PROVIDER: z.enum(LLM_PROVIDERS).default('heuristic'),
  LLM_MODEL: emptyToNull,
  LLM_API_KEY: emptyToNull,
  LLM_BASE_URL: emptyToNull,
  OPENROUTER_API_KEY: emptyToNull,
  OPENROUTER_MODEL: emptyToNull,
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  LLM_FALLBACK: z.enum(['heuristic', 'none']).default('heuristic'),
  STT_PROVIDER: z.enum(STT_PROVIDERS).default('none'),
  STT_MODEL: emptyToNull,
  STT_API_KEY: emptyToNull,
  STT_BASE_URL: emptyToNull,
  CLASSIFIER_PROVIDER: z.enum(CLASSIFIER_PROVIDERS).default('heuristic'),
  JEV_API_KEY: emptyToNull,
  JEV_MODEL: z.string().default('jev-latest'),
  JEV_BASE_URL: z.string().default('https://api.typesafe.ai'),
});

export class AiConfigError extends Error {
  override name = 'AiConfigError';
}

/** Lit et valide la configuration. Lève une erreur LISIBLE si elle est incohérente. */
export function aiConfigFromEnv(env: Record<string, string | undefined>): AiConfig {
  const cleaned = Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, v === '' ? undefined : v]),
  );
  const parsed = Env.safeParse(cleaned);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new AiConfigError(`Configuration IA invalide (${msg}). Voir .env.example.`);
  }
  const e = parsed.data;

  if (e.OPENROUTER_API_KEY && e.LLM_PROVIDER !== 'heuristic') {
    throw new AiConfigError(
      'OPENROUTER_API_KEY et LLM_PROVIDER ne se combinent pas. Garde un seul des deux.',
    );
  }

  const openRouter = e.OPENROUTER_API_KEY
    ? {
        provider: 'openai-compatible' as const,
        model: e.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
        apiKey: e.OPENROUTER_API_KEY,
        baseUrl: OPENROUTER_BASE_URL,
      }
    : null;

  const llmModel = e.LLM_MODEL ?? DEFAULT_LLM_MODELS[e.LLM_PROVIDER] ?? null;
  if (!openRouter && e.LLM_PROVIDER !== 'heuristic') {
    if (!llmModel) {
      throw new AiConfigError(`LLM_MODEL est requis pour le fournisseur « ${e.LLM_PROVIDER} ».`);
    }
    if (e.LLM_PROVIDER === 'openai-compatible' && !e.LLM_BASE_URL) {
      throw new AiConfigError('LLM_BASE_URL est requis pour « openai-compatible ».');
    }
    if (e.LLM_PROVIDER !== 'openai-compatible' && !e.LLM_API_KEY) {
      throw new AiConfigError(`LLM_API_KEY est requis pour le fournisseur « ${e.LLM_PROVIDER} ».`);
    }
  }
  if (e.STT_PROVIDER === 'openai-compatible' && !e.STT_BASE_URL) {
    throw new AiConfigError('STT_BASE_URL est requis pour « openai-compatible ».');
  }
  if (e.CLASSIFIER_PROVIDER === 'jev' && !e.JEV_API_KEY) {
    throw new AiConfigError('JEV_API_KEY est requis quand CLASSIFIER_PROVIDER=jev.');
  }
  if (e.CLASSIFIER_PROVIDER === 'llm' && !openRouter && e.LLM_PROVIDER === 'heuristic') {
    throw new AiConfigError('CLASSIFIER_PROVIDER=llm nécessite un LLM_PROVIDER réel.');
  }

  return {
    llm: {
      provider: openRouter?.provider ?? e.LLM_PROVIDER,
      model: openRouter ? openRouter.model : e.LLM_PROVIDER === 'heuristic' ? null : llmModel,
      apiKey: openRouter?.apiKey ?? e.LLM_API_KEY,
      baseUrl: openRouter?.baseUrl ?? e.LLM_BASE_URL,
      timeoutMs: e.LLM_TIMEOUT_MS,
      fallback: e.LLM_FALLBACK,
    },
    stt:
      openRouter && e.STT_PROVIDER === 'none'
        ? {
            provider: 'openai-compatible',
            model: DEFAULT_OPENROUTER_STT_MODEL,
            apiKey: openRouter.apiKey,
            baseUrl: OPENROUTER_BASE_URL,
          }
        : {
            provider: e.STT_PROVIDER,
            model:
              e.STT_PROVIDER === 'none'
                ? null
                : (e.STT_MODEL ?? DEFAULT_STT_MODELS[e.STT_PROVIDER] ?? null),
            apiKey: e.STT_API_KEY,
            baseUrl: e.STT_BASE_URL,
          },
    classifier: {
      provider: e.CLASSIFIER_PROVIDER,
      jevApiKey: e.JEV_API_KEY,
      jevModel: e.JEV_MODEL,
      jevBaseUrl: e.JEV_BASE_URL,
    },
  };
}

/** Configuration 100 % locale (tests, démo hors ligne). */
export function offlineAiConfig(): AiConfig {
  return aiConfigFromEnv({});
}
