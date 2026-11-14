// Bino — le binôme des infirmiers. Démo hackathon IA santé (Hôpital Foch), données fictives.
// Parcours des maquettes papier : Patients → popup patient → Valider → « Compte rendu fait » → Patients.
// Onglet Transmissions : les comptes rendus de l'équipe, « Mes CR » ou « Tous », filtre par soignant.
import { EXAMPLES, seed } from './data.js';
import { LV, news2 } from './news2.js';
import * as FHIR from './services/fhir.js';
import * as Voice from './services/voice.js';
import { DEFAULT_FHIR, saveSettings, settings } from './settings.js';
import * as Store from './store.js';
import { esc, fmtVital, hhmm, VITAL_KEYS, VITAL_LABELS } from './util.js';
import { ic, V, vDone, vHeader, vPatientPopup, vPatients, vTransmissions } from './views.js';

const S = seed(); // patients fictifs ; comptes rendus et constantes dans Store
const U = {
  tab: 'patients',
  pid: null, // patient ouvert dans la popup
  sub: null, // feuille secondaire ouverte depuis la popup (constantes, DPI, profil)
  draft: '',
  foldOpen: false,
  listening: null,
  saving: false,
  syncing: false,
  trScope: 'mine',
  trWho: '',
};
const P = (id) => S.patients.find((p) => p.id === id);

