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

/** Transcription en direct (texte provisoire pendant la dictée) : OpenAI Realtime pour l'instant. */
export const STT_LIVE_PROVIDERS = ['none', 'openai'] as const;
export type SttLiveProviderName = (typeof STT_LIVE_PROVIDERS)[number];
/** Modèle de transcription en direct par défaut (`STT_LIVE_MODEL=none` pour désactiver). */
export const DEFAULT_STT_LIVE_MODEL = 'gpt-live-transcribe';

export const CLASSIFIER_PROVIDERS = ['heuristic', 'llm', 'jev'] as const;
export type ClassifierProviderName = (typeof CLASSIFIER_PROVIDERS)[number];

/** Modèles par défaut quand on est sûr de l'identifiant ; sinon LLM_MODEL est obligatoire. */
const DEFAULT_LLM_MODELS: Partial<Record<LlmProviderName, string>> = {
  deepseek: 'deepseek-chat',
};
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
  /** Activée quand `STT_PROVIDER=openai` (même clé `STT_API_KEY`), sauf `STT_LIVE_MODEL=none`. */
  sttLive: z.object({
    provider: z.enum(STT_LIVE_PROVIDERS),
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
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  LLM_FALLBACK: z.enum(['heuristic', 'none']).default('heuristic'),
  STT_PROVIDER: z.enum(STT_PROVIDERS).default('none'),
  STT_MODEL: emptyToNull,
  STT_API_KEY: emptyToNull,
  STT_BASE_URL: emptyToNull,
  STT_LIVE_MODEL: emptyToNull,
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

  const llmModel = e.LLM_MODEL ?? DEFAULT_LLM_MODELS[e.LLM_PROVIDER] ?? null;
  if (e.LLM_PROVIDER !== 'heuristic') {
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
  if (e.CLASSIFIER_PROVIDER === 'llm' && e.LLM_PROVIDER === 'heuristic') {
    throw new AiConfigError('CLASSIFIER_PROVIDER=llm nécessite un LLM_PROVIDER réel.');
  }

  const liveModel = e.STT_LIVE_MODEL ?? DEFAULT_STT_LIVE_MODEL;
  const liveOn = e.STT_PROVIDER === 'openai' && liveModel.toLowerCase() !== 'none';

  return {
    llm: {
      provider: e.LLM_PROVIDER,
      model: e.LLM_PROVIDER === 'heuristic' ? null : llmModel,
      apiKey: e.LLM_API_KEY,
      baseUrl: e.LLM_BASE_URL,
      timeoutMs: e.LLM_TIMEOUT_MS,
      fallback: e.LLM_FALLBACK,
    },
    stt: {
      provider: e.STT_PROVIDER,
      model:
        e.STT_PROVIDER === 'none'
          ? null
          : (e.STT_MODEL ?? DEFAULT_STT_MODELS[e.STT_PROVIDER] ?? null),
      apiKey: e.STT_API_KEY,
      baseUrl: e.STT_BASE_URL,
    },
    sttLive: {
      provider: liveOn ? 'openai' : 'none',
      model: liveOn ? liveModel : null,
      apiKey: liveOn ? e.STT_API_KEY : null,
      baseUrl: liveOn ? e.STT_BASE_URL : null,
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
