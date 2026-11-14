import type { Patient, PriorityLevel, VitalSigns } from '../schemas/hospital';
import type { News2Points, News2Result } from '../schemas/views';

/**
 * Score NEWS2 (Royal College of Physicians, 2017), échelle SpO2 n° 1.
 *
 * AIDE AU CALCUL, pas un verdict : les entrées et les points de chaque paramètre sont toujours
 * affichés, et l'IDE garde le dernier mot (le choix manuel de priorité prime). Seuils repris du
 * prototype Bino (`prototypes/bino/js/news2.js`, branche demo).
 */
export function news2Points(v: VitalSigns): News2Points {
  const fr = v.respiratoryRate;
  const spo2 = v.spo2;
  const pas = v.systolic;
  const fc = v.heartRate;
  const t = v.temperature;
  return {
    respiratoryRate: fr <= 8 ? 3 : fr <= 11 ? 1 : fr <= 20 ? 0 : fr <= 24 ? 2 : 3,
    spo2: spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0,
    oxygen: v.onOxygen ? 2 : 0,
    systolic: pas <= 90 ? 3 : pas <= 100 ? 2 : pas <= 110 ? 1 : pas <= 219 ? 0 : 3,
    heartRate: fc <= 40 ? 3 : fc <= 50 ? 1 : fc <= 90 ? 0 : fc <= 110 ? 1 : fc <= 130 ? 2 : 3,
    temperature: t <= 35 ? 3 : t <= 36 ? 1 : t <= 38 ? 0 : t <= 39 ? 1 : 2,
    consciousness: v.consciousness === 'A' ? 0 : 3,
  };
}

/** Convention de la démo : ≥ 7 rouge, 5-6 orange, 3-4 ou un paramètre à 3 jaune, sinon vert. */
export function news2Level(points: News2Points): PriorityLevel {
  const values = Object.values(points);
  const total = values.reduce((a, b) => a + b, 0);
  if (total >= 7) return 'rouge';
  if (total >= 5) return 'orange';
  if (total >= 3 || values.some((p) => p === 3)) return 'jaune';
  return 'vert';
}

const decimal = (n: number) => String(n).replace('.', ',');

/** Libellé court d'un paramètre qui pèse (≥ 2 points), dans l'ordre du prototype. */
function paramLabel(key: keyof News2Points, v: VitalSigns): string {
  switch (key) {
    case 'respiratoryRate':
      return `FR ${decimal(v.respiratoryRate)}`;
    case 'spo2':
      return `SpO2 ${decimal(v.spo2)} %`;
    case 'oxygen':
      return 'sous O2';
    case 'systolic':
      return `TA ${decimal(v.systolic)}/${decimal(v.diastolic)}`;
    case 'heartRate':
      return `FC ${decimal(v.heartRate)}`;
    case 'temperature':
      return `T ${decimal(v.temperature)} °C`;
    case 'consciousness':
      return 'conscience altérée';
  }
}

const PARAM_ORDER: (keyof News2Points)[] = [
  'respiratoryRate',
  'spo2',
  'oxygen',
  'systolic',
  'heartRate',
  'temperature',
  'consciousness',
];

/** « NEWS2 7 · FR 24, TA 98/62 » : jusqu'à 3 paramètres à ≥ 2 points, du plus lourd au plus léger. */
export function news2Reason(v: VitalSigns, points: News2Points, total: number): string {
  const heavy = PARAM_ORDER.filter((k) => points[k] >= 2)
    .map((k, i) => ({ k, i, p: points[k] }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, 3)
    .map(({ k }) => paramLabel(k, v));
  return heavy.length > 0 ? `NEWS2 ${total} · ${heavy.join(', ')}` : `NEWS2 ${total}`;
}

export function news2(v: VitalSigns): News2Result {
  const points = news2Points(v);
  const total = Object.values(points).reduce((a, b) => a + b, 0);
  return { points, total, level: news2Level(points), reason: news2Reason(v, points, total) };
}

/** NEWS2 des dernières constantes du dossier, ou null sans relevé. */
export function patientNews2(patient: Pick<Patient, 'vitals'>): News2Result | null {
  return patient.vitals ? news2(patient.vitals) : null;
}
