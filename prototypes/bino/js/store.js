// Comptes rendus de la démo.
// Dans Claude (artifact) : base partagée en temps réel entre tous les soignants.
// Sur le site public : chaque navigateur a sa copie du scénario (/api/bino).
// Sans API (fichier local, port 8080) : ce navigateur seulement (localStorage).
import * as Bino from './bino-api.js';
import { SEED_CR } from './data.js';
import { settings } from './settings.js';
import { hhmm } from './util.js';

/** v4 ignore les essais déjà enregistrés dans ce navigateur. */
const LKEY = 'bino-local-v4';
export const SYNTH_VER = 2;
const cache = { cr: [], syn: {}, vit: {}, prio: { ai: null, manual: {} } };
const names = new Map();
const listeners = [];
let db = null;
let user = null;
let me = null;
let mode = 'local';
let loading = true;
let stale = false;
let rev = -1;
let pollTimer = null;

export const onChange = (fn) => listeners.push(fn);
const emit = () => {
  for (const fn of listeners) fn();
};

function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(LKEY) || 'null');
    if (s?.cr) Object.assign(cache, s);
    else cache.cr = SEED_CR.map((c) => ({ ...c }));
  } catch {
    cache.cr = SEED_CR.map((c) => ({ ...c }));
  }
}
function saveLocal() {
  if (mode !== 'local') return;
  try {
    localStorage.setItem(LKEY, JSON.stringify(cache));
  } catch {
    /* stockage plein ou indisponible */
  }
}

export async function init() {
  loadLocal();
  emit();
  if (!window.claude?.use) {
    await initRemote();
    return;
  }
  const [d, u] = await Promise.all([
    window.claude.use('db').catch(() => null),
    window.claude.use('user').catch(() => null),
  ]);
  if (!d) return;
  db = d;
  user = u;
  me = u ? await u.id().catch(() => null) : null;
  mode = 'shared';
  loading = true;
  cache.cr = [];
  cache.syn = {};
  cache.vit = {};
  cache.prio = { ai: null, manual: {} };
  emit();
  subscribe();
}

function subscribe() {
  const timer = setTimeout(() => {
    stale = true;
    emit();
  }, 10000);
  const done = () => {
    clearTimeout(timer);
    loading = false;
    stale = false;
  };
  db.collection('cr')
    .orderBy('at')
    .onSnapshot(
      (s) => {
        if (!s.metadata.fromCache) done();
        cache.cr = s.docs.map((x) => ({ id: x.id, ...x.data() }));
        resolveNames();
        emit();
      },
      () => {
        done();
        emit();
      },
    );
  db.collection('syntheses').onSnapshot(
    (s) => {
      cache.syn = Object.fromEntries(s.docs.map((x) => [x.id, x.data()]));
      emit();
    },
    () => {},
  );
  db.collection('prio').onSnapshot(
    (s) => {
      const docs = Object.fromEntries(s.docs.map((x) => [x.id, x.data()]));
      cache.prio = { ai: docs.ai || null, manual: docs.manual?.levels || {} };
      emit();
    },
    () => {},
  );
  db.collection('vitals').onSnapshot(
    (s) => {
      cache.vit = Object.fromEntries(s.docs.map((x) => [x.id, x.data()]));
      emit();
    },
    () => {},
  );
}

/* ---------- Cloudflare : stockage commun du Worker ---------- */
function applyRemote(st) {
  if (!st || typeof st.rev !== 'number') return;
  rev = st.rev;
  loading = false;
  cache.cr = st.cr || [];
  cache.syn = st.syn || {};
  cache.vit = st.vit || {};
  cache.prio = { ai: st.prio?.ai || null, manual: st.prio?.manual || {} };
  stale = false;
  emit();
}

async function api(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (r.status === 204) return null;
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

let apiPatients = null;
export const patientRows = () => apiPatients;

async function refreshBino() {
  const snap = await Bino.refresh(settings.matricule);
  cache.cr = snap.cr;
  cache.syn = snap.syn;
  cache.vit = {};
  cache.prio = snap.prio;
  apiPatients = Bino.patientRows();
  stale = false;
  loading = false;
  emit();
}

async function initRemote() {
  if (await Bino.reachable()) {
    mode = 'api';
    loading = true;
    emit();
    try {
      await refreshBino();
    } catch {
      stale = true;
      loading = false;
      emit();
    }
    clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (!document.hidden) refreshBino().catch(() => {});
    }, 15000);
    return;
  }
  let st = null;
  try {
    st = await api('/api/state');
  } catch {
    loading = false;
    emit();
    return; // pas de Worker (serveur statique, fichier local) : on reste sur ce navigateur
  }
  if (!st || typeof st.rev !== 'number') {
    loading = false;
    emit();
    return;
  }
  mode = 'remote';
  if (!st.seeded && !st.cr?.length) {
    try {
      st = await api('/api/op', { op: 'seed', cr: SEED_CR });
    } catch {
      /* un autre téléphone l'a peut-être déjà fait */
    }
  }
  applyRemote(st);
  startPolling();
}

async function poll() {
  if (document.hidden) return;
  try {
    const st = await api(`/api/state?since=${rev}`);
    if (st) applyRemote(st);
    else if (stale) {
      stale = false;
      emit();
    }
  } catch {
    if (!stale) {
      stale = true;
      emit();
    }
  }
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(poll, 5000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) poll();
  });
}

async function remoteOp(body) {
  applyRemote(await api('/api/op', body));
}

