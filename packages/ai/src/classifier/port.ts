/**
 * PORT CLASSIFIEUR — jugements typés avec probabilités (modèle "System One").
 * Calqué sur les primitives TypeSafe/Jev (Choice, Score, Noul) mais indépendant
 * du fournisseur : implémenté par Jev, par un LLM, ou par des règles locales.
 *
 * Plusieurs questions sur un même état = un seul appel (évaluées indépendamment).
 */

export type Question =
  | { type: 'choice'; instructions: string; options: Record<string, string> }
  | { type: 'score'; instructions: string; levels: readonly string[] }
  | { type: 'noul'; instructions: string };

export type Answer<Q extends Question> = Q extends { type: 'choice' }
  ? { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
  : Q extends { type: 'score' }
    ? { type: 'score'; score: number; confidence: number; probabilities: Record<string, number> }
    : { type: 'noul'; probability: number };

export type Answers<Qs extends Record<string, Question>> = { [K in keyof Qs]: Answer<Qs[K]> };

export interface ClassifierPort {
  readonly id: string;
  /** false = règles locales sans vraie compréhension : à n'utiliser qu'en repli. */
  readonly semantic: boolean;
  ask<Qs extends Record<string, Question>>(
    state: unknown,
    questions: Qs,
    signal?: AbortSignal,
  ): Promise<Answers<Qs>>;
}

/** Confiance d'un Choice telle que définie par TypeSafe : (pmax − 1/n) / (1 − 1/n). */
export function choiceConfidence(probabilities: Record<string, number>): number {
  const values = Object.values(probabilities);
  const n = values.length;
  if (n <= 1) return 1;
  const pmax = Math.max(...values);
  return Math.max(0, Math.min(1, (pmax - 1 / n) / (1 - 1 / n)));
}
