// Le navigateur ne parle qu'au Worker (/api/bino). Le Worker relaie vers l'API du mini.
import { STAFF } from './auth.js';

const ROOT = '/api/bino';
const LEVEL = { rouge: 'critique', orange: 'eleve', jaune: 'moyen', vert: 'moyen' };
const API_LEVEL = { critique: 'rouge', eleve: 'orange', moyen: 'jaune' };

const blankVitals = {
  fr: 16,
  spo2: 98,
  o2: false,
  pas: 120,
  pad: 70,
  fc: 75,
  temp: 37,
  cons: 'A',
  at: '',
  src: 'absent',
};

let session = null;
let nurseId = null;
let patients = [];

export const currentNurseId = () => nurseId;
export const patientRows = () => patients;

async function call(path, { method = 'GET', body, timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`${ROOT}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const err = new Error(j?.error?.message || j?.error || `HTTP ${r.status}`);
      err.code = j?.error?.code || 'api_error';
      throw err;
    }
    return j;
  } finally {
    clearTimeout(timer);
  }
}

export async function reachable() {
  try {
    const j = await call('/health');
    return j?.ok === true;
  } catch {
    return false;
  }
}

function texts(items) {
  return (items || [])
    .map((i) => i?.text)
    .filter(Boolean)
    .join(', ');
}

function hhmm(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function nurseName(id) {
  const n = session?.nurses?.find((x) => x.id === id);
  return n ? `${n.firstName} ${n.lastName}` : 'Un soignant';
}

export function nurseForMatricule(matricule) {
  const staff = STAFF.find((s) => s.matricule === String(matricule || '').replace(/\s/g, ''));
  const first = staff?.name?.split(' ')[0]?.toLowerCase();
  if (!first || !session) return null;
  return session.nurses.find((n) => n.firstName.toLowerCase() === first) || null;
}

function pointsFrom(sheet, crs) {
  if (!sheet) {
    return crs.map((c) => ({ t: c.text, src: [{ cr: c.id, q: c.text }] }));
  }
  const fromItem = (item) => ({
    t: item.text,
    src: (item.sources || [])
      .filter((s) => s.kind === 'dictation')
      .map((s) => ({ cr: s.transmissionId, q: s.quote })),
  });
  const points = (sheet.headline || []).map(fromItem);
  for (const target of sheet.targets || []) {
    const bits = [...(target.data || []), ...(target.actions || []), ...(target.results || [])];
    if (!bits.length) continue;
    points.push({
      t: `${target.label} : ${bits.map((b) => b.text).join(' ')}`,
      src: bits.flatMap((b) => fromItem(b).src),
    });
  }
  for (const todo of sheet.todos || []) points.push(fromItem(todo));
  for (const section of sheet.sections || []) {
    for (const item of section.items || []) points.push(fromItem(item));
  }
  const seen = new Set();
  const unique = points.filter((p) => {
    const key = p.t.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length ? unique : crs.map((c) => ({ t: c.text, src: [{ cr: c.id, q: c.text }] }));
}

function toPatient(detail, row) {
  const p = detail?.patient || {};
  const summary = row.patient;
  const tr = p.transverse || {};
  const allergies =
    tr.allergies?.status === 'aucune'
      ? 'Aucune connue'
      : texts(tr.allergies?.items) || 'Non renseigné';
  const rx = tr.prescriptions?.[0];
  return {
    id: summary.id,
    ch: summary.room,
    nom: summary.displayName,
    age: summary.age,
    motif: summary.admissionReason,
    atcd: p.history || 'Aucun',
    allergies,
    precautions: texts(tr.precautions?.items),
    famille: texts(tr.famille),
    taches: [],
    disp: [],
    rx: rx ? { t: rx.text, at: '' } : null,
    v: blankVitals,
  };
}

function toCr(t) {
  return {
    id: t.id,
    pid: t.patientId,
    text: t.dictation?.transcript || '',
    at: t.createdAt,
    t: hhmm(t.createdAt),
    byName: nurseName(t.nurseId),
    nurseId: t.nurseId,
    review: t.review?.status || 'draft',
  };
}

export async function refresh(matricule) {
  session = await call('/session');
  const nurse = nurseForMatricule(matricule);
  nurseId = nurse?.id || null;
  const unitId = nurse?.unitId || session.units?.[0]?.id;
  if (!unitId) throw new Error('Aucun service');
  const rows = await call(`/units/${unitId}/patients`);
  const details = await Promise.all(
    rows.map((row) => call(`/patients/${row.patient.id}`).catch(() => null)),
  );
  const sheets = await Promise.all(
    rows.map((row) => call(`/patients/${row.patient.id}/handover`).catch(() => null)),
  );
  const cr = [];
  const syn = {};
  const manual = {};
  const order = [];
  patients = rows.map((row, i) => {
    const detail = details[i];
    for (const t of detail?.transmissions || []) {
      if (t.patientId) cr.push(toCr(t));
    }
    const mine = cr.filter((c) => c.pid === row.patient.id);
    const level = LEVEL[row.priority?.level] || 'moyen';
    if (row.priority?.origin === 'manuelle') manual[row.patient.id] = level;
    const reason = row.priority?.suggestion?.reasons?.[0]?.label || '';
    order.push({ id: row.patient.id, level, raison: reason });
    syn[row.patient.id] = {
      points: pointsFrom(sheets[i], mine),
      resume: null,
      cibles: [],
      todo: [],
      soins: [],
      engine: 'ai',
      ver: 2,
      crIds: mine.map((c) => c.id),
      at: new Date().toISOString(),
      t: hhmm(new Date().toISOString()),
    };
    return toPatient(detail, row);
  });
  return {
    cr,
    syn,
    prio: { ai: { order, engine: 'ai', sig: 'api' }, manual },
  };
}

export async function addCr(patientId, text, matricule) {
  const nurse = nurseForMatricule(matricule);
  if (!nurse) throw new Error('Soignant inconnu de l’API');
  await call('/transmissions', {
    method: 'POST',
    timeout: 60000,
    body: {
      unitId: nurse.unitId,
      nurseId: nurse.id,
      patientId,
      transcript: text,
      mode: 'transmission',
      inputMethod: 'keyboard',
    },
  });
}

export async function setLevel(patientId, level, matricule) {
  const nurse = nurseForMatricule(matricule);
  if (!nurse) throw new Error('Soignant inconnu de l’API');
  await call(`/patients/${patientId}/priority`, {
    method: 'PATCH',
    body: {
      nurseId: nurse.id,
      manualLevel: level ? API_LEVEL[level] || null : null,
    },
  });
}

export async function reviewMine(crs, matricule) {
  const nurse = nurseForMatricule(matricule);
  if (!nurse) return;
  const mine = crs.filter((c) => c.nurseId === nurse.id && c.review === 'draft');
  for (const c of mine) {
    await call(`/transmissions/${c.id}/review`, {
      method: 'POST',
      body: { nurseId: nurse.id, decision: 'validate' },
    });
  }
}
