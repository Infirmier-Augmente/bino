// Chaque navigateur a sa copie du scénario, servie par l'API (/api/bino).
import * as Bino from './bino-api.js';
import { settings } from './settings.js';

const cache = { cr: [], syn: {}, vit: {}, prio: { ai: null, manual: {} } };
const listeners = [];
let loading = true;
let stale = false;
let pollTimer = null;
let apiPatients = null;

export const onChange = (fn) => listeners.push(fn);
const emit = () => {
  for (const fn of listeners) fn();
};

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

export async function init() {
  loading = true;
  emit();
  if (!(await Bino.reachable())) {
    loading = false;
    stale = true;
    emit();
    return;
  }
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
}

export const storeMode = () => 'api';
export const isLoading = () => loading;
export const isStale = () => stale;
const byTime = (a, b) => Date.parse(a.at) - Date.parse(b.at);
export const crFor = (pid) => cache.cr.filter((c) => c.pid === pid).sort(byTime);
export const allCr = () => cache.cr;
export const synthFor = (pid) => cache.syn[pid] || null;
export const vitalsFor = (pid) => cache.vit[pid] || null;
export const needsSynth = () => false;
export const isMine = (c) => !!c.nurseId && c.nurseId === Bino.currentNurseId();
export const myName = () => settings.name.trim();
export const displayName = () => myName();
export const authorOf = (c) => c.byName || 'Un soignant';
export const patientRows = () => apiPatients;

export async function addCr(pid, text) {
  await Bino.addCr(pid, text, settings.matricule);
  refreshBino().catch(() => {
    stale = true;
    emit();
  });
}

export async function reviewMine() {
  await Bino.reviewMine(cache.cr, settings.matricule);
  await refreshBino();
}

export async function setManualLevel(pid, level) {
  await Bino.setLevel(pid, level, settings.matricule);
  await refreshBino();
}

export async function saveVitals(pid, v) {
  cache.vit[pid] = v;
  emit();
}

export const prioAI = () => cache.prio.ai;
export const manualLevels = () => cache.prio.manual || {};
