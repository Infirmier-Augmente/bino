import {
  ACTION_MARKERS,
  type Appareil,
  asSentence,
  detectAppareil,
  detectTargetRule,
  findKeywords,
  findRoomMentions,
  normalize,
  RESULT_MARKERS,
  ROUTINE_MARKERS,
  TODO_MARKERS,
  type TransverseField,
} from '@infirmier/domain';
import {
  emptyRaw,
  type RawStatement,
  type RawStructuring,
  type RawTarget,
  type StructuringContext,
  type StructuringEngine,
} from '../raw';
import { type Clause, segment, stripFillers, wordCount } from './segment';

/**
 * MOTEUR HEURISTIQUE — structuration par règles, sans réseau, déterministe.
 * Rôles : repli quand le LLM est indisponible (mode dégradé), tests reproductibles,
 * développement sans clé. Moins fin qu'un LLM, mais il ne peut rien inventer :
 * chaque phrase EST un morceau de la dictée.
 */

const HEADINGS: Record<string, Appareil> = {
  neuro: 'neuro',
  neurologique: 'neuro',
  respi: 'respiratoire',
  respiratoire: 'respiratoire',
  ventil: 'respiratoire',
  ventilatoire: 'respiratoire',
  hemodynamique: 'hemodynamique',
  hemodyn: 'hemodynamique',
  hemodynamiquement: 'hemodynamique',
  cardio: 'hemodynamique',
  dig: 'digestif',
  digestif: 'digestif',
  elim: 'renal',
  renal: 'renal',
  urinaire: 'renal',
  cutane: 'cutane',
  peau: 'cutane',
  douleur: 'douleur',
  psy: 'psy',
};

const TRANSVERSE_PATTERNS: [TransverseField, RegExp][] = [
  ['allergies', /\ballerg/],
  [
    'precautions',
    /\b(bmr|bhre|isolement|precautions? (contact|complementaires|gouttelettes|air)|clostridium)\b/,
  ],
  [
    'engagement',
    /\b(lata|limitation des therapeutiques|pas de reanimation|ne pas reanimer|directives anticipees)\b/,
  ],
  ['personneDeConfiance', /\bpersonne de confiance\b/],
  [
    'examens',
    /\b(scanner|irm|echo|echographie|fibroscopie|coloscopie|bloc|endoscopie|ponction|examen)\b.*\b(prevu|prevue|demain|programme|programmee|a jeun|ce soir|cette nuit|a \d+ ?h)\b|\b(prevu|prevue|programme|programmee)\b.*\b(scanner|irm|echo|echographie|fibroscopie|coloscopie|bloc|endoscopie|ponction)\b/,
  ],
  [
    'prescriptions',
    /\b(nouvelle prescription|prescrit|prescrite|introduction|introduit|introduite)\b/,
  ],
  [
    'famille',
    /\b(famille|fille|fils|epouse|mari|proches|enfants|soeur|frere)\b.*\b(vu|vue|venu|venue|venus|appele|appelee|informe|informee|passe|passee|visite)\b|\b(vu|appele|informe)\b.*\b(famille|fille|fils|epouse|mari)\b/,
  ],
];

const ADMISSION_PATTERNS: [keyof NonNullable<RawStructuring['admission']>, RegExp][] = [
  [
    'antecedents',
    /\b(antecedent|antecedents|atcd|connu pour|connue pour|diabetique|hypertendu|hypertendue|bpco|deja opere|deja operee)\b/,
  ],
  [
    'autonomie',
    /\b(autonome|marche|deambulateur|canne|fauteuil|grabataire|aide pour|aide a la toilette|seul pour|seule pour)\b/,
  ],
  ['contexte', /\b(vit seul|vit seule|domicile|ehpad|aidant|aide a domicile|vit avec)\b/],
  [
    'motif',
    /\b(entre pour|entree pour|admis pour|admise pour|hospitalise pour|hospitalisee pour|adresse pour|adressee pour|motif|pour une|pour un)\b/,
  ],
  ['histoire', /\b(depuis|il y a|hier|avant hier|aux urgences|retrouve|retrouvee|a domicile)\b/],
];

function statement(transcript: string, start: number, end: number): RawStatement {
  const quote = transcript.slice(start, end);
  return { text: asSentence(stripFillers(quote)), quote };
}

function detectTransverse(n: string): TransverseField | null {
  for (const [field, re] of TRANSVERSE_PATTERNS) if (re.test(n)) return field;
  return null;
}

function headingOf(clause: Clause): { appareil: Appareil; rest: string } | null {
  const cleaned = stripFillers(clause.text);
  const n = normalize(cleaned);
  const first = n.split(' ')[0] ?? '';
  const appareil = HEADINGS[first];
  if (!appareil) return null;
  return { appareil, rest: n.slice(first.length).trim() };
}

