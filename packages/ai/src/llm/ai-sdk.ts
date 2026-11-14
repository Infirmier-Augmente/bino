import { generateObject, type LanguageModel } from 'ai';
import type { AiConfig } from '../config';
import type { LlmPort, StructuredRequest } from './port';
import { LLM_FACTORIES } from './providers';

/** Adaptateur unique pour tous les fournisseurs supportés par l'AI SDK (Vercel). */
export class AiSdkLlm implements LlmPort {
  readonly id: string;
  private readonly model: LanguageModel;

  constructor(cfg: AiConfig['llm']) {
    if (cfg.provider === 'heuristic' || !cfg.model) {
      throw new Error('AiSdkLlm nécessite un fournisseur et un modèle.');
    }
    this.model = LLM_FACTORIES[cfg.provider](cfg, cfg.model);
    this.id = `${cfg.provider}:${cfg.model}`;
  }

  async generateStructured<T>(req: StructuredRequest<T>): Promise<T> {
    const { object } = await generateObject({
      model: this.model,
      instructions: req.instructions,
      prompt: req.prompt,
      schema: req.schema,
      schemaName: req.schemaName,
      temperature: req.temperature ?? 0,
      maxRetries: 1,
      abortSignal: req.signal,
    });
    // L'AI SDK valide déjà avec le schéma ; on revalide pour garantir le type exact.
    return req.schema.parse(object);
  }
}
