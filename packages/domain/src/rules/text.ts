/**
 * Outils texte français, sans dépendance. Base de l'ancrage des sources :
 * on compare des versions NORMALISÉES mais on garde la correspondance avec
 * les positions du texte ORIGINAL pour pouvoir surligner l'extrait exact.
 */

export interface NormalizedText {
  /** Texte normalisé : minuscules, sans accents, ponctuation → espace, espaces fusionnés. */
  value: string;
  /** map[i] = index dans le texte original du caractère normalisé i. */
  map: number[];
}

const COMBINING_MARKS = /[̀-ͯ]/g;

function foldChar(ch: string): string {
  const folded = ch.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
  if (folded === 'œ') return 'oe';
  if (folded === 'æ') return 'ae';
  return folded;
}

function isWordChar(ch: string): boolean {
  return /[a-z0-9]/.test(ch);
}

export function normalizeWithMap(input: string): NormalizedText {
  let value = '';
  const map: number[] = [];
  let pendingSpace = false;
  for (let i = 0; i < input.length; i++) {
    const folded = foldChar(input.charAt(i));
    for (const ch of folded) {
      if (isWordChar(ch)) {
        if (pendingSpace && value.length > 0) {
          value += ' ';
          map.push(i);
        }
        pendingSpace = false;
        value += ch;
        map.push(i);
      } else {
        pendingSpace = true;
      }
    }
  }
  return { value, map };
}

export function normalize(input: string): string {
  return normalizeWithMap(input).value;
}

export interface Token {
  value: string;
  /** Position dans le texte normalisé. */
  start: number;
  end: number;
}

export function tokenize(normalized: string): Token[] {
  const tokens: Token[] = [];
  const re = /[a-z0-9]+/g;
  for (let m = re.exec(normalized); m !== null; m = re.exec(normalized)) {
    tokens.push({ value: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/** Distance de Levenshtein bornée (retourne max+1 dès que la borne est dépassée). */
export function levenshtein(a: string, b: string, max = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      const v = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length] ?? max + 1;
}

const UNITS: Record<string, number> = {
  zero: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  cent: 100,
  mille: 1000,
  demi: 0.5,
};

/**
 * Nombres présents dans un texte, en chiffres ou en lettres simples
 * ("trois litres" → 3, "16h30" → 16 et 30, "dix-sept" → 17).
 */
export function extractNumbers(
  input: string,
  options: { includeArticles?: boolean } = {},
): number[] {
  const includeArticles = options.includeArticles ?? true;
  // "O2", "FiO2", "SpO2", "CO2" sont des notations, pas des valeurs.
  const cleaned = input
    .replace(/\b(?:fi|sp|sa|pa|et)?[oc]o?2\b/gi, ' ')
    .replace(/(\d),(\d)/g, '$1.$2');
  const norm = normalize(cleaned);
  const out: number[] = [];
  const decimal = cleaned.match(/\d+(?:\.\d+)?/g) ?? [];
  for (const d of decimal) out.push(Number(d));
  const tokens = tokenize(norm).map((t) => t.value);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] ?? '';
    const v = UNITS[tok];
    if (v === undefined) continue;
    if (!includeArticles && (tok === 'un' || tok === 'une')) continue;
    // "dix sept", "vingt deux", "soixante dix"
    const next = tokens[i + 1];
    const nextV = next !== undefined ? UNITS[next] : undefined;
    if (nextV !== undefined && v >= 10 && v < 100 && nextV < 10) {
      out.push(v + nextV);
      i++;
    } else if (nextV !== undefined && v === 60 && nextV >= 10 && nextV < 20) {
      out.push(v + nextV);
      i++;
    } else {
      out.push(v);
    }
  }
  return out;
}

/** Première lettre en majuscule. */
export function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/** Termine une phrase par un point si nécessaire. */
export function asSentence(s: string): string {
  const t = capitalize(s.trim());
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}
