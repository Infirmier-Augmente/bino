import type { Consciousness, News2Points, VitalSigns } from '@infirmier/domain';

/** Ton d'affichage d'un nombre de points NEWS2 (la couleur est dans le thème). */
export type News2Tone = 'none' | 'low' | 'mid' | 'high';

/** Points d'un paramètre : 0 gris, 1 jaune, 2 orange, 3 rouge. */
export function pointsTone(points: number): News2Tone {
  if (points >= 3) return 'high';
  if (points === 2) return 'mid';
  if (points === 1) return 'low';
  return 'none';
}

/** Total : ≥ 7 rouge, ≥ 5 orange, ≥ 1 jaune, 0 gris. */
export function totalTone(total: number): News2Tone {
  if (total >= 7) return 'high';
  if (total >= 5) return 'mid';
  if (total >= 1) return 'low';
  return 'none';
}

/** « +2 » ou « 0 ». */
export function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : '0';
}

/** Virgule décimale : 38.2 → « 38,2 ». */
export function decimalFr(n: number): string {
  return String(n).replace('.', ',');
}

export interface VitalsRow {
  key: keyof News2Points;
  label: string;
  value: string;
  points: number;
}

/** Lignes du tableau des constantes, dans l'ordre du prototype (la diastolique ne compte pas). */
export function vitalsRows(v: VitalSigns, points: News2Points): VitalsRow[] {
  return [
    {
      key: 'respiratoryRate',
      label: 'Fréquence respiratoire',
      value: `${decimalFr(v.respiratoryRate)} /min`,
      points: points.respiratoryRate,
    },
    { key: 'spo2', label: 'SpO2', value: `${decimalFr(v.spo2)} %`, points: points.spo2 },
    {
      key: 'oxygen',
      label: 'Oxygène',
      value: v.onOxygen ? 'Oui' : 'Air ambiant',
      points: points.oxygen,
    },
    {
      key: 'systolic',
      label: 'Tension artérielle',
      value: `${decimalFr(v.systolic)}/${decimalFr(v.diastolic)} mmHg`,
      points: points.systolic,
    },
    {
      key: 'heartRate',
      label: 'Fréquence cardiaque',
      value: `${decimalFr(v.heartRate)} /min`,
      points: points.heartRate,
    },
    {
      key: 'temperature',
      label: 'Température',
      value: `${decimalFr(v.temperature)} °C`,
      points: points.temperature,
    },
    {
      key: 'consciousness',
      label: 'Conscience',
      value: v.consciousness === 'A' ? 'Alerte' : 'Altérée',
      points: points.consciousness,
    },
  ];
}

// ─── Formulaire « Constantes » ───────────────────────────────────────────────

export const NUMERIC_VITALS = [
  'respiratoryRate',
  'spo2',
  'systolic',
  'diastolic',
  'heartRate',
  'temperature',
] as const;
export type NumericVital = (typeof NUMERIC_VITALS)[number];

export type VitalsForm = Record<NumericVital, string> & {
  onOxygen: boolean;
  consciousness: Consciousness;
};

/** Pré-remplissage avec les constantes courantes (vide s'il n'y en a pas). */
export function vitalsToForm(v: VitalSigns | null): VitalsForm {
  const s = (n: number | undefined) => (n === undefined ? '' : String(n));
  return {
    respiratoryRate: s(v?.respiratoryRate),
    spo2: s(v?.spo2),
    systolic: s(v?.systolic),
    diastolic: s(v?.diastolic),
    heartRate: s(v?.heartRate),
    temperature: s(v?.temperature),
    onOxygen: v?.onOxygen ?? false,
    consciousness: v?.consciousness ?? 'A',
  };
}

/** Nombre fini et > 0, virgule acceptée ; sinon null. */
export function parsePositive(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
}

/** Valeurs saisies → constantes, ou null si une valeur n'est pas un nombre > 0 (pas de borne physiologique). */
export function parseVitalsForm(f: VitalsForm): VitalSigns | null {
  const values: Partial<Record<NumericVital, number>> = {};
  for (const key of NUMERIC_VITALS) {
    const n = parsePositive(f[key]);
    if (n === null) return null;
    values[key] = n;
  }
  const { respiratoryRate, spo2, systolic, diastolic, heartRate, temperature } = values;
  if (
    respiratoryRate === undefined ||
    spo2 === undefined ||
    systolic === undefined ||
    diastolic === undefined ||
    heartRate === undefined ||
    temperature === undefined
  ) {
    return null;
  }
  return {
    respiratoryRate,
    spo2,
    systolic,
    diastolic,
    heartRate,
    temperature,
    onOxygen: f.onOxygen,
    consciousness: f.consciousness,
  };
}
