import { z } from 'zod';
import type { AiConfig } from '../config';
import type { Answers, ClassifierPort, Question } from './port';

/**
 * Adaptateur TypeSafe / Jev (https://docs.typesafe.ai) — POST /v1/systemone.
 * Jev renvoie des réponses typées avec probabilités calibrées : idéal pour
 * départager deux patients ou estimer la gravité d'une cible, sans générer de texte.
 */

const ChoiceAnswer = z.object({
  type: z.literal('choice'),
  choice: z.string(),
  confidence: z.number(),
  probabilities: z.record(z.string(), z.number()),
});
const ScoreAnswer = z.object({
  type: z.literal('score'),
  score: z.number(),
  confidence: z.number(),
  probabilities: z.record(z.string(), z.number()),
});
const NoulAnswer = z.object({ type: z.literal('noul'), noul: z.number() });

const JevResponse = z.object({
  model: z.string(),
  answers: z.record(
    z.string(),
    z.discriminatedUnion('type', [ChoiceAnswer, ScoreAnswer, NoulAnswer]),
  ),
});

export class JevClassifier implements ClassifierPort {
  readonly id: string;
  readonly semantic = true;

  constructor(
    private readonly cfg: AiConfig['classifier'],
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly retries = 2,
  ) {
    this.id = `jev:${cfg.jevModel}`;
  }

  async ask<Qs extends Record<string, Question>>(
    state: unknown,
    questions: Qs,
    signal?: AbortSignal,
  ): Promise<Answers<Qs>> {
    const body = {
      model: this.cfg.jevModel,
      state,
      questions: Object.fromEntries(
        Object.entries(questions).map(([id, q]) => [
          id,
          q.type === 'choice'
            ? { type: 'choice', instructions: q.instructions, criteria: q.options }
            : q.type === 'score'
              ? { type: 'score', instructions: q.instructions, criteria: q.levels }
              : { type: 'noul', instructions: q.instructions },
        ]),
      ),
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const res = await this.fetchImpl(`${this.cfg.jevBaseUrl.replace(/\/$/, '')}/v1/systemone`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.cfg.jevApiKey ?? ''}`,
        },
        body: JSON.stringify(body),
        signal,
      });
      if (res.status === 429 || res.status === 529) {
        lastError = new Error(`Jev surchargé (${res.status})`);
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** attempt,
        );
        continue;
      }
      if (!res.ok) {
        throw new Error(`Jev ${res.status} : ${(await res.text()).slice(0, 300)}`);
      }
      const data = JevResponse.parse(await res.json());
      const out: Record<string, unknown> = {};
      for (const id of Object.keys(questions)) {
        const a = data.answers[id];
        if (!a) throw new Error(`Jev : réponse manquante pour « ${id} »`);
        out[id] = a.type === 'noul' ? { type: 'noul', probability: a.noul } : a;
      }
      return out as Answers<Qs>;
    }
    throw lastError instanceof Error ? lastError : new Error('Jev indisponible');
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
