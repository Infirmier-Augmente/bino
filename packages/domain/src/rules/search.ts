import type { Transmission } from '../schemas/transmission';
import type { SearchHit } from '../schemas/views';
import { normalize, normalizeWithMap } from './text';

/**
 * RECHERCHE SOURCÉE ("cerveau digital", version honnête) :
 * on renvoie des EXTRAITS de dictées, façon Ctrl+F, jamais un chiffre affirmé.
 * C'est l'infirmière qui conclut.
 */
export function searchTransmissions(
  transmissions: readonly Transmission[],
  query: string,
  patientLabel: (patientId: string | null) => string,
  limit = 50,
): SearchHit[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const terms = q.split(' ').filter((t) => t.length > 0);
  const hits: SearchHit[] = [];

  const sorted = [...transmissions].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  for (const t of sorted) {
    const transcript = t.dictation.transcript;
    const { value, map } = normalizeWithMap(transcript);
    // Correspondance de la phrase entière d'abord, sinon du premier terme présent
    // quand tous les termes sont présents.
    let idx = value.indexOf(q);
    let len = q.length;
    if (idx < 0) {
      if (!terms.every((term) => value.includes(term))) continue;
      const first = terms[0] ?? q;
      idx = value.indexOf(first);
      len = first.length;
    }
    const sourceStart = map[idx] ?? 0;
    const sourceEnd = (map[idx + len - 1] ?? sourceStart) + 1;
    const from = Math.max(0, sourceStart - 60);
    const to = Math.min(transcript.length, sourceEnd + 80);
    const prefix = from > 0 ? '…' : '';
    const suffix = to < transcript.length ? '…' : '';
    const snippet = `${prefix}${transcript.slice(from, to)}${suffix}`;
    hits.push({
      transmissionId: t.id,
      patientId: t.patientId,
      patientLabel: patientLabel(t.patientId),
      createdAt: t.createdAt,
      nurseId: t.nurseId,
      snippet,
      matchStart: prefix.length + (sourceStart - from),
      matchEnd: prefix.length + (sourceEnd - from),
      sourceStart,
      sourceEnd,
    });
    if (hits.length >= limit) break;
  }
  return hits;
}