function isPatientDesignation(clause: Clause): boolean {
  const n = normalize(clause.text);
  const mentionsPatient =
    findRoomMentions(clause.text).length > 0 || /\b(monsieur|madame|patient|patiente)\b/.test(n);
  return (
    mentionsPatient &&
    detectAppareil(clause.text) === null &&
    detectTargetRule(clause.text) === null
  );
}

interface OpenTarget {
  target: RawTarget;
  sentence: number;
  heading: number;
}

interface LastItem {
  list: RawStatement[];
  index: number;
  start: number;
  sentence: number;
}

export class HeuristicEngine implements StructuringEngine {
  readonly id = 'heuristic';

  async structure(ctx: StructuringContext): Promise<RawStructuring> {
    return structureHeuristically(ctx);
  }
}

export function structureHeuristically(ctx: StructuringContext): RawStructuring {
  const { transcript } = ctx;
  const out = emptyRaw();
  if (ctx.mode === 'admission') {
    out.admission = { motif: [], antecedents: [], histoire: [], autonomie: [], contexte: [] };
  }

  let currentAppareil: Appareil | null = null;
  let headingCount = 0;
  let open: OpenTarget | null = null;
  let last: LastItem | null = null;

  const remember = (list: RawStatement[], clause: Clause) => {
    last = { list, index: list.length - 1, start: clause.start, sentence: clause.sentence };
  };

  for (const clause of segment(transcript)) {
    if (isPatientDesignation(clause)) continue;

    const heading = headingOf(clause);
    if (heading) {
      currentAppareil = heading.appareil;
      headingCount++;
      open = null;
      if (heading.rest.length === 0) continue; // "Neuro," seul
    }

    const n = normalize(clause.text);
    const has = (markers: readonly string[]) => findKeywords(n, markers).length > 0;
    const isAction = has(ACTION_MARKERS);
    const isResult = has(RESULT_MARKERS);
    const appareil: Appareil = detectAppareil(clause.text) ?? currentAppareil ?? 'general';
    const stmt = statement(transcript, clause.start, clause.end);

    if (clause.contrast) open = null;

    // Proposition très courte sans mot-clé ("c'est propre", "OK") : complète la précédente.
    const lastItem = last as LastItem | null;
    if (
      lastItem &&
      lastItem.sentence === clause.sentence &&
      wordCount(clause.text) <= 3 &&
      detectAppareil(clause.text) === null &&
      detectTargetRule(clause.text) === null &&
      !open
    ) {
      const prev = lastItem.list[lastItem.index];
      if (prev) {
        const merged = statement(transcript, lastItem.start, clause.end);
        lastItem.list[lastItem.index] = { ...prev, ...merged };
        continue;
      }
    }

    if (out.admission) {
      const category = ADMISSION_PATTERNS.find(([, re]) => re.test(n))?.[0];
      if (category && !(category === 'motif' && out.admission.motif.length > 0)) {
        out.admission[category].push(stmt);
        remember(out.admission[category], clause);
        continue;
      }
    }

    const transverse = detectTransverse(n);
    if (transverse) {
      out.transverse.push({ ...stmt, field: transverse });
      continue;
    }

    if (has(TODO_MARKERS)) {
      out.todos.push(stmt);
      remember(out.todos, clause);
      continue;
    }

    const rule = detectTargetRule(clause.text);
    if (rule) {
      if (!open || open.target.label !== rule.label) {
        const target: RawTarget = {
          label: rule.label,
          appareil: rule.appareil,
          data: [],
          actions: [],
          results: [],
        };
        out.targets.push(target);
        open = { target, sentence: clause.sentence, heading: headingCount };
      }
      const bucket =
        isResult && !isAction
          ? open.target.results
          : isAction
            ? open.target.actions
            : open.target.data;
      bucket.push(stmt);
      open.sentence = clause.sentence;
      remember(bucket, clause);
      continue;
    }

    const openTarget = open as OpenTarget | null;
    if (
      openTarget &&
      openTarget.heading === headingCount &&
      (openTarget.sentence === clause.sentence ||
        detectAppareil(clause.text) === null ||
        detectAppareil(clause.text) === openTarget.target.appareil)
    ) {
      const t = openTarget.target;
      const bucket = isResult && !isAction ? t.results : isAction ? t.actions : t.data;
      bucket.push(stmt);
      openTarget.sentence = clause.sentence;
      remember(bucket, clause);
      continue;
    }
    open = null;

    if (has(ROUTINE_MARKERS) || isAction) {
      out.routine.push({ ...stmt, appareil });
      remember(out.routine, clause);
      continue;
    }

    out.observations.push({ ...stmt, appareil });
    remember(out.observations, clause);
  }

  return out;
}
