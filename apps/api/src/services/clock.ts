import type { ClockState } from '@infirmier/domain';

/**
 * Heure courante : réelle, ou simulée (scénario). En mode simulé, l'horloge
 * avance en temps réel à partir du point d'ancrage.
 */
export function clockNow(clock: ClockState, realNow: Date = new Date()): Date {
  if (clock.mode === 'real' || !clock.now) return realNow;
  const base = Date.parse(clock.now);
  const anchored = clock.anchoredAt ? Date.parse(clock.anchoredAt) : realNow.getTime();
  return new Date(base + Math.max(0, realNow.getTime() - anchored));
}

/** Ré-ancre l'horloge simulée sur une heure donnée, à partir de maintenant. */
export function anchorClock(now: string, realNow: Date = new Date()): ClockState {
  return { mode: 'simulated', now, anchoredAt: realNow.toISOString() };
}
