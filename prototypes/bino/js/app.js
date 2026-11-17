// Bino — le binôme des infirmiers. Démo hackathon IA santé (Hôpital Foch), données fictives.
// Parcours des maquettes papier : Patients → popup patient → Valider → « Compte rendu fait » → Patients.
// Onglet Transmissions : les comptes rendus de l'équipe, « Mes CR » ou « Tous », filtre par soignant.
import { findStaff, staffName } from './auth.js';
import { transcribe } from './bino-api.js';
import { EXAMPLES, seed } from './data.js';
import { buildModel, DOC_CSS, docFile, docHtml, docText } from './document.js';
import { news2 } from './news2.js';
import * as Voice from './services/voice.js';
import { saveSettings, settings } from './settings.js';
import * as Store from './store.js';
import { esc, hhmm } from './util.js';
import {
  byPriority,
  ic,
  levelOf,
  PRIO,
  room,
  V,
  vDone,
  vHeader,
  vLogged,
  vLogin,
  vPatientPopup,
  vPatients,
  vShiftAsk,
  vTransmissions,
} from './views.js';

const S = seed(); // rempli par l'API dès qu'elle répond
const U = {
  tab: 'patients',
  pid: null, // patient ouvert dans la popup
  sub: null, // feuille secondaire ouverte depuis la popup (constantes, profil)
  draft: '',
  foldOpen: false,
  listening: null,
  capture: null,
  saving: false,
  syncing: false,
  trScope: 'mine',
  lvlOpen: null, // patient dont la rangée de priorité 1 à 3 est dépliée (Transmissions › Tous)
  docBusy: '',
  sumBusy: '',
  triBusy: false,
  sortBy: ['chambre', 'nom'].includes(settings.sortBy) ? settings.sortBy : 'chambre',
  trSort: ['chambre', 'nom', 'prio'].includes(settings.trSort) ? settings.trSort : 'prio',
  trQuery: '',
  loginError: '',
  loginId: '',
  justIn: false,
};
let docModel = null;
const P = (id) => S.patients.find((p) => p.id === id);
const signedIn = () => !!settings.matricule;

function alignSession() {
  const name = staffName(settings.matricule);
  if (name && name !== settings.name) saveSettings({ name });
}

function loginError(msg) {
  U.loginError = msg;
  let el = document.querySelector('.login-err');
  if (!el) {
    el = document.createElement('p');
    el.className = 'login-err';
    el.setAttribute('role', 'alert');
    document.querySelector('.login-card .btn')?.before(el);
  }
  el.textContent = msg;
}

/* ---------- rendu ---------- */
function render() {
  if (signedIn()) alignSession();
  const gate = !signedIn() || U.justIn;
  document.body.classList.toggle('locked', gate);
  document.getElementById('shift').hidden = gate || U.tab !== 'transmissions';
  if (gate) {
    const top = document.getElementById('top');
    top.hidden = true;
    top.innerHTML = '';
    document.getElementById('tabs').innerHTML = '';
    document.getElementById('app').innerHTML = signedIn()
      ? vLogged(settings.name)
      : vLogin(U.loginError, U.loginId);
    return;
  }
  const top = document.getElementById('top');
  top.hidden = U.tab !== 'patients';
  top.innerHTML = U.tab === 'patients' ? vHeader() : '';
  document.getElementById('app').innerHTML =
    U.tab === 'transmissions' ? vTransmissions(S, U) : vPatients(S, U);
  const tabs = [
    ['patients', 'Patients', 'users'],
    ['transmissions', 'Transmissions', 'doc'],
  ];
  document.getElementById('tabs').innerHTML = tabs
    .map(
      ([k, l, i]) =>
        `<button type="button" class="${U.tab === k ? 'on' : ''}" data-act="tab" data-arg="${k}" ${U.tab === k ? 'aria-current="page"' : ''}>${ic(i, 22)}<span>${l}</span></button>`,
    )
    .join('');
}

// Les mises à jour venues des autres soignants ne coupent ni une saisie ni la popup ouverte.
function softRender() {
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
  if (document.querySelector('details.menu[open]')) return;
  render();
}

