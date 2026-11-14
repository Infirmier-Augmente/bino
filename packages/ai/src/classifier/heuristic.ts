import { normalize } from '@infirmier/domain';
import type { Answers, ClassifierPort, Question } from './port';

/**
 * Classifieur local sans compréhension réelle : chevauchement de mots.
 * Confiance volontairement basse → les décisions importantes reviennent à l'IDE.
 */
export class HeuristicClassifier implements ClassifierPort {
  readonly id = 'heuristic';
  readonly semantic = false;

  async ask<Qs extends Record<string, Question>>(
    state: unknown,
    questions: Qs,
  ): Promise<Answers<Qs>> {
    const text = normalize(JSON.stringify(state));
    const words = new Set(text.split(' '));
    const out: Record<string, unknown> = {};
    for (const [id, q] of Object.entries(questions)) {
      if (q.type === 'choice') {
        const scores = Object.entries(q.options).map(([k, desc]) => {
          const terms = normalize(`${k} ${desc}`)
            .split(' ')
            .filter((t) => t.length > 3);
          return [k, terms.filter((t) => words.has(t)).length + 0.1] as const;
        });
        const total = scores.reduce((s, [, v]) => s + v, 0);
        const probabilities = Object.fromEntries(scores.map(([k, v]) => [k, v / total]));
        const choice = scores.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
        out[id] = { type: 'choice', choice, confidence: 0.2, probabilities };
      } else if (q.type === 'score') {
        out[id] = { type: 'score', score: 0, confidence: 0, probabilities: { '0': 1 } };
      } else {
        out[id] = { type: 'noul', probability: 0.5 };
      }
    }
    return out as Answers<Qs>;
  }
}
