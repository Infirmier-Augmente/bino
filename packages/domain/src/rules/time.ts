import type { CareUnit } from '../schemas/hospital';
import type { ShiftWindow } from '../schemas/views';

/**
 * Gestion du temps en heure LOCALE du service (Europe/Paris par défaut),
 * sans dépendance : Intl suffit, y compris sous Hermes (React Native).
 */

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** Décalage (ms) entre l'heure locale du fuseau et UTC à un instant donné. */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

/** Construit l'instant correspondant à une date/heure locale dans un fuseau. */
export function fromLocal(
  local: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  const guess = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const offset = timeZoneOffsetMs(new Date(guess), timeZone);
  const candidate = new Date(guess - offset);
  // Correction en cas de changement d'heure entre guess et candidate.
  const offset2 = timeZoneOffsetMs(candidate, timeZone);
  return offset2 === offset ? candidate : new Date(guess - offset2);
}

/** ISO 8601 avec le décalage local du fuseau, ex. "2026-11-14T19:45:00+01:00". */
export function toLocalIso(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  const offsetMin = Math.round(timeZoneOffsetMs(date, timeZone) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${sign}${pad(
    Math.floor(abs / 60),
  )}:${pad(abs % 60)}`;
}

function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':');
  return { hour: Number(h), minute: Number(m) };
}

function addDays(
  p: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Poste en cours à l'instant `now` : postes de 12 h, relève à 7h45 et 19h45 (kit Foch).
 */
export function currentShift(now: Date, unit: Pick<CareUnit, 'shifts' | 'timeZone'>): ShiftWindow {
  const tz = unit.timeZone;
  const day = parseHHMM(unit.shifts.dayStart);
  const night = parseHHMM(unit.shifts.nightStart);
  const p = localParts(now, tz);
  const minutes = p.hour * 60 + p.minute;
  const dayMin = day.hour * 60 + day.minute;
  const nightMin = night.hour * 60 + night.minute;

  let kind: 'jour' | 'nuit';
  let startDate: { year: number; month: number; day: number };
  if (minutes >= dayMin && minutes < nightMin) {
    kind = 'jour';
    startDate = p;
  } else {
    kind = 'nuit';
    startDate = minutes >= nightMin ? p : addDays(p, -1);
  }
  const startHM = kind === 'jour' ? day : night;
  const endHM = kind === 'jour' ? night : day;
  const start = fromLocal({ ...startDate, ...startHM }, tz);
  const endDate = kind === 'jour' ? startDate : addDays(startDate, 1);
  const end = fromLocal({ ...endDate, ...endHM }, tz);
  const hm = (t: string) => t.replace(/^0/, '').replace(':', 'h');
  const label =
    kind === 'jour'
      ? `Poste de jour · ${hm(unit.shifts.dayStart)} → ${hm(unit.shifts.nightStart)}`
      : `Poste de nuit · ${hm(unit.shifts.nightStart)} → ${hm(unit.shifts.dayStart)}`;
  return { kind, start: toLocalIso(start, tz), end: toLocalIso(end, tz), label };
}

/** Durée pendant laquelle, après 7h45 / 19h45, on montre encore le poste qui vient de finir. */
export const HANDOVER_OVERLAP_MS = 2 * 3_600_000;

/**
 * Fenêtre de la RELÈVE : le poste en cours… sauf pendant les 2 h qui suivent
 * le changement d'équipe, où l'on montre le poste qui vient de se terminer
 * (c'est lui que l'équipe sortante transmet).
 */
export function handoverWindow(
  now: Date,
  unit: Pick<CareUnit, 'shifts' | 'timeZone'>,
): ShiftWindow {
  const cur = currentShift(now, unit);
  const sinceStart = now.getTime() - Date.parse(cur.start);
  if (sinceStart >= HANDOVER_OVERLAP_MS) return cur;
  const prev = currentShift(new Date(Date.parse(cur.start) - 60_000), unit);
  return {
    kind: prev.kind,
    start: prev.start,
    end: toLocalIso(now, unit.timeZone),
    label: `${prev.label} · relève en cours`,
  };
}

/** "16h05" en heure locale. */
export function formatClock(iso: string, timeZone: string): string {
  const p = localParts(new Date(iso), timeZone);
  return `${p.hour}h${String(p.minute).padStart(2, '0')}`;
}

export function isWithin(iso: string, startIso: string, endIso: string): boolean {
  const t = Date.parse(iso);
  return t >= Date.parse(startIso) && t <= Date.parse(endIso);
}

export function ageAt(birthDate: string, now: Date): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) return 0;
  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (beforeBirthday) age--;
  return Math.max(0, age);
}

/** Jour d'hospitalisation "J0", "J5"… (J0 = jour d'entrée, heure locale). */
export function dayOfStay(admittedAt: string, now: Date, timeZone: string): string {
  const a = localParts(new Date(admittedAt), timeZone);
  const n = localParts(now, timeZone);
  const days = Math.round(
    (Date.UTC(n.year, n.month - 1, n.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86400000,
  );
  return `J${Math.max(0, days)}`;
}
