import { Appareil, TransverseField } from '@infirmier/domain';
import { z } from 'zod';

/**
 * Format BRUT produit par un moteur de structuration (LLM ou heuristique).
 * Chaque élément porte un `quote` : extrait verbatim de la dictée.
 * Ce format n'est jamais affiché tel quel : il passe d'abord par l'ancrage des sources.
 */
export const RawStatement = z.object({
  text: z.string().describe('Reformulation courte et factuelle, style transmission infirmière.'),
  quote: z.string().describe('Extrait EXACT de la dictée, copié mot pour mot.'),
});
export type RawStatement = z.infer<typeof RawStatement>;

export const RawClinical = RawStatement.extend({ appareil: Appareil });

export const RawTarget = z.object({
  label: z.string().describe('Libellé court de la cible, ex. "Sevrage ventilatoire", "Agitation".'),
  appareil: Appareil,
  data: z.array(RawStatement),
  actions: z.array(RawStatement),
  results: z
    .array(RawStatement)
    .describe('Vide si la réévaluation n’a pas été dictée. Ne jamais inventer.'),
});
export type RawTarget = z.infer<typeof RawTarget>;

export const RawAdmission = z.object({
  motif: z.array(RawStatement),
  antecedents: z.array(RawStatement),
  histoire: z.array(RawStatement),
  autonomie: z.array(RawStatement),
  contexte: z.array(RawStatement),
});

export const RawStructuring = z.object({
  targets: z.array(RawTarget),
  observations: z.array(RawClinical),
  routine: z.array(RawClinical),
  todos: z.array(RawStatement),
  transverse: z.array(RawStatement.extend({ field: TransverseField })),
  admission: RawAdmission.nullable(),
  questions: z
    .array(RawStatement)
    .describe(
      'Questions courtes à l’IDE sur une imprécision ou incohérence ; quote = passage concerné.',
    ),
});
export type RawStructuring = z.infer<typeof RawStructuring>;

export interface StructuringContext {
  transcript: string;
  mode: 'transmission' | 'admission';
  /** Contexte minimal, sans identité (pas de nom envoyé au LLM). */
  patient: { sex: 'F' | 'M'; age: number; admissionReason: string; unitKind: string } | null;
}

export interface StructuringEngine {
  readonly id: string;
  structure(ctx: StructuringContext, signal?: AbortSignal): Promise<RawStructuring>;
}

export function emptyRaw(): RawStructuring {
  return {
    targets: [],
    observations: [],
    routine: [],
    todos: [],
    transverse: [],
    admission: null,
    questions: [],
  };
}