/* ---------- feuilles et popups ---------- */
let lastFocus = null;
function sheet(html, full = false) {
  const el = document.getElementById('sheet');
  if (!html) {
    el.innerHTML = '';
    lastFocus?.focus?.({ preventScroll: true });
    return;
  }
  if (!el.innerHTML) lastFocus = document.activeElement;
  el.innerHTML = `<div class="sheet-wrap ${full ? 'full' : ''}" data-act="closeSheetBg"><div class="sheet" role="dialog" aria-modal="true"><div class="between sheet-top"><span></span><button type="button" class="icon-btn" data-act="closeSheet" aria-label="Fermer">${ic('x', 24)}</button></div>${html}</div></div>`;
  const h = el.querySelector('h1');
  if (h) {
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }
}

let listScroll = 0;
let scrollToken = 0;
function keepListPlace() {
  const y = listScroll;
  const token = ++scrollToken;
  const apply = () => {
    if (token === scrollToken) window.scrollTo(0, y);
  };
  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 350);
}

function showPatient() {
  U.sub = null;
  sheet(vPatientPopup(S, U, EXAMPLES), true);
}

function closePatient() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  if (U.listening) Voice.stop();
  U.listening = null;
  U.capture = null;
  U.pid = null;
  U.sub = null;
  sheet('');
  render();
  keepListPlace();
}

let doneTimer;
function showDone(title) {
  const el = document.getElementById('done');
  el.innerHTML = vDone(title);
  clearTimeout(doneTimer);
  doneTimer = setTimeout(() => {
    el.innerHTML = '';
  }, 1800);
}

function vitalsForm(id) {
  U.sub = 'vitals';
  const p = P(id);
  const v = V(p);
  const inp = (k, l, step) =>
    `<div><label class="l" for="v-${k}">${l}</label><input class="f" type="number" inputmode="decimal" step="${step || 1}" id="v-${k}" data-vit="${k}" value="${v[k]}"></div>`;
  sheet(`<h1 style="margin-top:0">Constantes</h1><p class="sub">${esc(p.nom)} · ${room(p)} · le score se recalcule en direct</p>
  <div class="card"><div class="grid2">${inp('fr', 'FR (/min)')}${inp('spo2', 'SpO2 (%)')}${inp('pas', 'TA systolique')}${inp('pad', 'TA diastolique')}${inp('fc', 'FC (/min)')}${inp('temp', 'Température (°C)', '0.1')}
    <div><label class="l" for="v-o2">Oxygène</label><select class="f" id="v-o2" data-vit="o2"><option value="0" ${!v.o2 ? 'selected' : ''}>Air ambiant</option><option value="1" ${v.o2 ? 'selected' : ''}>Sous O2</option></select></div>
    <div><label class="l" for="v-cons">Conscience</label><select class="f" id="v-cons" data-vit="cons"><option value="A" ${v.cons === 'A' ? 'selected' : ''}>Alerte</option><option value="C" ${v.cons !== 'A' ? 'selected' : ''}>Confusion / altérée</option></select></div></div></div>
  <div class="card" id="vprev"></div>
  <button type="button" class="btn" data-act="saveVitals" data-arg="${id}">Enregistrer</button>`);
  vprev();
}
function readVitals() {
  const g = (k) => document.getElementById(`v-${k}`);
  return {
    fr: +g('fr').value,
    spo2: +g('spo2').value,
    pas: +g('pas').value,
    pad: +g('pad').value,
    fc: +g('fc').value,
    temp: Number.parseFloat(String(g('temp').value).replace(',', '.')),
    o2: g('o2').value === '1',
    cons: g('cons').value,
  };
}
function vprev() {
  const el = document.getElementById('vprev');
  if (!el) return;
  const n = news2(readVitals());
  el.innerHTML = `<div class="between"><span class="small muted">Nouveau score NEWS2</span><span class="row" style="gap:8px"><b style="font-size:22px">${n.total}</b></span></div>`;
}

/* ---------- document de transmission global ---------- */
function synthFor(p) {
  return Store.synthFor(p.id);
}

async function genDoc() {
  const ps = byPriority(S.patients);
  const todo = ps.filter((p) => Store.crFor(p.id).length);
  let done = 0;
  U.docBusy = `Synthèse 0/${todo.length}`;
  render();
  const syns = new Map();
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      syns.set(p.id, synthFor(p));
      done++;
      U.docBusy = `Synthèse ${done}/${todo.length}`;
      const b = document.querySelector('[data-act="genDoc"]');
      if (b) b.innerHTML = `<span class="spin"></span> ${esc(U.docBusy)}`;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  docModel = buildModel(
    ps.map((p) => ({
      p,
      v: V(p),
      level: levelOf(p),
      crs: Store.crFor(p.id),
      syn: syns.get(p.id) || null,
    })),
    {
      date: new Date().toLocaleDateString('fr-FR'),
      time: hhmm(),
      author: Store.myName(),
      service: 'Réanimation',
      authorOf: Store.authorOf,
    },
  );
  U.docBusy = '';
  render();
  showDoc();
}

