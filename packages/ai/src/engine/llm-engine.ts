import type { LlmPort } from '../llm/port';
import { structuringPrompt } from '../pipeline/prompts';
import { RawStructuring, type StructuringContext, type StructuringEngine } from './raw';

/** Moteur de structuration au-dessus de n'importe quel LLM (via le port). */
export class LlmStructuringEngine implements StructuringEngine {
  readonly id: string;

  constructor(private readonly llm: LlmPort) {
    this.id = llm.id;
  }

  structure(ctx: StructuringContext, signal?: AbortSignal): Promise<RawStructuring> {
    const { instructions, prompt } = structuringPrompt(ctx);
    return this.llm.generateStructured({
      instructions,
      prompt,
      schema: RawStructuring,
      schemaName: 'TransmissionsCiblees',
      temperature: 0,
      signal,
    });
  }
}
