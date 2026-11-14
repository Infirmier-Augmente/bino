import {
  type AdmissionContent,
  type ClinicalItem,
  completenessFlags,
  type DarTarget,
  type Flag,
  groundStatement,
  type RejectedStatement,
  type SourcedItem,
  type TransmissionContent,
  type TransverseUpdate,
} from '@infirmier/domain';
import type { RawStatement, RawStructuring } from '../engine/raw';

/**
 * PORTE D'ENTRÉE ANTI-INVENTION.
 * Tout ce qu'un moteur propose passe ici : un élément dont l'extrait n'est pas
 * retrouvé dans la dictée, ou dont un chiffre ne figure pas dans l'extrait,
 * est ÉCARTÉ (et tracé dans `rejected` pour analyse).
 */

export type IdFactory = (prefix: string) => string;

export const randomIds: IdFactory = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

export function sequentialIds(): IdFactory {
  let i = 0;
  return (prefix) => `${prefix}_${++i}`;
}

export interface AssembleResult {
  content: TransmissionContent;
  flags: Flag[];
  rejected: RejectedStatement[];
}

export function assemble(
  raw: RawStructuring,
  transmissionId: string,
  transcript: string,
  ids: IdFactory = randomIds,
): AssembleResult {
  const rejected: RejectedStatement[] = [];
  const seen = new Set<string>();

  const ground = (section: string, s: RawStatement): SourcedItem | null => {
    const r = groundStatement(transmissionId, transcript, s);
    if (!r.ok) {
      rejected.push({ section, text: s.text, quote: s.quote, reason: r.reason });
      return null;
    }
    // Un même extrait ne doit pas apparaître deux fois au même endroit.
    const key = `${section}:${r.source.start}:${r.source.end}`;
    if (seen.has(key)) {
      rejected.push({ section, text: s.text, quote: s.quote, reason: 'duplicate' });
      return null;
    }
    seen.add(key);
    return { id: ids('it'), text: s.text.trim(), sources: [r.source], edited: false };
  };
  const groundAll = (section: string, list: readonly RawStatement[]): SourcedItem[] =>
    list.map((s) => ground(section, s)).filter((x): x is SourcedItem => x !== null);

  const targets: DarTarget[] = raw.targets
    .map((t): DarTarget => {
      const section = `cible:${t.label}`;
      return {
        id: ids('cible'),
        // Un libellé vide ne doit jamais casser l'affichage : on le nomme sans rien inventer.
        label: t.label.trim() || 'Cible à nommer',
        appareil: t.appareil,
        data: groundAll(`${section}:D`, t.data),
        actions: groundAll(`${section}:A`, t.actions),
        results: groundAll(`${section}:R`, t.results),
        severity: null,
      };
    })
    // Une cible sans aucune donnée ni action sourcée n'a rien à faire là.
    .filter((t) => t.data.length + t.actions.length + t.results.length > 0);

  const clinical = (section: string, list: RawStructuring['observations']): ClinicalItem[] =>
    list
      .map((s) => {
        const item = ground(section, s);
        return item ? { ...item, appareil: s.appareil } : null;
      })
      .filter((x): x is ClinicalItem => x !== null);

  const transverse: TransverseUpdate[] = raw.transverse
    .map((s) => {
      const item = ground(`transverse:${s.field}`, s);
      return item ? { ...item, field: s.field } : null;
    })
    .filter((x): x is TransverseUpdate => x !== null);

  const admission: AdmissionContent | null = raw.admission
    ? {
        motif: groundAll('admission:motif', raw.admission.motif),
        antecedents: groundAll('admission:antecedents', raw.admission.antecedents),
        histoire: groundAll('admission:histoire', raw.admission.histoire),
        autonomie: groundAll('admission:autonomie', raw.admission.autonomie),
        contexte: groundAll('admission:contexte', raw.admission.contexte),
      }
    : null;

  const content: TransmissionContent = {
    targets,
    observations: clinical('observations', raw.observations),
    routine: clinical('routine', raw.routine),
    todos: groundAll('todos', raw.todos),
    transverse,
    admission,
  };

  const flags: Flag[] = completenessFlags(transmissionId, content);
  for (const q of raw.questions.filter((x) => x.text.trim().length > 0).slice(0, 3)) {
    const r = groundStatement(transmissionId, transcript, { text: q.quote, quote: q.quote });
    flags.push({
      id: `${transmissionId}:question:${ids('q')}`,
      kind: 'imprecision',
      question: q.text.trim(),
      targetId: null,
      sources: r.ok ? [r.source] : [],
      status: 'open',
      answer: null,
    });
  }

  return { content, flags, rejected };
}
