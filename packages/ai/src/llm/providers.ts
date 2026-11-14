import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { AiConfig, LlmProviderName } from '../config';

/**
 * REGISTRE DES FOURNISSEURS LLM.
 * Ajouter un fournisseur : une ligne ici + la valeur dans LLM_PROVIDERS (config.ts).
 * `openai-compatible` couvre déjà Ollama, vLLM, LM Studio, OVHcloud AI Endpoints,
 * Scaleway, Together… (hébergement souverain / HDS possible).
 */
type Factory = (cfg: AiConfig['llm'], model: string) => LanguageModel;

const opt = (v: string | null) => v ?? undefined;

export const LLM_FACTORIES: Record<Exclude<LlmProviderName, 'heuristic'>, Factory> = {
  deepseek: (c, m) => createDeepSeek({ apiKey: opt(c.apiKey), baseURL: opt(c.baseUrl) })(m),
  openai: (c, m) => createOpenAI({ apiKey: opt(c.apiKey), baseURL: opt(c.baseUrl) })(m),
  anthropic: (c, m) => createAnthropic({ apiKey: opt(c.apiKey), baseURL: opt(c.baseUrl) })(m),
  mistral: (c, m) => createMistral({ apiKey: opt(c.apiKey), baseURL: opt(c.baseUrl) })(m),
  google: (c, m) => createGoogleGenerativeAI({ apiKey: opt(c.apiKey), baseURL: opt(c.baseUrl) })(m),
  groq: (c, m) => createGroq({ apiKey: opt(c.apiKey), baseURL: opt(c.baseUrl) })(m),
  'openai-compatible': (c, m) =>
    createOpenAICompatible({
      name: 'openai-compatible',
      apiKey: opt(c.apiKey),
      baseURL: c.baseUrl ?? 'http://localhost:11434/v1',
      supportsStructuredOutputs: false,
    })(m),
};
