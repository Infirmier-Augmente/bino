/**
 * Découpe une dictée en propositions, en gardant les positions exactes
 * dans le texte d'origine (indispensable pour citer la source).
 */
export interface Clause {
  /** Texte exact de la proposition (sous-chaîne du transcript). */
  text: string;
  start: number;
  end: number;
  /** Index de la phrase d'origine. */
  sentence: number;
  /** La proposition commence par "par contre", "mais"… (rupture de contexte). */
  contrast: boolean;
}

// (?=[\s,]|$) plutôt que \b : \b ne gère pas les lettres accentuées ("là", "voilà").
const CONTRAST = /^(?:par contre|en revanche|mais|cependant|sauf que)(?=[\s,]|$)/i;
const FILLERS =
  /^(?:(?:alors|donc|là|euh|bon|et|puis|ensuite|sinon|voilà|du coup|par contre|en revanche|mais)(?=[\s,]|$)[\s,]*)+/i;

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function segment(transcript: string): Clause[] {
  const clauses: Clause[] = [];
  let sentenceIdx = 0;
  let cursor = 0;
  const pushSentence = (from: number, to: number) => {
    const sentence = transcript.slice(from, to);
    // Séparateurs internes : virgules, et " et " / " puis " entre deux propositions assez longues.
    const parts: { start: number; end: number }[] = [];
    let partStart = 0;
    // Virgule hors nombre décimal ("37,8" reste entier).
    const re = /(?<!\d),|,(?!\d)|\s+(?:et|puis)\s+/g;
    for (let m = re.exec(sentence); m !== null; m = re.exec(sentence)) {
      const left = sentence.slice(partStart, m.index);
      const right = sentence.slice(m.index + m[0].length);
      const isConjunction = m[0].trim() !== ',';
      if (isConjunction && (words(left) < 3 || words(right.split(/,|\.|;/)[0] ?? '') < 3)) continue;
      parts.push({ start: partStart, end: m.index });
      partStart = m.index + m[0].length;
    }
    parts.push({ start: partStart, end: sentence.length });
    for (const p of parts) {
      let s = from + p.start;
      let e = from + p.end;
      while (s < e && /\s/.test(transcript.charAt(s))) s++;
      while (e > s && /\s/.test(transcript.charAt(e - 1))) e--;
      if (e <= s) continue;
      const text = transcript.slice(s, e);
      clauses.push({
        text,
        start: s,
        end: e,
        sentence: sentenceIdx,
        contrast: CONTRAST.test(text),
      });
    }
    sentenceIdx++;
  };
  // Un point n'est une fin de phrase que s'il est suivi d'un espace ("37.8" reste entier).
  const sentenceEnd = /[.!?;]+(?=\s|$)|\n+/g;
  for (let m = sentenceEnd.exec(transcript); m !== null; m = sentenceEnd.exec(transcript)) {
    pushSentence(cursor, m.index);
    cursor = m.index + m[0].length;
  }
  if (cursor < transcript.length) pushSentence(cursor, transcript.length);
  return clauses;
}

/** Retire les mots de liaison oraux en tête ("alors", "là", "par contre"…). */
export function stripFillers(text: string): string {
  return text.replace(FILLERS, '').trim();
}

export function wordCount(text: string): number {
  return words(text);
}
