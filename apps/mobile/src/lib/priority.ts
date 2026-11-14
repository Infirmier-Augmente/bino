import {
  type EffectivePriority,
  type News2Result,
  PRIORITY_BY_NUMBER,
  PRIORITY_NUMBER,
  type PriorityLevel,
} from '@infirmier/domain';

export type PriorityNumber = 1 | 2 | 3 | 4;
export const PRIORITY_NUMBERS: readonly PriorityNumber[] = [1, 2, 3, 4];

export function priorityNumber(level: PriorityLevel): PriorityNumber {
  return PRIORITY_NUMBER[level];
}

export function levelOfNumber(n: PriorityNumber): PriorityLevel {
  return PRIORITY_BY_NUMBER[n];
}

/**
 * Raison de la priorité (lue par le lecteur d'écran) : « choisie par un soignant » si choix
 * manuel, sinon la première raison de la suggestion, sinon celle du NEWS2.
 */
export function priorityReason(priority: EffectivePriority, news2: News2Result | null): string {
  if (priority.origin === 'manuelle') return 'choisie par un soignant';
  return priority.suggestion.reasons[0]?.label ?? news2?.reason ?? 'proposée';
}

/** « M. Jean Dupond : Priorité 1 (NEWS2 7 · FR 24, TA 98/62). Changer la priorité » */
export function priorityButtonLabel(name: string, n: PriorityNumber, reason: string): string {
  return `${name} : Priorité ${n} (${reason}). Changer la priorité`;
}
