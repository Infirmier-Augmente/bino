// Réglages de ce navigateur : qui est connecté, et le tri des listes.
const KEY = 'bino-settings';

export const settings = {
  name: '',
  matricule: '',
  sortBy: 'chambre',
  trSort: 'prio',
};

try {
  Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}'));
} catch (_e) {
  /* stockage indisponible : valeurs par défaut */
}

export function saveSettings(patch) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (_e) {
    /* ignore */
  }
}
