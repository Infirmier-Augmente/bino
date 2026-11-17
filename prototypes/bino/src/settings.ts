// Réglages de ce navigateur : qui est connecté, et le tri des listes.
import type { Settings } from './model.js';

const KEY = 'bino-settings';

export const settings: Settings = {
  name: '',
  matricule: '',
  sortBy: 'chambre',
  trSort: 'prio',
};

function applySaved(parsed: unknown): void {
  if (!parsed || typeof parsed !== 'object') return;
  const saved = parsed as Record<string, unknown>;
  if (typeof saved.name === 'string') settings.name = saved.name;
  if (typeof saved.matricule === 'string') settings.matricule = saved.matricule;
  if (typeof saved.sortBy === 'string') settings.sortBy = saved.sortBy;
  if (typeof saved.trSort === 'string') settings.trSort = saved.trSort;
}

try {
  applySaved(JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch {
  /* stockage indisponible : valeurs par défaut */
}

export function saveSettings(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
