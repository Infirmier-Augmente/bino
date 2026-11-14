export interface Segment {
  text: string;
  /** null = texte normal ; 'source' = extrait cité ; 'active' = extrait sélectionné. */
  mark: null | 'source' | 'active';
}

/**
 * Découpe une dictée en segments pour surligner les extraits cités
 * (chaque phrase structurée renvoie à son extrait d'origine).
 */
export function highlightSegments(
  text: string,
  ranges: readonly { start: number; end: number }[],
  active: { start: number; end: number } | null,
): Segment[] {
  const marks = new Array<Segment['mark']>(text.length).fill(null);
  for (const r of ranges) {
    for (let i = Math.max(0, r.start); i < Math.min(text.length, r.end); i++) marks[i] = 'source';
  }
  if (active) {
    for (let i = Math.max(0, active.start); i < Math.min(text.length, active.end); i++)
      marks[i] = 'active';
  }
  const out: Segment[] = [];
  for (let i = 0; i < text.length; i++) {
    const mark = marks[i] ?? null;
    const last = out.at(-1);
    if (last && last.mark === mark) last.text += text.charAt(i);
    else out.push({ text: text.charAt(i), mark });
  }
  return out;
}
