import { formatClock, localParts, type Nurse, type PatientSummary } from '@infirmier/domain';

/** « 16h05 » en heure locale du service. */
export function clock(iso: string, timeZone: string): string {
  return formatClock(iso, timeZone);
}

/** « 14/11/2026 » : date du serveur dans le fuseau du service (jamais l'horloge de l'appareil). */
export function dateFr(iso: string, timeZone: string): string {
  const p = localParts(new Date(iso), timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(p.day)}/${pad(p.month)}/${p.year}`;
}

/** « M. Jean Dupond », « Mme Claire Laurent ». */
export function patientFullName(p: Pick<PatientSummary, 'sex' | 'firstName' | 'lastName'>): string {
  return `${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName}`;
}

/** « 68 ans · Colectomie, J2 ». */
export function patientSubline(
  p: Pick<PatientSummary, 'age' | 'admissionReason' | 'dayOfStay'>,
): string {
  const reason = p.admissionReason.trim();
  return reason ? `${p.age} ans · ${reason}, ${p.dayOfStay}` : `${p.age} ans · ${p.dayOfStay}`;
}

/** Pastille chambre : « CHAMB 12 ». */
export function roomChipLabel(room: string): string {
  return `CHAMB ${room}`;
}

/** « Martine Dubois · IDE » (écran « Connexion réussie »). */
export function nurseFullName(n: Pick<Nurse, 'firstName' | 'lastName' | 'role'>): string {
  return `${n.firstName} ${n.lastName} · ${n.role}`;
}