function showDoc() {
  if (!docModel) return;
  sheet(
    `<div class="doc-actions"><button type="button" class="btn sec sm" data-act="copyDoc">${ic('copy', 16)} Copier</button><button type="button" class="btn sm" data-act="downloadDoc">${ic('dl', 16)} Télécharger</button></div>${docHtml(docModel)}`,
    true,
  );
}

async function downloadDoc() {
  if (!docModel) return;
  const filename = `transmission-${docModel.date.replace(/\//g, '-')}.html`;
  const data = docFile(docModel);
  const url = URL.createObjectURL(new Blob([data], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast('Document téléchargé.');
}

/* ---------- comptes rendus ---------- */
async function saveCr() {
  if (U.saving) return;
  if (U.capture === 'server' && U.listening) {
    const target = U.listening;
    U.listening = null;
    U.capture = null;
    const heard = await finishServerMic(target);
    if (!heard) return;
  } else if (U.listening) {
    Voice.stop();
    U.listening = null;
  }
  const el = document.getElementById('draft');
  const text = (el ? el.value : U.draft).trim();
  if (!text) {
    toast("Dicte ou écris d'abord le compte rendu.");
    return;
  }
  U.saving = true;
  const pid = U.pid;
  U.draft = '';
  closePatient();
  showDone();
  try {
    await Store.addCr(pid, text);
  } catch (e) {
    const done = document.getElementById('done');
    if (done) done.innerHTML = '';
    U.draft = text;
    U.pid = pid;
    showPatient();
    toast(
      e?.code === 'invalid_argument'
        ? "Ton accès est en lecture seule : demande à l'équipe de te passer en Contributeur."
        : "L'enregistrement a échoué. Le texte est toujours là, réessaie.",
    );
  } finally {
    U.saving = false;
  }
}

/* ---------- dictée ---------- */
function micUnavailable() {
  document.getElementById('draft')?.focus();
  toast('Dictée indisponible ici : utilise le micro du clavier.');
}

async function finishServerMic(target) {
  const live = document.getElementById('live');
  if (live) live.textContent = 'Transcription…';
  try {
    const blob = await Voice.stopRecording();
    if (!blob || blob.size < 800) {
      toast('Rien entendu. Réessaie, ou tape le texte.');
      return false;
    }
    const text = await transcribe(blob);
    if (!text) {
      toast('Rien entendu. Réessaie, ou tape le texte.');
      return false;
    }
    const box = document.getElementById(target);
    if (box) box.value = `${(box.value || '').trim()} ${text}`.trim();
    if (target === 'draft') U.draft = box ? box.value : `${U.draft} ${text}`.trim();
    return true;
  } catch {
    toast('La transcription a échoué. Tu peux taper le texte.');
    return false;
  } finally {
    if (live) live.textContent = '';
    refreshMic();
  }
}

function beginServerMic(target) {
  const el = document.getElementById(target);
  if (target === 'draft' && el) U.draft = el.value;
  U.listening = target;
  U.capture = 'server';
  const live = document.getElementById('live');
  if (live) live.textContent = 'Écoute…';
  refreshMic();
  Voice.startRecording().catch((e) => {
    if (U.capture !== 'server') return;
    U.listening = null;
    U.capture = null;
    refreshMic();
    if (live) live.textContent = '';
    const denied = e?.name === 'NotAllowedError' || e?.name === 'SecurityError';
    toast(
      denied
        ? 'Micro refusé : tu peux taper le texte.'
        : 'Aucun micro détecté. Tu peux taper le texte.',
    );
  });
}

function startMic(target) {
  if (U.listening) {
    const was = U.listening;
    const server = U.capture === 'server';
    U.listening = null;
    U.capture = null;
    if (server) {
      refreshMic();
      void finishServerMic(was);
      return;
    }
    Voice.stop();
    refreshMic();
    if (was === target) return;
  }
  if (Voice.canDictate() && Voice.useBrowserDictation()) {
    beginBrowserMic(target);
    return;
  }
  if (Voice.canRecord()) {
    beginServerMic(target);
    return;
  }
  micUnavailable();
}

function beginBrowserMic(target) {
  const el = document.getElementById(target);
  if (target === 'draft' && el) U.draft = el.value;
  U.listening = target;
  const live = document.getElementById('live');
  if (live) live.textContent = 'Écoute…';
  Voice.start({
    onPartial: (t) => {
      const l = document.getElementById('live');
      if (l) l.textContent = t || 'Écoute…';
    },
    onFinal: (t) => {
      const box = document.getElementById(target);
      if (box) box.value = `${(box.value || '').trim()} ${t}`.trim();
      if (target === 'draft') U.draft = box ? box.value : `${U.draft} ${t}`.trim();
      const l = document.getElementById('live');
      if (l) l.textContent = U.listening === target ? 'Écoute…' : '';
    },
    onEnd: () => {
      if (U.listening === target) {
        U.listening = null;
        refreshMic();
      }
      const l = document.getElementById('live');
      if (l && l.textContent === 'Écoute…') l.textContent = '';
    },
    onError: (e) => {
      U.listening = null;
      refreshMic();
      const l = document.getElementById('live');
      if (l) l.textContent = '';
      const messages = {
        not_granted: 'Micro refusé : tu peux taper le texte.',
        network: 'La dictée ne joint pas le service vocal. Tu peux taper le texte.',
        'service-not-allowed': 'Ce navigateur ne dicte pas. Tu peux taper le texte.',
        'audio-capture': 'Aucun micro détecté. Tu peux taper le texte.',
      };
      toast(messages[e?.code] || 'Dictée indisponible ici : utilise le micro du clavier.');
    },
  });
  refreshMic();
}
function refreshMic() {
  for (const b of document.querySelectorAll('[data-act="mic"]')) {
    const on = b.dataset.arg === U.listening;
    b.classList.toggle('on', on);
    b.innerHTML = ic(on ? 'stop' : 'mic', 28);
    b.setAttribute('aria-label', on ? 'Arrêter la dictée' : 'Dicter');
  }
}

/* ---------- actions ---------- */
let tt;
function toast(m) {
  const t = document.getElementById('toast');
  t.innerHTML = `<div class="toast">${esc(m)}</div>`;
  clearTimeout(tt);
  tt = setTimeout(() => {
    t.innerHTML = '';
  }, 4000);
}

const A = {
  login: () => {
    const idEl = document.getElementById('login-id');
    const pwEl = document.getElementById('login-pw');
    const id = idEl?.value || '';
    const pw = pwEl?.value || '';
    if (!id.trim() || !pw.trim()) {
      loginError('Indique le matricule et le mot de passe.');
      (id.trim() ? pwEl : idEl)?.focus();
      return;
    }
    const staff = findStaff(id, pw);
    if (!staff) {
      loginError('Matricule ou mot de passe incorrect.');
      pwEl?.focus();
      return;
    }
    saveSettings({ matricule: staff.matricule, name: staff.name });
    U.loginError = '';
    U.loginId = '';
    U.justIn = true;
    render();
  },
  enter: () => {
    U.justIn = false;
    render();
  },
  logout: () => {
    if (U.listening) Voice.stop();
    U.listening = null;
    U.capture = null;
    U.pid = null;
    U.sub = null;
    U.justIn = false;
    U.loginError = '';
    U.loginId = '';
    saveSettings({ matricule: '', name: '' });
    sheet('');
    document.getElementById('done').innerHTML = '';
    render();
  },
  tab: (a) => {
    U.tab = a;
    render();
    window.scrollTo(0, 0);
  },
  openPatient: (a) => {
    listScroll = window.scrollY;
    U.pid = a;
    U.draft = '';
    U.foldOpen = false;
    showPatient();
  },
  toggleDossier: () => {
    const el = document.getElementById('draft');
    if (el) U.draft = el.value;
    U.foldOpen = !U.foldOpen;
    const sc = document.querySelector('.sheet')?.scrollTop || 0;
    showPatient();
    const sh = document.querySelector('.sheet');
    if (sh) sh.scrollTop = sc;
  },
  genDoc: () => genDoc(),
  copyDoc: () => {
    if (!docModel) return;
    const t = docText(docModel);
    if (navigator.clipboard)
      navigator.clipboard
        .writeText(t)
        .then(() => toast('Document copié.'))
        .catch(() => toast('Copie impossible ici.'));
    else toast('Copie impossible ici.');
  },
  downloadDoc: () => downloadDoc(),
  useEx: (a) => {
    U.draft = EXAMPLES[+a].text;
    const el = document.getElementById('draft');
    if (el) el.value = U.draft;
  },
  mic: (a) => startMic(a),
  saveCr: () => saveCr(),
  askShift: () => {
    document.getElementById('done').innerHTML = vShiftAsk();
  },
  cancelShift: (_a, el, e) => {
    if (el.classList.contains('done-wrap') && e.target !== el) return;
    document.getElementById('done').innerHTML = '';
  },
  confirmShift: async () => {
    document.getElementById('done').innerHTML = '';
    try {
      await Store.reviewMine();
      toast('Transmission validée.');
    } catch {
      toast('Validation impossible pour le moment.');
    }
  },

  trScope: (a) => {
    U.trScope = a;
    render();
  },
  sortBy: (a) => {
    U.sortBy = a;
    saveSettings({ sortBy: a });
    render();
  },
  trSort: (a) => {
    if (!['chambre', 'nom', 'prio'].includes(a)) return;
    U.trSort = a;
    saveSettings({ trSort: a });
    render();
  },
  pickLevel: (a) => {
    U.lvlOpen = U.lvlOpen === a ? null : a;
    render();
  },
  setLevel: async (a) => {
    const [pid, lv] = a.split(':');
    try {
      await Store.setManualLevel(pid, lv || null);
    } catch {
      toast('Modification impossible pour le moment.');
    }
    U.lvlOpen = null;
    render();
    toast(lv ? `Priorité ${PRIO[lv]} enregistrée.` : 'Priorité proposée rétablie.');
  },
  editVitals: (a) => vitalsForm(a),

  saveVitals: async (a) => {
    const v = readVitals();
    if ([v.fr, v.spo2, v.pas, v.pad, v.fc, v.temp].some((x) => !Number.isFinite(x) || x <= 0)) {
      toast('Vérifie les valeurs saisies.');
      return;
    }
    await Store.saveVitals(a, { ...v, at: hhmm(), src: 'saisie' });
    const n = news2(v);
    U.foldOpen = true;
    showPatient();
    render();
    toast(`Constantes enregistrées · NEWS2 ${n.total}.`);
  },
  closeSheet: () => {
    // Une feuille ouverte depuis la popup patient (constantes, profil) ramène à la popup.
    if (U.pid && U.sub) showPatient();
    else if (U.pid) closePatient();
    else sheet('');
  },
  closeSheetBg: (_a, el, e) => {
    if (e.target === el) A.closeSheet();
  },
  closeDone: (_a, el, e) => {
    if (e.target === el || el.classList.contains('done-x')) {
      document.getElementById('done').innerHTML = '';
    }
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) {
    for (const d of document.querySelectorAll('details.menu[open]'))
      if (!d.contains(e.target)) d.open = false;
    return;
  }
  const menu = el.closest('details.menu');
  if (menu) menu.open = false;
  if (!['closeSheetBg', 'closeDone'].includes(el.dataset.act)) e.preventDefault();
  A[el.dataset.act]?.(el.dataset.arg, el, e);
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.model) U[t.dataset.model] = t.value;
  if (t.id === 'tr-q') {
    const pos = t.selectionStart;
    render();
    const el = document.getElementById('tr-q');
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos);
    }
    return;
  }
  if (t.dataset.vit !== undefined) vprev();
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.vit !== undefined) vprev();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('login-id')) {
    e.preventDefault();
    if (document.activeElement?.id === 'login-id') {
      document.getElementById('login-pw')?.focus();
      return;
    }
    A.login();
    return;
  }
  if (e.key !== 'Escape') return;
  if (document.getElementById('done').innerHTML) document.getElementById('done').innerHTML = '';
  else if (document.querySelector('details.menu[open]')) {
    for (const d of document.querySelectorAll('details.menu[open]')) d.open = false;
  } else if (document.getElementById('sheet').innerHTML) A.closeSheet();
});

const style = document.createElement('style');
style.textContent = DOC_CSS;
document.head.append(style);

Store.onChange(() => {
  const rows = Store.patientRows();
  if (rows?.length) S.patients.splice(0, S.patients.length, ...rows);
  softRender();
});
render();
Voice.init().then(softRender);
Store.init().then(() => {
  softRender();
});
