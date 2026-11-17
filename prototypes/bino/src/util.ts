import type { Vitals } from './model.js';

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c] ?? '');

export const num = (x: number | string): string => String(x).replace('.', ',');

export const hhmm = (d = new Date()): string =>
  `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;

export const vitLine = (v: Vitals): string =>
  `FR ${v.fr} · SpO2 ${v.spo2} %${v.o2 ? ' sous O2' : ''} · TA ${v.pas}/${v.pad} · FC ${v.fc} · T ${num(v.temp)} °C`;

export const VITAL_KEYS = ['fr', 'spo2', 'o2', 'pas', 'pad', 'fc', 'temp', 'cons'] as const;

export const VITAL_LABELS: Record<(typeof VITAL_KEYS)[number], string> = {
  fr: 'Fréquence respiratoire',
  spo2: 'SpO2',
  o2: 'Oxygène',
  pas: 'TA systolique',
  pad: 'TA diastolique',
  fc: 'Fréquence cardiaque',
  temp: 'Température',
  cons: 'Conscience',
};

export function fmtVital(k: string, v: unknown): string {
  if (v === undefined || v === null) return '—';
  if (k === 'o2') return v ? 'Sous O2' : 'Air ambiant';
  if (k === 'cons') return v === 'A' ? 'Alerte' : 'Altérée';
  if (k === 'temp') return `${num(typeof v === 'number' || typeof v === 'string' ? v : '')} °C`;
  if (k === 'spo2') return `${String(v)} %`;
  if (k === 'pas' || k === 'pad') return `${String(v)} mmHg`;
  return `${String(v)} /min`;
}
