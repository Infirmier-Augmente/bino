import { formatClock } from '@infirmier/domain';

const TZ = 'Europe/Paris';

/** "16h05" */
export function clock(iso: string): string {
  return formatClock(iso, TZ);
}

/** "il y a 5 min", "il y a 2 h", ou l'heure si plus ancien. */
export function relative(iso: string, now: Date): string {
  const minutes = Math.round((now.getTime() - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  if (minutes < 6 * 60) return `il y a ${Math.floor(minutes / 60)} h`;
  return clock(iso);
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** "0:42" */
export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
