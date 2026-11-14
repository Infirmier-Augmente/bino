import { APPAREIL_LABELS, type SourcedItem, type SourceRef } from '../schemas/common';
import { type Nurse, TRANSVERSE_LABELS } from '../schemas/hospital';
import type { Flag, Transmission } from '../schemas/transmission';
import type { SummaryBullet, SummaryContributor } from '../schemas/views';
import { openFlagsWithContinuity } from './completeness';
import { normalize } from './text';
import { formatClock } from './time';

/**
 * RÉSUMÉ « TOUS » (Bino) — une puce par thème, faite UNIQUEMENT d'éléments sourcés des
 * transmissions du poste (toute l'équipe, tous statuts de relecture). Aucune phrase générée :
 * on regroupe, on ordonne et on attribue (qui, quand). Les soins de routine n'y figurent pas.
 *
 * Thèmes : libellé de la cible DAR (D, A puis R), appareil d'une observation, « À faire »,
 * rubrique d'une info transverse, « Entrée » pour la macro-cible d'entrée.
 */

export const ADMISSION_THEME = 'Entrée';
export const TODO_THEME = 'À faire';
const UNKNOWN_AUTHOR = 'Un soignant';

interface Group {
  theme: string;
  items: SourcedItem[];
  /** Cibles DAR d'origine (`transmissionId:targetId`), pour rattacher la question « R manquant ». */
  targetKeys: string[];
  /** Position du premier extrait dans la dictée (ordre de la dictée). */
  position: number;
}

interface BulletDraft {
  key: string;
  theme: string;
  items: SourcedItem[];
  targetKeys: string[];
  /** Heure de la dernière transmission du thème (si aucun auteur n'est identifiable). */
  latestTransmissionAt: string;
}

/** Ajoute un point final seulement s'il manque une ponctuation de fin de phrase. */
export function asSentenceEnd(text: string): string {
  const s = text.trim();
  return /[.!?…]$/.test(s) ? s : `${s}.`;
}

function firstOffset(items: readonly SourcedItem[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const i of items)
    for (const s of i.sources) if (s.kind === 'dictation' && s.start < min) min = s.start;
  return min;
}

function byPosition(a: Group, b: Group): number {
  if (a.position === b.position) return 0;
  return a.position < b.position ? -1 : 1;
}

/** Les groupes thématiques d'une transmission, dans l'ordre de la dictée (routine exclue). */
function transmissionGroups(t: Transmission): Group[] {
  const groups: Group[] = [];
  const add = (theme: string, items: readonly SourcedItem[], targetKey?: string) => {
    if (items.length === 0) return;
    groups.push({
      theme,
      items: [...items],
      targetKeys: targetKey ? [targetKey] : [],
      position: firstOffset(items),
    });
  };
  const c = t.content;
  if (c.admission) {
    const a = c.admission;
    add(ADMISSION_THEME, [
      ...a.motif,
      ...a.antecedents,
      ...a.histoire,
      ...a.autonomie,
      ...a.contexte,
    ]);
  }
  for (const target of c.targets) {
    add(
      target.label,
      [...target.data, ...target.actions, ...target.results],
      `${t.id}:${target.id}`,
    );
  }
  for (const o of c.observations) add(APPAREIL_LABELS[o.appareil], [o]);
  for (const todo of c.todos) add(TODO_THEME, [todo]);
  for (const u of c.transverse) add(TRANSVERSE_LABELS[u.field], [u]);
  // Tri stable : sans extrait (ou à égalité), l'ordre des rubriques ci-dessus est gardé.
  return groups.sort(byPosition);
}

function sourceKey(s: SourceRef): string {
  switch (s.kind) {
    case 'dictation':
      return `dictation|${s.transmissionId}|${s.start}|${s.end}`;
    case 'nurse':
      return `nurse|${s.nurseId}|${s.at}`;
    case 'record':
      return `record|${s.field}|${s.label}`;
  }
}

