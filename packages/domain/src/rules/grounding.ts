import type { SourceRef } from '../schemas/common';
import { extractNumbers, normalize, normalizeWithMap, tokenize } from './text';

/**
 * ANCRAGE DES SOURCES — ligne rouge du produit : "zéro information inventée".
 *
 * Chaque phrase proposée par l'IA doit citer un extrait de la dictée.
 * On vérifie ici que l'extrait existe vraiment (tolérance aux variations
 * d'accents, de ponctuation et à de petites erreurs de transcription),
 * et que les nombres de la reformulation figurent bien dans l'extrait.
 */

export interface QuoteLocation {
  start: number;
  end: number;
  /** Extrait exact du texte original. */
  quote: string;
  /** 1 = correspondance exacte (après normalisation). */
  score: number;
}

const FUZZY_THRESHOLD = 0.75;

export function locateQuote(transcript: string, quote: string): QuoteLocation | null {
  const t = normalizeWithMap(transcript);
  const q = normalize(quote);
  if (q.length === 0 || t.value.length === 0) return null;

  // Correspondance exacte, mais uniquement sur des frontières de mots :
  // « tension à 12 » ne doit pas valider un extrait coupé de « tension à 125 ».
  for (let i = t.value.indexOf(q); i >= 0; i = t.value.indexOf(q, i + 1)) {
    const before = i === 0 || t.value.charAt(i - 1) === ' ';
    const after = i + q.length === t.value.length || t.value.charAt(i + q.length) === ' ';
    if (before && after) return toLocation(transcript, t.map, i, i + q.length, 1);
  }

  // Correspondance approchée : fenêtre glissante de tokens.
  const tTokens = tokenize(t.value);
  const qTokens = tokenize(q).map((x) => x.value);
  if (qTokens.length === 0 || tTokens.length === 0) return null;

  let best: { i: number; j: number; score: number } | null = null;
  const minLen = Math.max(1, qTokens.length - 2);
  const maxLen = qTokens.length + 2;
  for (let i = 0; i < tTokens.length; i++) {
    for (let len = minLen; len <= maxLen && i + len <= tTokens.length; len++) {
      const window = tTokens.slice(i, i + len).map((x) => x.value);
      const score = similarity(qTokens, window);
      if (!best || score > best.score) best = { i, j: i + len - 1, score };
    }
  }
  if (!best || best.score < FUZZY_THRESHOLD) return null;
  const startTok = tTokens[best.i];
  const endTok = tTokens[best.j];
  if (!startTok || !endTok) return null;
  return toLocation(transcript, t.map, startTok.start, endTok.end, best.score);
}

function toLocation(
  original: string,
  map: number[],
  nStart: number,
  nEnd: number,
  score: number,
): QuoteLocation {
  const start = map[nStart] ?? 0;
  const lastIdx = map[nEnd - 1] ?? start;
  const end = Math.min(original.length, lastIdx + 1);
  return { start, end, quote: original.slice(start, end), score };
}

/** Similarité ordonnée (LCS) entre deux suites de tokens, tolérante aux fautes légères. */
function similarity(a: string[], b: string[]): number {
  const eq = (x: string, y: string) =>
    x === y || (x.length >= 5 && y.length >= 5 && (x.startsWith(y) || y.startsWith(x)));
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++) {
    const row = dp[i] as number[];
    const prevRow = dp[i - 1] as number[];
    for (let j = 1; j <= b.length; j++) {
      row[j] = eq(a[i - 1] ?? '', b[j - 1] ?? '')
        ? (prevRow[j - 1] ?? 0) + 1
        : Math.max(prevRow[j] ?? 0, row[j - 1] ?? 0);
    }
  }
  const lcs = dp[a.length]?.[b.length] ?? 0;
  return lcs / Math.max(a.length, b.length);
}

/**
 * Tous les nombres de la reformulation doivent apparaître dans l'extrait source
 * (évite "SpO2 96 %" inventé, ou "3 L/min" devenu "5 L/min").
 */
export function numbersAreGrounded(text: string, quote: string): boolean {
  const inQuote = new Set(extractNumbers(quote));
  // « Une ampoule » face à « deux ampoules » doit être refusé ; mais « Une séance de kiné »
  // face à « la kiné est passée » (aucun nombre) reste acceptable.
  const quoteHasNumber = extractNumbers(quote, { includeArticles: false }).length > 0;
  return extractNumbers(text, { includeArticles: quoteHasNumber }).every((n) => inQuote.has(n));
}

export type GroundingResult =
  | { ok: true; source: Extract<SourceRef, { kind: 'dictation' }> }
  | { ok: false; reason: 'quote-not-found' | 'number-mismatch' | 'empty' };

export function groundStatement(
  transmissionId: string,
  transcript: string,
  statement: { text: string; quote: string },
): GroundingResult {
  if (statement.text.trim().length === 0 || statement.quote.trim().length === 0) {
    return { ok: false, reason: 'empty' };
  }
  const loc = locateQuote(transcript, statement.quote);
  if (!loc) return { ok: false, reason: 'quote-not-found' };
  if (!numbersAreGrounded(statement.text, loc.quote)) {
    return { ok: false, reason: 'number-mismatch' };
  }
  return {
    ok: true,
    source: {
      kind: 'dictation',
      transmissionId,
      quote: loc.quote,
      start: loc.start,
      end: loc.end,
    },
  };
}