/* ---------- rendu ---------- */
function render() {
  document.getElementById('top').innerHTML = vHeader();
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
    lastFocus?.focus?.();
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

function showPatient() {
  U.sub = null;
  sheet(vPatientPopup(S, U, Voice, EXAMPLES), true);
}

function closePatient() {
  if (U.listening) Voice.stop();
  U.listening = null;
  U.pid = null;
  U.sub = null;
  sheet('');
  render();
}

let doneTimer;
function showDone() {
  const el = document.getElementById('done');
  el.innerHTML = vDone();
  clearTimeout(doneTimer);
  doneTimer = setTimeout(() => {
    el.innerHTML = '';
  }, 1800);
}

const badgeHtml = (lv) =>
  `<span class="badge" style="background:${LV[lv].bg};color:${LV[lv].fg}">${LV[lv].l}</span>`;

function vitalsForm(id) {
  U.sub = 'vitals';
  const p = P(id);
  const v = V(p);
  const inp = (k, l, step) =>
    `<div><label class="l" for="v-${k}">${l}</label><input class="f" type="number" inputmode="decimal" step="${step || 1}" id="v-${k}" data-vit="${k}" value="${v[k]}"></div>`;
  sheet(`<h1 style="margin-top:0">Constantes</h1><p class="sub">${esc(p.nom)} · ch${p.ch} · le score se recalcule en direct</p>
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
  el.innerHTML = `<div class="between"><span class="small muted">Nouveau score NEWS2</span><span class="row" style="gap:8px"><b style="font-size:22px">${n.total}</b>${badgeHtml(n.level)}</span></div>`;
}

let dpi = null;
async function dpiImport(id) {
  U.sub = 'dpi';
  const p = P(id);
  const cur = V(p);
  const where = FHIR.isMock(settings.fhirBase)
    ? 'DPI simulé (FHIR R4, données fictives)'
    : esc(settings.fhirBase);
  sheet(
    `<h1 style="margin-top:0">Import depuis le DPI</h1><p class="sub">${esc(p.nom)} · ch${p.ch}</p><div class="card row"><span class="spin dark"></span><div><b>Lecture du dossier patient…</b><div class="small muted">${where}</div></div></div>`,
  );
  try {
    const res = await FHIR.fetchVitals(p, settings.fhirBase);
    dpi = { pid: id, res };
    const n0 = news2(cur);
    const n1 = news2({ ...cur, ...res.v });
    sheet(`<h1 style="margin-top:0">Import depuis le DPI</h1><p class="sub">${esc(p.nom)} · valeurs du dossier à ${res.at || '—'}</p>
    <div class="card"><table class="vtable cmp"><tbody><tr><td class="small muted">Paramètre</td><td class="small muted" style="text-align:right">Actuel (${cur.at})</td><td class="small muted" style="text-align:right">DPI</td></tr>
      ${VITAL_KEYS.map((k) => {
        const has = k in res.v;
        const chg = has && res.v[k] !== cur[k];
        return `<tr><td>${VITAL_LABELS[k]}</td><td style="text-align:right">${fmtVital(k, cur[k])}</td><td style="text-align:right" class="${chg ? 'new chg' : ''}">${has ? fmtVital(k, res.v[k]) : '<span class="muted">non trouvé</span>'}</td></tr>`;
      }).join('')}
    </tbody></table></div>
    <div class="card between"><span class="small muted">NEWS2</span><span class="row" style="gap:8px"><b>${n0.total} → ${n1.total}</b>${badgeHtml(n1.level)}</span></div>
    <p class="small muted">Source : ${Object.keys(res.v).length} Observations FHIR · ${where}. Le DPI reste la source de vérité.</p>
    <div class="btns"><button type="button" class="btn sec" data-act="closeSheet">Annuler</button><button type="button" class="btn" data-act="applyDpi">${ic('dl', 18)} Importer</button></div>`);
  } catch (e) {
    sheet(`<h1 style="margin-top:0">Import depuis le DPI</h1><div class="card"><b>Le DPI n'a pas répondu</b><div class="small muted">${esc(e.message)}</div></div>
    <div class="btns"><button type="button" class="btn sec" data-act="editVitals" data-arg="${id}">Saisie manuelle</button><button type="button" class="btn" data-act="dpiImport" data-arg="${id}">Réessayer</button></div>`);
  }
}

function profileSheet(welcome = false) {
  if (U.pid) U.sub = 'profile';
  const shared = Store.storeMode() === 'shared';
  sheet(`<h1 style="margin-top:0">${welcome ? 'Bienvenue sur Bino' : 'Profil'}</h1>
  ${
    shared
      ? `<div class="card small">Connecté avec votre compte Claude${Store.displayName() ? ` : <b>${esc(Store.displayName())}</b>` : ''}. Vos comptes rendus sont signés à votre nom et visibles par l'équipe qui ouvre ce lien.</div>`
      : `<p class="sub">${welcome ? 'Pour signer tes comptes rendus.' : 'Ton nom signe tes comptes rendus.'}</p>
    <div class="card"><label class="l" for="s-name">Prénom et fonction</label><input class="f" id="s-name" placeholder="Ex. : Martine · IDE" value="${esc(settings.name)}" autocomplete="given-name">
    <p class="small muted" style="margin:8px 0 0">Sur ce lien, les comptes rendus restent sur ce téléphone. Pour les partager avec l'équipe, utilisez le lien Claude.</p></div>`
  }
  ${
    welcome
      ? ''
      : `<h2>Dossier patient (DPI)</h2>
  <div class="card"><label class="l" for="s-fhir">Serveur FHIR R4</label><input class="f" id="s-fhir" value="${esc(settings.fhirBase)}" placeholder="${DEFAULT_FHIR}">
    <p class="small muted" style="margin:8px 0 0"><code>${DEFAULT_FHIR}</code> = DPI simulé fourni avec l'app.</p></div>`
  }
  <button type="button" class="btn" data-act="saveProfile" style="margin-bottom:10px">${welcome ? 'Commencer' : 'Enregistrer'}</button>
  ${!welcome && !shared ? '<button type="button" class="btn sec" data-act="askReset">Réinitialiser les données de démo</button>' : ''}`);
}

/* ---------- comptes rendus ---------- */
async function saveCr() {
  const el = document.getElementById('draft');
  const text = (el ? el.value : U.draft).trim();
  if (!text) {
    toast("Dicte ou écris d'abord le compte rendu.");
    return;
  }
  if (Store.storeMode() === 'local' && !Store.myName()) {
    U.draft = text;
    profileSheet(true);
    return;
  }
  if (U.listening) {
    await Voice.stop();
    U.listening = null;
  }
  U.saving = true;
  try {
    await Store.addCr(U.pid, text);
    U.draft = '';
    U.saving = false;
    closePatient();
    showDone();
  } catch (e) {
    U.saving = false;
    U.draft = text;
    toast(
      e?.code === 'invalid_argument'
        ? "Ton accès est en lecture seule : demande à l'équipe de te passer en Contributeur."
        : "L'enregistrement a échoué. Réessaie dans un instant.",
    );
  }
}

/* ---------- dictée ---------- */
function startMic(target) {
  if (U.listening) {
    const was = U.listening;
    Voice.stop();
    U.listening = null;
    if (was === target) {
      refreshMic();
      return;
    }
  }
  const el = document.getElementById(target);
  if (target === 'draft' && el) U.draft = el.value;
  U.listening = target;
  Voice.start({
    onPartial: (t) => {
      const l = document.getElementById('live');
      if (l) l.textContent = t;
    },
    onFinal: (t) => {
      const box = document.getElementById(target);
      if (box) box.value = `${(box.value || '').trim()} ${t}`.trim();
      if (target === 'draft') U.draft = box ? box.value : `${U.draft} ${t}`.trim();
      const l = document.getElementById('live');
      if (l) l.textContent = '';
    },
    onEnd: () => {
      if (U.listening === target) {
        U.listening = null;
        refreshMic();
      }
    },
    onError: (e) => {
      U.listening = null;
      refreshMic();
      toast(
        e?.code === 'not_granted'
          ? 'Micro refusé : tu peux taper le texte.'
          : 'Dictée indisponible ici : utilise le micro du clavier.',
      );
    },
  });
  refreshMic();
}
function refreshMic() {
  for (const b of document.querySelectorAll('[data-act="mic"]')) {
    const on = b.dataset.arg === U.listening;
    b.classList.toggle('on', on);
    b.innerHTML = ic(on ? 'stop' : 'mic', 24);
    b.setAttribute('aria-label', on ? 'Arrêter la dictée' : 'Dicter');
  }
}

/* ---------- DPI : tout le service ---------- */
async function syncAll() {
  U.syncing = true;
  render();
  let ok = 0;
  let changed = 0;
  let fail = 0;
  for (const p of S.patients) {
    try {
      const res = await FHIR.fetchVitals(p, settings.fhirBase);
      const cur = V(p);
      if (VITAL_KEYS.some((k) => k in res.v && res.v[k] !== cur[k])) {
        const next = { ...cur, ...res.v, at: res.at || hhmm(), src: 'DPI' };
        if (news2(next).total !== news2(cur).total) changed++;
        await Store.saveVitals(p.id, next);
      }
      ok++;
    } catch {
      fail++;
    }
  }
  U.syncing = false;
  render();
  toast(
    fail === S.patients.length
      ? "Le DPI n'a pas répondu. Vérifie l'adresse dans le profil."
      : `${ok} patients synchronisés avec le DPI · ${changed} score(s) modifié(s).`,
  );
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
  tab: (a) => {
    U.tab = a;
    render();
    window.scrollTo(0, 0);
  },
  openPatient: (a) => {
    U.pid = a;
    U.draft = '';
    U.foldOpen = false;
    showPatient();
  },
  useEx: (a) => {
    U.draft = EXAMPLES[+a].text;
    const el = document.getElementById('draft');
    if (el) el.value = U.draft;
  },
  mic: (a) => startMic(a),
  saveCr: () => saveCr(),
  delCr: async (a) => {
    try {
      await Store.deleteCr(a);
      toast('Compte rendu supprimé.');
      if (U.pid && !U.sub) showPatient();
    } catch {
      toast('Suppression impossible.');
    }
  },
  trScope: (a) => {
    U.trScope = a;
    U.trWho = '';
    render();
  },
  trWho: (a) => {
    U.trWho = a;
    render();
  },
  editVitals: (a) => vitalsForm(a),
  dpiImport: (a) => dpiImport(a),
  applyDpi: async () => {
    if (!dpi) return;
    const p = P(dpi.pid);
    const next = { ...V(p), ...dpi.res.v, at: dpi.res.at || hhmm(), src: 'DPI' };
    await Store.saveVitals(p.id, next);
    const n = news2(next);
    U.foldOpen = true;
    showPatient();
    render();
    toast(`Constantes importées du DPI · NEWS2 ${n.total} (${LV[n.level].l}).`);
  },
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
    toast(`Constantes enregistrées · NEWS2 ${n.total} (${LV[n.level].l}).`);
  },
  syncAll: () => syncAll(),
  settings: () => profileSheet(false),
  saveProfile: () => {
    const g = (id) => document.getElementById(id);
    const patch = {};
    if (g('s-name')) patch.name = g('s-name').value.trim();
    if (g('s-fhir')) patch.fhirBase = (g('s-fhir').value || '').trim() || DEFAULT_FHIR;
    if ('name' in patch && !patch.name) {
      toast('Indique ton prénom pour signer tes comptes rendus.');
      return;
    }
    saveSettings(patch);
    render();
    if (U.pid) {
      showPatient();
      toast('C’est noté. Tu peux valider ton compte rendu.');
    } else {
      sheet('');
      toast('Profil enregistré.');
    }
  },
  askReset: () =>
    sheet(
      `<h1 style="margin-top:0">Réinitialiser la démo ?</h1><p class="sub">Les comptes rendus et constantes de cet appareil reviennent à l'état de départ.</p><div class="btns"><button type="button" class="btn sec" data-act="closeSheet">Annuler</button><button type="button" class="btn" data-act="reset">Réinitialiser</button></div>`,
    ),
  reset: () => {
    Store.resetLocal();
    U.tab = 'patients';
    sheet('');
    render();
    toast('Démo réinitialisée.');
  },
  closeSheet: () => {
    // Une feuille ouverte depuis la popup patient (constantes, DPI, profil) ramène à la popup.
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
  if (t.dataset.vit !== undefined) vprev();
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.vit !== undefined) vprev();
});
document.addEventListener(
  'toggle',
  (e) => {
    if (e.target.matches?.('details[data-fold]')) U.foldOpen = e.target.open;
  },
  true,
);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('done').innerHTML) document.getElementById('done').innerHTML = '';
  else if (document.querySelector('details.menu[open]')) {
    for (const d of document.querySelectorAll('details.menu[open]')) d.open = false;
  } else if (document.getElementById('sheet').innerHTML) A.closeSheet();
});

Store.onChange(softRender);
render();
Voice.init().then(softRender);
Store.init().then(() => {
  softRender();
  // Première ouverture hors Claude : on demande le prénom pour « Bonjour … » et la signature.
  if (
    Store.storeMode() === 'local' &&
    !Store.myName() &&
    !document.getElementById('sheet').innerHTML
  )
    profileSheet(true);
});
