import type { LiveServerMessage } from '@infirmier/domain';

/**
 * SEGMENTS de la dictée en direct (logique pure). L'API découpe la dictée aux pauses de la
 * voix : chaque segment a d'abord un texte PROVISOIRE (mot à mot), puis son texte DÉFINITIF
 * (meilleur modèle, nombres en chiffres) qui le remplace, pendant que l'IDE continue de parler.
 */
export interface LiveSegment {
  index: number;
  provisional: string;
  /** Texte définitif ; `null` tant qu'il n'est pas arrivé. */
  final: string | null;
}

/** Segments triés par numéro. Un segment inchangé garde le même objet (rendu minimal). */
export type LiveSegments = readonly LiveSegment[];

function upsert(
  segments: LiveSegments,
  index: number,
  change: (s: LiveSegment) => LiveSegment,
): LiveSegments {
  const at = segments.findIndex((s) => s.index === index);
  if (at >= 0) {
    const prev = segments[at];
    if (!prev) return segments;
    const next = change(prev);
    if (next === prev) return segments;
    return [...segments.slice(0, at), next, ...segments.slice(at + 1)];
  }
  // Message arrivé dans le désordre : le segment est inséré à sa place.
  const created = change({ index, provisional: '', final: null });
  const before = segments.filter((s) => s.index < index);
  const after = segments.filter((s) => s.index > index);
  return [...before, created, ...after];
}

/**
 * Applique un message de l'API : `delta` complète le provisoire de SON segment (ignoré si le
 * segment est déjà définitif), `segment` pose le texte définitif. Les autres messages ne
 * changent pas les segments.
 */
export function reduceSegments(segments: LiveSegments, msg: LiveServerMessage): LiveSegments {
  if (msg.type === 'delta') {
    if (!msg.text) return segments;
    return upsert(segments, msg.segment, (s) =>
      s.final !== null ? s : { ...s, provisional: s.provisional + msg.text },
    );
  }
  if (msg.type === 'segment') {
    return upsert(segments, msg.segment, (s) =>
      s.final === msg.text ? s : { ...s, final: msg.text },
    );
  }
  return segments;
}

/** Texte affiché d'un segment : le définitif s'il est arrivé, sinon le provisoire. */
export function segmentText(s: LiveSegment): string {
  return (s.final ?? s.provisional).trim().replace(/\s+/g, ' ');
}

/** Texte affiché de toute la dictée (segments vides ignorés, une espace entre deux). */
export function liveDisplayText(segments: LiveSegments): string {
  return segments
    .map(segmentText)
    .filter((t) => t.length > 0)
    .join(' ');
}

/** Un mot (ponctuation comprise) ou un retour à la ligne (`blank` : ligne vide). */
export type TextToken = { kind: 'word'; text: string } | { kind: 'break'; blank: boolean };

/**
 * Découpe un texte en mots pour l'affichage mot à mot (la ponctuation reste collée au mot),
 * en gardant les retours à la ligne. Le n-ième mot d'un texte qui s'allonge garde son rang :
 * il sert de clé stable, seuls les NOUVEAUX mots sont animés.
 */
export function tokenize(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) {
      const prev = tokens[tokens.length - 1];
      tokens.push({ kind: 'break', blank: tokens.length === 0 || prev?.kind === 'break' });
    }
    for (const word of line.split(/\s+/)) if (word) tokens.push({ kind: 'word', text: word });
  });
  return tokens;
}