/** Ajoute un élément au thème ; un texte identique (normalisé) n'est pas répété, ses sources s'ajoutent. */
function addItem(items: SourcedItem[], item: SourcedItem): void {
  const text = normalize(item.text);
  const same = items.find((i) => normalize(i.text) === text);
  const clean: SourcedItem = {
    id: item.id,
    text: item.text,
    sources: [...item.sources],
    edited: item.edited,
  };
  if (!same) {
    items.push(clean);
    return;
  }
  const known = new Set(same.sources.map(sourceKey));
  for (const s of clean.sources) if (!known.has(sourceKey(s))) same.sources.push(s);
}

/** Qui et quand, d'après les sources : auteur de la dictée citée, ou soignant ayant saisi. */
function contributors(
  items: readonly SourcedItem[],
  transmissions: ReadonlyMap<string, Transmission>,
  firstNames: ReadonlyMap<string, string>,
  timeZone: string,
): SummaryContributor[] {
  const seen = new Map<string, { nurseId: string; at: string }>();
  for (const item of items) {
    for (const s of item.sources) {
      if (s.kind === 'dictation') {
        const t = transmissions.get(s.transmissionId);
        const key = t ? `${t.nurseId}|transmission:${t.id}` : null;
        if (t && key && !seen.has(key)) seen.set(key, { nurseId: t.nurseId, at: t.createdAt });
      } else if (s.kind === 'nurse') {
        const key = `${s.nurseId}|at:${s.at}`;
        if (!seen.has(key)) seen.set(key, { nurseId: s.nurseId, at: s.at });
      }
    }
  }
  return [...seen.values()]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((c) => ({
      nurseId: c.nurseId,
      firstName: firstNames.get(c.nurseId) ?? UNKNOWN_AUTHOR,
      at: c.at,
      time: formatClock(c.at, timeZone),
    }));
}

/** Question « R manquant » encore ouverte (continuité des cibles respectée), par cible. */
function openMissingResults(transmissions: readonly Transmission[]): Map<string, string> {
  const open = new Set<Flag>(openFlagsWithContinuity(transmissions));
  const questions = new Map<string, string>();
  for (const t of transmissions) {
    for (const f of t.flags) {
      if (f.kind === 'missing-result' && f.targetId && open.has(f)) {
        questions.set(`${t.id}:${f.targetId}`, f.question);
      }
    }
  }
  return questions;
}

export interface SummaryInput {
  patientId: string;
  /** Transmissions de la fenêtre de relève (tous statuts) ; celles d'autres patients sont ignorées. */
  transmissions: readonly Transmission[];
  nurses: readonly Pick<Nurse, 'id' | 'firstName'>[];
  timeZone: string;
}

/** Puces du résumé d'un patient, de la plus récente à la plus ancienne. */
export function buildSummaryBullets({
  patientId,
  transmissions,
  nurses,
  timeZone,
}: SummaryInput): SummaryBullet[] {
  const live = transmissions
    .filter((t) => t.patientId === patientId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const byId = new Map(live.map((t) => [t.id, t]));
  const firstNames = new Map(nurses.map((n) => [n.id, n.firstName]));
  const questions = openMissingResults(live);

  const drafts = new Map<string, BulletDraft>();
  for (const t of live) {
    for (const g of transmissionGroups(t)) {
      const key = normalize(g.theme) || g.theme;
      let draft = drafts.get(key);
      if (!draft) {
        draft = {
          key,
          theme: g.theme,
          items: [],
          targetKeys: [],
          latestTransmissionAt: t.createdAt,
        };
        drafts.set(key, draft);
      }
      draft.targetKeys.push(...g.targetKeys);
      draft.latestTransmissionAt = t.createdAt;
      for (const item of g.items) addItem(draft.items, item);
    }
  }

  const bullets: SummaryBullet[] = [...drafts.values()].map((d) => {
    const who = contributors(d.items, byId, firstNames, timeZone);
    // La question la plus récente l'emporte (transmissions parcourues dans l'ordre chronologique).
    const question = d.targetKeys.reduce<string | null>((q, k) => questions.get(k) ?? q, null);
    return {
      id: `bullet:${patientId}:${d.key.replace(/ /g, '-')}`,
      theme: d.theme,
      items: d.items,
      text: d.items.map((i) => asSentenceEnd(i.text)).join(' '),
      contributors: who,
      lastAt: who[0]?.at ?? d.latestTransmissionAt,
      question,
    };
  });
  return bullets.sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
}
