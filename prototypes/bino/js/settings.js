// Réglages propres à chaque testeur, gardés dans son navigateur uniquement.
const KEY = 'bino-settings';
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_FHIR = './mock-fhir';

export const settings = { apiKey: '', model: DEFAULT_MODEL, fhirBase: DEFAULT_FHIR, name: '' };

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
