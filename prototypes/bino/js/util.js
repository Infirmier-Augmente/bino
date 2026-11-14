export const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export const num = (x) => String(x).replace('.', ',');

export const hhmm = (d = new Date()) =>
  `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;

export const vitLine = (v) =>
  `FR ${v.fr} · SpO2 ${v.spo2} %${v.o2 ? ' sous O2' : ''} · TA ${v.pas}/${v.pad} · FC ${v.fc} · T ${num(v.temp)} °C`;

export const VITAL_KEYS = ['fr', 'spo2', 'o2', 'pas', 'pad', 'fc', 'temp', 'cons'];

export const VITAL_LABELS = {
  fr: 'Fréquence respiratoire',
  spo2: 'SpO2',
  o2: 'Oxygène',
  pas: 'TA systolique',
  pad: 'TA diastolique',
  fc: 'Fréquence cardiaque',
  temp: 'Température',
  cons: 'Conscience',
};

export function fmtVital(k, v) {
  if (v === undefined || v === null) return '—';
  if (k === 'o2') return v ? 'Sous O2' : 'Air ambiant';
  if (k === 'cons') return v === 'A' ? 'Alerte' : 'Altérée';
  if (k === 'temp') return `${num(v)} °C`;
  if (k === 'spo2') return `${v} %`;
  if (k === 'pas' || k === 'pad') return `${v} mmHg`;
  return `${v} /min`;
}
