import { z } from 'zod';
import type { LlmPort } from '../llm/port';
import { type Answers, type ClassifierPort, choiceConfidence, type Question } from './port';

/**
 * Classifieur de repli au-dessus de n'importe quel LLM.
 * Les probabilités sont auto-déclarées par le modèle : moins fiables que Jev.
 */
export class LlmClassifier implements ClassifierPort {
  readonly id: string;
  readonly semantic = true;

  constructor(private readonly llm: LlmPort) {
    this.id = `llm:${llm.id}`;
  }

  async ask<Qs extends Record<string, Question>>(
    state: unknown,
    questions: Qs,
    signal?: AbortSignal,
  ): Promise<Answers<Qs>> {
    const shape: Record<string, z.ZodType> = {};
    const lines: string[] = [];
    for (const [id, q] of Object.entries(questions)) {
      if (q.type === 'choice') {
        const keys = Object.keys(q.options) as [string, ...string[]];
        shape[id] = z.object({ choice: z.enum(keys), probability: z.number().min(0).max(1) });
        lines.push(
          `- ${id} (choix) : ${q.instructions}\n  Options : ${Object.entries(q.options)
            .map(([k, v]) => `"${k}" = ${v}`)
            .join(' ; ')}`,
        );
      } else if (q.type === 'score') {
        shape[id] = z.object({
          level: z
            .number()
            .int()
            .min(0)
            .max(q.levels.length - 1),
        });
        lines.push(
          `- ${id} (niveau 0..${q.levels.length - 1}) : ${q.instructions}\n  ${q.levels
            .map((l, i) => `${i} = ${l}`)
            .join(' ; ')}`,
        );
      } else {
        shape[id] = z.object({ probability: z.number().min(0).max(1) });
        lines.push(`- ${id} (probabilité que ce soit vrai) : ${q.instructions}`);
      }
    }
    const raw = await this.llm.generateStructured({
      instructions:
        'Tu réponds à des questions de classification sur un état JSON. Réponds uniquement selon le contenu fourni.',
      prompt: `État :\n${JSON.stringify(state, null, 2)}\n\nQuestions :\n${lines.join('\n')}`,
      schema: z.object(shape),
      schemaName: 'Classification',
      signal,
    });
    const out: Record<string, unknown> = {};
    for (const [id, q] of Object.entries(questions)) {
      const a = (raw as Record<string, Record<string, number | string>>)[id] ?? {};
      if (q.type === 'choice') {
        const keys = Object.keys(q.options);
        const p = Number(a.probability ?? 0.5);
        const rest = keys.length > 1 ? (1 - p) / (keys.length - 1) : 0;
        const probabilities = Object.fromEntries(keys.map((k) => [k, k === a.choice ? p : rest]));
        out[id] = {
          type: 'choice',
          choice: String(a.choice),
          confidence: choiceConfidence(probabilities),
          probabilities,
        };
      } else if (q.type === 'score') {
        const level = Number(a.level ?? 0);
        out[id] = {
          type: 'score',
          score: level,
          confidence: 0.5,
          probabilities: { [String(level)]: 1 },
        };
      } else {
        out[id] = { type: 'noul', probability: Number(a.probability ?? 0.5) };
      }
    }
    return out as Answers<Qs>;
  }
}
