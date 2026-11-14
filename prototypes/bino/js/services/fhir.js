// Récupération des constantes depuis le DPI via FHIR R4 (ressources Observation, catégorie vital-signs).
// Par défaut : un DPI simulé (fichiers JSON dans /mock-fhir). Pour un vrai serveur FHIR,
// renseigner son URL de base dans Réglages : l'app interroge alors
//   GET {base}/Observation?patient={id}&category=vital-signs&_sort=-date&_count=50

export const LOINC = {
  '9279-1': 'fr', // Respiratory rate
  '59408-5': 'spo2', // Oxygen saturation by pulse oximetry
  '2708-6': 'spo2', // Oxygen saturation in arterial blood
  '8480-6': 'pas', // Systolic blood pressure
  '8462-4': 'pad', // Diastolic blood pressure
  '8867-4': 'fc', // Heart rate
  '8310-5': 'temp', // Body temperature
  '3151-8': 'o2', // Inhaled oxygen flow rate
  '67775-7': 'cons', // Level of responsiveness (ACVPU)
};
const BP_PANEL = '85354-9';

export const isMock = (base) => !/^https?:\/\//i.test(base || '');

export function vitalsUrl(base, fhirId) {
  const b = (base || './mock-fhir').replace(/\/+$/, '');
  return isMock(b)
    ? `${b}/Observation/vitals-${encodeURIComponent(fhirId)}.json`
    : `${b}/Observation?patient=${encodeURIComponent(fhirId)}&category=vital-signs&_sort=-date&_count=50`;
}

export async function fetchVitals(patient, base, fetchImpl = fetch) {
  const url = vitalsUrl(base, patient.fhirId);
  const r = await fetchImpl(url, { headers: { Accept: 'application/fhir+json' } });
  if (!r.ok) throw Object.assign(new Error(`DPI injoignable (HTTP ${r.status})`), { url });
  const bundle = await r.json();
  const out = bundleToVitals(bundle);
  if (!Object.keys(out.v).length)
    throw Object.assign(new Error('Aucune constante trouvée dans le DPI pour ce patient'), { url });
  return { ...out, url };
}

const codesOf = (cc) => (cc?.coding || []).map((c) => c.code);

function consFrom(obs) {
  const cc = obs.valueCodeableConcept;
  const txt = (
    (cc && (cc.text || (cc.coding?.[0] && (cc.coding[0].code || cc.coding[0].display)))) ||
    obs.valueString ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase();
  if (!txt) return undefined;
  return txt === 'a' || txt.startsWith('alert') || txt.startsWith('alerte') ? 'A' : 'C';
}

// Garde la valeur la plus récente de chaque paramètre.
export function bundleToVitals(bundle) {
  const entries = (bundle?.entry || [])
    .map((e) => e.resource)
    .filter((r) => r && r.resourceType === 'Observation');
  entries.sort((a, b) => new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0));
  const v = {},
    sources = {};
  let latest = null;
  const take = (key, val, obs) => {
    if (val === undefined || val === null || key in v) return;
    v[key] = val;
    sources[key] = { id: obs.id, at: obs.effectiveDateTime };
    if (!latest || new Date(obs.effectiveDateTime) > new Date(latest))
      latest = obs.effectiveDateTime;
  };
  for (const obs of entries) {
    if (obs.status && !['final', 'amended', 'corrected', 'preliminary'].includes(obs.status))
      continue;
    const codes = codesOf(obs.code);
    if (codes.includes(BP_PANEL)) {
      for (const c of obs.component || []) {
        const k = codesOf(c.code)
          .map((x) => LOINC[x])
          .find(Boolean);
        if (k && c.valueQuantity) take(k, Math.round(c.valueQuantity.value), obs);
      }
      continue;
    }
    const key = codes.map((x) => LOINC[x]).find(Boolean);
    if (!key) continue;
    if (key === 'cons') take('cons', consFrom(obs), obs);
    else if (key === 'o2') take('o2', !!(obs.valueQuantity && obs.valueQuantity.value > 0), obs);
    else if (obs.valueQuantity)
      take(
        key,
        key === 'temp'
          ? Math.round(obs.valueQuantity.value * 10) / 10
          : Math.round(obs.valueQuantity.value),
        obs,
      );
  }
  return { v, sources, at: latest ? fmtTime(latest) : null, atIso: latest };
}

export function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d)) return null;
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
}
