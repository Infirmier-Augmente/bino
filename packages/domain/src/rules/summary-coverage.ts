import type { SourcedItem } from '../schemas/common';
import type { Transmission } from '../schemas/transmission';

/**
 * FILET DE SÉCURITÉ du résumé « Tous » : rien de ce que l'IDE a dit ne doit disparaître.
 *
 * La structuration IA peut ignorer une phrase (ex. une valeur qu'elle juge « incohérente », 48 °C,
 * transformée en question au lieu d'être rangée). Toute phrase de la dictée qu'aucun élément
 * structuré ne couvre est donc reprise TELLE QUELLE, sourcée par sa position dans la dictée :
 * aucune phrase inventée, aucune correction, aucun jugement.
 */

export const UNSTRUCTURED_THEME = 'Autres informations';

/** Une phrase est « couverte » si au moins cette part de ses caractères est citée par un élément. */
const COVERED_RATIO = 0.2;

export interface Sentence {
  text: string;
  start: number;
  end: number;
}

/** « M. », « Mme. », « Dr. » ne terminent pas une phrase. */
const ABBREVIATION = /\b(?:m|mme|mlle|mr|dr|pr)\.$/i;

/** Découpe la dictée en phrases (fin : . ! ? ; ou retour à la ligne), avec leurs positions. */
export function splitSentences(transcript: string): Sentence[] {
  const out: Sentence[] = [];
  let begin = 0;
  const push = (end: number) => {
    const raw = transcript.slice(begin, end);
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (text) out.push({ text, start: begin + lead, end: begin + lead + text.length });
    begin = end;
  };
  for (let i = 0; i < transcript.length; i++) {
    const c = transcript[i];
    if (c === '\n') {
      push(i);
    } else if (c === '.' || c === '!' || c === '?' || c === ';') {
      const next = transcript[i + 1];
      const atBoundary = next === undefined || /\s/.test(next);
      if (atBoundary && !(c === '.' && ABBREVIATION.test(transcript.slice(begin, i + 1)))) {
        push(i + 1);
      }
    }
  }
  push(transcript.length);
  return out;
}

/** « Chambre 12, M. Dupond. » : la phrase qui nomme le patient n'apporte rien au résumé. */
export function isIdentificationSentence(text: string): boolean {
  return (
    text.length < 40 &&
    /^(chambre|ch\.?|box)\s*\d+|^(m\.|mme\b|mlle\b|madame\b|monsieur\b)/i.test(text)
  );
}

function contentItems(t: Transmission): SourcedItem[] {
  const c = t.content;
  const admission = c.admission
    ? [
        ...c.admission.motif,
        ...c.admission.antecedents,
        ...c.admission.histoire,
        ...c.admission.autonomie,
        ...c.admission.contexte,
      ]
    : [];
  return [
    ...c.targets.flatMap((g) => [...g.data, ...g.actions, ...g.results]),
    ...c.observations,
    ...c.routine,
    ...c.todos,
    ...c.transverse,
    ...admission,
  ];
}

/** Nombre de caractères de [start, end[ couverts par l'union des intervalles cités. */
function coveredLength(start: number, end: number, spans: readonly [number, number][]): number {
  const clipped = spans
    .map(([s, e]) => [Math.max(s, start), Math.min(e, end)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursor = start;
  for (const [s, e] of clipped) {
    const from = Math.max(s, cursor);
    if (e > from) {
      total += e - from;
      cursor = e;
    }
  }
  return total;
}

/**
 * Phrases de la dictée qu'aucun élément structuré ne cite (soins de routine compris, qui sont
 * rangés mais pas montrés) : chacune devient un élément sourcé, texte mot pour mot.
 */
export function uncoveredItems(t: Transmission): SourcedItem[] {
  const transcript = t.dictation.transcript;
  const spans: [number, number][] = [];
  for (const item of contentItems(t)) {
    for (const s of item.sources) {
      if (s.kind === 'dictation' && s.transmissionId === t.id) spans.push([s.start, s.end]);
    }
  }
  return splitSentences(transcript)
    .filter((s) => !isIdentificationSentence(s.text))
    .filter((s) => coveredLength(s.start, s.end, spans) < COVERED_RATIO * (s.end - s.start))
    .map((s) => ({
      id: `${t.id}:libre:${s.start}`,
      text: s.text,
      edited: false,
      sources: [
        { kind: 'dictation', transmissionId: t.id, quote: s.text, start: s.start, end: s.end },
      ],
    }));
}
