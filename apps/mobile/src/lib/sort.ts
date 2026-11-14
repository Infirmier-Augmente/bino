import { type PatientDigest, type PatientSummary, PRIORITY_NUMBER } from '@infirmier/domain';

/** Tri de l'onglet Patients. */
export type PatientSort = 'chambre' | 'nom';
/** Tri de Transmissions › Tous. */
export type SummarySort = 'prio' | 'chambre' | 'nom';

export const PATIENT_SORT_LABELS: Record<PatientSort, string> = { chambre: 'Chambre', nom: 'Nom' };
export const SUMMARY_SORT_LABELS: Record<SummarySort, string> = {
  prio: 'Priorité',
  chambre: 'Chambre',
  nom: 'Nom',
};

type Sortable = Pick<PatientSummary, 'room' | 'lastName' | 'firstName'>;

/** Ordre numérique des chambres : 3, 7, 9, 10, 12… */
export function compareRoom(a: string, b: string): number {
  return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' });
}

/** Ordre alphabétique du nom de famille (accents compris), puis prénom, puis chambre. */
export function compareName(a: Sortable, b: Sortable): number {
  return (
    a.lastName.localeCompare(b.lastName, 'fr', { sensitivity: 'base' }) ||
    a.firstName.localeCompare(b.firstName, 'fr', { sensitivity: 'base' }) ||
    compareRoom(a.room, b.room)
  );
}

export function sortPatients<T extends { patient: Sortable }>(
  rows: readonly T[],
  by: PatientSort,
): T[] {
  const cmp =
    by === 'nom'
      ? (a: T, b: T) => compareName(a.patient, b.patient)
      : (a: T, b: T) =>
          compareRoom(a.patient.room, b.patient.room) || compareName(a.patient, b.patient);
  return [...rows].sort(cmp);
}

/**
 * Ordre « Priorité » : niveau effectif (le choix manuel prime, déjà appliqué par le serveur),
 * puis score de la suggestion, puis NEWS2, puis chambre. L'étoile ★ (absente de Bino) n'intervient pas.
 */
export function comparePriority(a: PatientDigest, b: PatientDigest): number {
  return (
    PRIORITY_NUMBER[a.priority.level] - PRIORITY_NUMBER[b.priority.level] ||
    b.priority.suggestion.score - a.priority.suggestion.score ||
    (b.news2?.total ?? -1) - (a.news2?.total ?? -1) ||
    compareRoom(a.patient.room, b.patient.room)
  );
}

export function sortDigests(rows: readonly PatientDigest[], by: SummarySort): PatientDigest[] {
  if (by === 'prio') return [...rows].sort(comparePriority);
  return sortPatients(rows, by);
}