async function resolveNames() {
  if (!user) return;
  const ids = [
    ...new Set(
      [...cache.cr.map((c) => c.by), ...Object.values(cache.syn).map((s) => s.validatedBy)].filter(
        (id) => id && !names.has(id),
      ),
    ),
  ];
  if (!ids.length) return;
  try {
    const ps = await user.profiles(ids);
    for (const id of ids) names.set(id, ps?.[id]?.name || '');
    emit();
  } catch {
    /* noms indisponibles : on affiche « Un soignant » */
  }
}

/* ---------- lecture ---------- */
export const storeMode = () => mode;
export const isLoading = () => loading;
export const isStale = () => stale;
// Ordre chronologique, quel que soit le format d'heure enregistré.
const byTime = (a, b) => Date.parse(a.at) - Date.parse(b.at);
export const crFor = (pid) => cache.cr.filter((c) => c.pid === pid).sort(byTime);
export const allCr = () => cache.cr;
export const synthFor = (pid) => cache.syn[pid] || null;
export const vitalsFor = (pid) => cache.vit[pid] || null;
// Une synthèse est à refaire si un compte rendu a été ajouté ou supprimé depuis.
export function needsSynth(s, crs) {
  if (!s || s.ver !== SYNTH_VER) return true;
  const ids = s.crIds || [];
  return crs.some((c) => !ids.includes(c.id)) || ids.some((id) => !crs.some((c) => c.id === id));
}
// La soignante simulée (Martine par défaut) signe et retrouve « ses » comptes rendus par son nom.
export const isMine = (c) =>
  mode === 'api'
    ? !!c.nurseId && c.nurseId === Bino.currentNurseId()
    : !!c.byName && c.byName === myName();
export const myName = () => settings.name.trim();
// Nom affiché dans « Bonjour … » : la soignante simulée choisie (Martine par défaut).
export const displayName = () => myName();
export const canWrite = () => mode !== 'shared' || !!me;
export function authorOf(c) {
  if (c.byName) return c.byName;
  if (c.by && names.get(c.by)) return names.get(c.by);
  return 'Un soignant';
}
export const personLabel = (id) => (id && names.get(id)) || (id && id === me ? 'Vous' : '');

/* ---------- écriture ---------- */
export async function addCr(pid, text) {
  if (mode === 'api') {
    await Bino.addCr(pid, text, settings.matricule);
    await refreshBino();
    return;
  }
  const now = new Date();
  const doc = { pid, text, at: now.toISOString(), t: hhmm(now) };
  if (mode === 'shared') {
    await db.collection('cr').add({ ...doc, by: me, byName: myName() });
    return;
  }
  if (mode === 'remote') return remoteOp({ op: 'addCr', pid, text, t: doc.t, byName: myName() });
  cache.cr.push({ id: `l${now.getTime()}`, ...doc, byName: myName() });
  saveLocal();
  emit();
}

export async function deleteCr(id) {
  if (mode === 'shared') {
    await db.doc(`cr/${id}`).delete();
    return;
  }
  if (mode === 'remote') return remoteOp({ op: 'deleteCr', id });
  cache.cr = cache.cr.filter((c) => c.id !== id);
  saveLocal();
  emit();
}

export async function saveSynth(pid, syn) {
  if (mode === 'shared') {
    await db.doc(`syntheses/${pid}`).set(syn);
    return;
  }
  if (mode === 'remote') return remoteOp({ op: 'saveSynth', pid, syn });
  cache.syn[pid] = syn;
  saveLocal();
  emit();
}

export async function validateSynth(pid) {
  const s = synthFor(pid);
  if (!s) return;
  const patch = {
    validatedAt: new Date().toISOString(),
    validatedT: hhmm(),
    validatedName: myName(),
  };
  if (mode === 'shared') {
    await db.doc(`syntheses/${pid}`).update(patch);
    return;
  }
  if (mode === 'remote')
    return remoteOp({ op: 'validateSynth', pid, t: patch.validatedT, byName: myName() });
  cache.syn[pid] = { ...s, ...patch };
  saveLocal();
  emit();
}

export async function saveVitals(pid, v) {
  if (mode === 'shared') {
    await db.doc(`vitals/${pid}`).set(v);
    return;
  }
  if (mode === 'remote') return remoteOp({ op: 'saveVitals', pid, v });
  cache.vit[pid] = v;
  saveLocal();
  emit();
}

/* ---------- organisation par sévérité ---------- */
export const prioAI = () => cache.prio.ai;
export const manualLevels = () => cache.prio.manual || {};

export async function savePrioAI(obj) {
  if (mode === 'shared') {
    await db.doc('prio/ai').set(obj);
    return;
  }
  if (mode === 'remote') return remoteOp({ op: 'savePrioAI', ai: obj });
  cache.prio = { ...cache.prio, ai: obj };
  saveLocal();
  emit();
}

export async function reviewMine() {
  if (mode !== 'api') return;
  await Bino.reviewMine(cache.cr, settings.matricule);
  await refreshBino();
}

export async function setManualLevel(pid, level) {
  if (mode === 'api') {
    await Bino.setLevel(pid, level, settings.matricule);
    await refreshBino();
    return;
  }
  const levels = { ...manualLevels() };
  if (level) levels[pid] = level;
  else delete levels[pid];
  if (mode === 'shared') {
    await db.doc('prio/manual').set({ levels });
    return;
  }
  if (mode === 'remote') return remoteOp({ op: 'setManualLevel', pid, level });
  cache.prio = { ...cache.prio, manual: levels };
  saveLocal();
  emit();
}

export function resetLocal() {
  cache.cr = SEED_CR.map((c) => ({ ...c }));
  cache.syn = {};
  cache.vit = {};
  cache.prio = { ai: null, manual: {} };
  saveLocal();
  emit();
}
