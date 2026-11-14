// Données partagées par l'équipe : comptes rendus, synthèses finales, constantes.
// Dans Claude (artifact) : base partagée en temps réel entre tous les soignants.
// Ailleurs (Cloudflare, local) : ce navigateur seulement (localStorage), avec des exemples de départ.
import { SEED_CR } from './data.js';
import { settings } from './settings.js';
import { hhmm } from './util.js';

const LKEY = 'bino-shared-v1';
const cache = { cr: [], syn: {}, vit: {} };
const names = new Map();
const listeners = [];
let db = null;
let user = null;
let me = null;
let meName = '';
let mode = 'local';
let loading = false;
let stale = false;

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
  if (!window.claude?.use) return;
  const [d, u] = await Promise.all([
    window.claude.use('db').catch(() => null),
    window.claude.use('user').catch(() => null),
  ]);
  if (!d) return;
  db = d;
  user = u;
  me = u ? await u.id().catch(() => null) : null;
  if (u) {
    try {
      const prof = await u.me();
      meName = prof?.name || '';
    } catch {
      meName = '';
    }
  }
  mode = 'shared';
  loading = true;
  cache.cr = [];
  cache.syn = {};
  cache.vit = {};
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
  db.collection('vitals').onSnapshot(
    (s) => {
      cache.vit = Object.fromEntries(s.docs.map((x) => [x.id, x.data()]));
      emit();
    },
    () => {},
  );
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
export const crFor = (pid) => cache.cr.filter((c) => c.pid === pid);
export const allCr = () => cache.cr;
export const synthFor = (pid) => cache.syn[pid] || null;
export const vitalsFor = (pid) => cache.vit[pid] || null;
// Une synthèse est à refaire si un compte rendu a été ajouté ou supprimé depuis.
export function needsSynth(s, crs) {
  if (!s) return true;
  const ids = s.crIds || [];
  return crs.some((c) => !ids.includes(c.id)) || ids.some((id) => !crs.some((c) => c.id === id));
}
export const isMine = (c) => (mode === 'shared' ? !!me && c.by === me : c.byName === myName());
export const myName = () => settings.name.trim();
// Prénom affiché dans « Bonjour … » : le compte Claude en mode partagé, sinon le réglage local.
export const displayName = () =>
  mode === 'shared' ? meName || settings.name.trim() : settings.name.trim();
export const canWrite = () => mode !== 'shared' || !!me;
export function authorOf(c) {
  if (c.by && names.get(c.by)) return names.get(c.by);
  if (c.by && c.by === me) return 'Vous';
  return c.byName || 'Un soignant';
}
export const personLabel = (id) => (id && names.get(id)) || (id && id === me ? 'Vous' : '');

/* ---------- écriture ---------- */
export async function addCr(pid, text) {
  const now = new Date();
  const doc = { pid, text, at: now.toISOString(), t: hhmm(now) };
  if (mode === 'shared') {
    await db.collection('cr').add({ ...doc, by: me });
    return;
  }
  cache.cr.push({ id: `l${now.getTime()}`, ...doc, byName: myName() || 'Un soignant' });
  saveLocal();
  emit();
}

export async function deleteCr(id) {
  if (mode === 'shared') {
    await db.doc(`cr/${id}`).delete();
    return;
  }
  cache.cr = cache.cr.filter((c) => c.id !== id);
  saveLocal();
  emit();
}

export async function saveSynth(pid, syn) {
  if (mode === 'shared') {
    await db.doc(`syntheses/${pid}`).set(syn);
    return;
  }
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
    ...(mode === 'shared' ? { validatedBy: me } : { validatedName: myName() || 'Un soignant' }),
  };
  if (mode === 'shared') {
    await db.doc(`syntheses/${pid}`).update(patch);
    return;
  }
  cache.syn[pid] = { ...s, ...patch };
  saveLocal();
  emit();
}

export async function saveVitals(pid, v) {
  if (mode === 'shared') {
    await db.doc(`vitals/${pid}`).set(v);
    return;
  }
  cache.vit[pid] = v;
  saveLocal();
  emit();
}

export function resetLocal() {
  cache.cr = SEED_CR.map((c) => ({ ...c }));
  cache.syn = {};
  cache.vit = {};
  saveLocal();
  emit();
}
