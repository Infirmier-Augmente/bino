import type { z } from 'zod';

/**
 * PORT LLM — la seule chose que le métier sait d'un modèle de langage.
 * Implémenté par l'adaptateur AI SDK (tous fournisseurs) et remplaçable en test.
 */
export interface StructuredRequest<T> {
  /** Consignes système. */
  instructions: string;
  /** Contenu utilisateur. */
  prompt: string;
  schema: z.ZodType<T>;
  schemaName: string;
  temperature?: number;
  signal?: AbortSignal;
}

export interface LlmPort {
  /** ex. "deepseek:deepseek-chat" */
  readonly id: string;
  generateStructured<T>(request: StructuredRequest<T>): Promise<T>;
}
