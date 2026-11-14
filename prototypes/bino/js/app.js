// Bino — le binôme des infirmiers. Démo hackathon IA santé (Hôpital Foch), données fictives.
// Deux onglets : le dashboard (patients → fiche → comptes rendus) et la transmission finale.
import { EXAMPLES, seed } from './data.js';
import { LV, news2 } from './news2.js';
import * as AI from './services/ai.js';
import * as FHIR from './services/fhir.js';
import * as Voice from './services/voice.js';
import { DEFAULT_FHIR, DEFAULT_MODEL, saveSettings, settings } from './settings.js';
import * as Store from './store.js';
import { localSynth, normalizeSynth, remapIds, synthPrompt } from './synthesis.js';
import { esc, fmtVital, hhmm, VITAL_KEYS, VITAL_LABELS } from './util.js';
import { ic, sorted, V, vDashboard, vFinale, vPatient } from './views.js';

const S = seed(); // patients (fictifs) ; les comptes rendus, synthèses et constantes sont dans Store
const U = {
  tab: 'dashboard',
  pid: null,
  draft: '',
  foldOpen: false,
  listening: null,
  saving: false,
  synthBusy: false,
  syncing: false,
  speaking: false,
};
const P = (id) => S.patients.find((p) => p.id === id);

/* ---------- rendu ---------- */
function render() {
  const app = document.getElementById('app');
  if (U.tab === 'finale') app.innerHTML = vFinale(S, U, Voice);
  else if (U.pid) app.innerHTML = vPatient(S, U, Voice, EXAMPLES);
  else app.innerHTML = vDashboard(S, U);
  const tabs = [
    ['dashboard', 'Patients', 'list'],
    ['finale', 'Transmission finale', 'doc'],
  ];
  document.getElementById('tabs').innerHTML = tabs
    .map(
      ([k, l, i]) =>
        `<button type="button" class="${U.tab === k ? 'on' : ''}" data-act="tab" data-arg="${k}" ${U.tab === k ? 'aria-current="page"' : ''}>${ic(i, 22)}<span>${l}</span></button>`,
    )
    .join('');
}

// Re-rendu sans perdre la saisie en cours ni le focus (mises à jour venues des autres soignants).
function softRender() {
  const a = document.activeElement;
  if (a && (a.id === 'draft' || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
  if (document.querySelector('details.menu[open]')) return;
  render();
}

/* ---------- feuilles ---------- */
let lastFocus = null;
function sheet(html) {
  const el = document.getElementById('sheet');
  if (!html) {
    el.innerHTML = '';
    lastFocus?.focus?.();
    return;
  }
  if (!el.innerHTML) lastFocus = document.activeElement;
  el.innerHTML = `<div class="sheet-wrap" data-act="closeSheetBg"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><div class="between"><span></span><button type="button" class="icon-btn" data-act="closeSheet" aria-label="Fermer">${ic('x', 22)}</button></div>${html}</div></div>`;
  const h = el.querySelector('h1');
  if (h) {
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }
}

const badgeHtml = (lv) =>
  `<span class="badge" style="background:${LV[lv].bg};color:${LV[lv].fg}">${LV[lv].l}</span>`;

function vitalsForm(id) {
  const p = P(id);
  const v = V(p);
  const inp = (k, l, step) =>
    `<div><label class="l" for="v-${k}">${l}</label><input class="f" type="number" inputmode="decimal" step="${step || 1}" id="v-${k}" data-vit="${k}" value="${v[k]}"></div>`;
  sheet(`<h1 style="margin-top:0">Constantes</h1><p class="sub">Ch. ${p.ch} · ${esc(p.nom)} · le score se recalcule en direct</p>
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
  const p = P(id);
  const cur = V(p);
  const where = FHIR.isMock(settings.fhirBase)
    ? 'DPI simulé (FHIR R4, données fictives)'
    : esc(settings.fhirBase);
  sheet(
    `<h1 style="margin-top:0">Import depuis le DPI</h1><p class="sub">Ch. ${p.ch} · ${esc(p.nom)}</p><div class="card bino-card"><span class="spin dark"></span><div><div class="t">Lecture du dossier patient…</div><div class="small muted">${where}</div></div></div>`,
  );
  try {
    const res = await FHIR.fetchVitals(p, settings.fhirBase);
    dpi = { pid: id, res };
    const n0 = news2(cur);
    const n1 = news2({ ...cur, ...res.v });
    sheet(`<h1 style="margin-top:0">Import depuis le DPI</h1><p class="sub">Ch. ${p.ch} · ${esc(p.nom)} · valeurs du dossier à ${res.at || '—'}</p>
    <div class="card"><table class="vtable cmp"><tbody><tr><td class="small muted">Paramètre</td><td class="small muted" style="text-align:right">Actuel (${cur.at})</td><td class="small muted" style="text-align:right">DPI</td></tr>
      ${VITAL_KEYS.map((k) => {
        const has = k in res.v;
        const chg = has && res.v[k] !== cur[k];
        return `<tr><td>${VITAL_LABELS[k]}</td><td style="text-align:right">${fmtVital(k, cur[k])}</td><td style="text-align:right" class="${chg ? 'new chg' : ''}">${has ? fmtVital(k, res.v[k]) : '<span class="muted">non trouvé</span>'}</td></tr>`;
      }).join('')}
    </tbody></table></div>
    <div class="card between"><span class="small muted">NEWS2</span><span class="row" style="gap:8px"><b>${n0.total} → ${n1.total}</b>${badgeHtml(n1.level)}</span></div>
    <p class="small muted">Source : ${Object.keys(res.v).length} Observations FHIR · ${where}. Le DPI reste la source de vérité ; les valeurs non trouvées sont conservées.</p>
    <div class="btns"><button type="button" class="btn sec" data-act="closeSheet">Annuler</button><button type="button" class="btn" data-act="applyDpi">${ic('dl', 18)} Importer</button></div>`);
  } catch {
    sheet(`<h1 style="margin-top:0">Import depuis le DPI</h1><div class="card"><div class="t">Le DPI n'a pas répondu</div><div class="small muted">${esc(e.message)}</div></div>
    <p class="small muted">Vérifie l'adresse du serveur FHIR dans Réglages, ou saisis les constantes à la main.</p>
    <div class="btns"><button type="button" class="btn sec" data-act="editVitals" data-arg="${id}">Saisie manuelle</button><button type="button" class="btn" data-act="dpiImport" data-arg="${id}">Réessayer</button></div>`);
  }
}

function settingsSheet() {
  const shared = Store.storeMode() === 'shared';
  sheet(`<h1 style="margin-top:0">Réglages</h1><p class="sub">Propres à ce navigateur.</p>
  <h2>Qui écrit ?</h2>
  <div class="card">${
    shared
      ? '<div class="small">Les comptes rendus sont signés avec votre compte Claude et partagés avec toute l\'équipe qui ouvre ce lien.</div>'
      : `<label class="l" for="s-name">Ton prénom et ta fonction</label><input class="f" id="s-name" placeholder="Ex. : Martine · IDE" value="${esc(settings.name)}">
    <p class="small muted" style="margin:8px 0 0">Ici, les comptes rendus restent sur cet appareil. Pour les partager avec l'équipe, utilisez le lien Claude.</p>`
  }</div>
  <h2>Intelligence artificielle</h2>
  <div class="card">${
    AI.insideClaude()
      ? `<div class="small">Dans Claude, l'IA est fournie par la page${AI.mode() === 'claude' ? ' : <b>active</b>.' : ' : pas disponible ici, règles locales utilisées.'}</div>`
      : `<div class="small muted" style="margin-bottom:8px">Sans clé, Bino synthétise avec des règles simples. Avec une clé API Anthropic de test, la synthèse passe par Claude.</div>
    <label class="l" for="s-key">Clé API Anthropic (facultatif)</label><input class="f" id="s-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(settings.apiKey)}">
    <label class="l" for="s-model" style="margin-top:10px">Modèle</label><input class="f" id="s-model" value="${esc(settings.model || DEFAULT_MODEL)}">
    <p class="small muted" style="margin:8px 0 0">Clé de test à budget limité, gardée dans ce navigateur. Données fictives uniquement.</p>`
  }</div>
  <h2>Dossier patient (DPI)</h2>
  <div class="card"><label class="l" for="s-fhir">Serveur FHIR R4</label><input class="f" id="s-fhir" value="${esc(settings.fhirBase)}" placeholder="${DEFAULT_FHIR}">
    <p class="small muted" style="margin:8px 0 0"><code>${DEFAULT_FHIR}</code> = DPI simulé fourni avec l'app.</p></div>
  <button type="button" class="btn" data-act="saveSettings" style="margin-bottom:10px">Enregistrer</button>
  ${shared ? '' : '<button type="button" class="btn sec" data-act="askReset">Réinitialiser les données de démo</button>'}`);
}

/* ---------- comptes rendus ---------- */
async function saveCr() {
  const el = document.getElementById('draft');
  const text = (el ? el.value : U.draft).trim();
  if (!text) {
    toast("Dicte ou écris d'abord quelques mots.");
    return;
  }
  if (Store.storeMode() === 'local' && !Store.myName()) {
    U.draft = text;
    settingsSheet();
    toast('Indique ton prénom pour signer tes comptes rendus.');
    return;
  }
  if (U.listening) {
    await Voice.stop();
    U.listening = null;
  }
  U.saving = true;
  render();
  try {
    await Store.addCr(U.pid, text);
    U.draft = '';
    toast('Compte rendu enregistré. Il apparaîtra dans la transmission finale.');
  } catch {
    U.draft = text;
    toast(
      e?.code === 'invalid_argument'
        ? "Ton accès est en lecture seule : demande à l'équipe de te passer en Contributeur."
        : "L'enregistrement a échoué. Réessaie dans un instant.",
    );
  }
  U.saving = false;
  render();
}

/* ---------- synthèses ---------- */
async function synthOne(pid) {
  const p = P(pid);
  const crs = Store.crFor(pid);
  if (!crs.length) return;
  let syn = null;
  let engine = 'local';
  if (AI.mode() !== 'off') {
    try {
      const raw = await AI.askJSON(synthPrompt(p, crs, Store.authorOf));
      syn = normalizeSynth(remapIds(raw, crs), crs);
      engine = 'ai';
      if (!syn.cibles.length) syn = null;
    } catch {
      syn = null;
    }
  }
  if (!syn) {
    syn = localSynth(crs);
    engine = 'local';
  }
  await Store.saveSynth(pid, {
    ...syn,
    engine,
    crIds: crs.map((c) => c.id),
    at: new Date().toISOString(),
    t: hhmm(),
  });
}

async function synth(pids) {
  U.synthBusy = true;
  render();
  let fail = 0;
  for (const pid of pids) {
    try {
      await synthOne(pid);
    } catch {
      fail++;
    }
  }
  U.synthBusy = false;
  render();
  toast(fail ? `${fail} synthèse(s) n'ont pas pu être enregistrées.` : 'Synthèses à jour.');
}

function finaleText() {
  return sorted(S.patients)
    .map((p) => {
      const s = Store.synthFor(p.id);
      const n = news2(V(p));
      const head = `Chambre ${p.ch}, ${p.nom}, ${p.age} ans, ${p.motif}. NEWS2 ${n.total} (${LV[n.level].l}). Allergie : ${p.allergies}.`;
      if (!s) return `${head}\nPas de synthèse.`;
      const cib = s.cibles
        .map(
          (c) =>
            `- ${c.c} : ${c.D.t}${c.A ? ` ${c.A.t}` : ''}${c.R ? ` ${c.R.t}` : ' Résultat non renseigné.'}`,
        )
        .join('\n');
      const todo = s.todo.length ? `\nÀ faire : ${s.todo.map((t) => t.t).join(' ; ')}` : '';
      return `${head}${s.resume ? `\nÀ retenir : ${s.resume.t}` : ''}\n${cib}${todo}`;
    })
    .join('\n\n');
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
    b.innerHTML = ic(on ? 'stop' : 'mic', b.classList.contains('sm') ? 18 : 22);
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
      ? "Le DPI n'a pas répondu. Vérifie l'adresse dans Réglages."
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
    if (a === 'dashboard') U.pid = null;
    sheet('');
    render();
    window.scrollTo(0, 0);
  },
  openPatient: (a) => {
    U.pid = a;
    U.draft = '';
    U.foldOpen = false;
    render();
    window.scrollTo(0, 0);
  },
  back: () => {
    if (U.listening) Voice.stop();
    U.listening = null;
    U.pid = null;
    render();
    window.scrollTo(0, 0);
  },
  useEx: (a) => {
    U.draft = EXAMPLES[+a].text;
    render();
  },
  mic: (a) => startMic(a),
  saveCr: () => saveCr(),
  delCr: async (a) => {
    try {
      await Store.deleteCr(a);
      toast('Compte rendu supprimé.');
    } catch {
      toast('Suppression impossible.');
    }
  },
  synth: (a) => synth([a]),
  synthAll: () =>
    synth(
      S.patients
        .filter((p) => {
          const crs = Store.crFor(p.id);
          const s = Store.synthFor(p.id);
          return crs.length && Store.needsSynth(s, crs);
        })
        .map((p) => p.id),
    ),
  validateSynth: async (a) => {
    try {
      await Store.validateSynth(a);
      toast('Synthèse validée.');
    } catch {
      toast('Validation impossible pour le moment.');
    }
  },
  copyAll: () => {
    const txt = finaleText();
    if (navigator.clipboard)
      navigator.clipboard
        .writeText(txt)
        .then(() => toast('Transmission finale copiée.'))
        .catch(() => toast('Copie impossible ici.'));
    else toast('Copie impossible ici.');
  },
  speak: () => {
    if (Voice.isSpeaking()) Voice.stopSpeaking();
    else Voice.speak(finaleText().replace(/\n- /g, '. ').replace(/\n/g, ' '));
  },
  editVitals: (a) => vitalsForm(a),
  dpiImport: (a) => dpiImport(a),
  applyDpi: async () => {
    if (!dpi) return;
    const p = P(dpi.pid);
    const next = { ...V(p), ...dpi.res.v, at: dpi.res.at || hhmm(), src: 'DPI' };
    await Store.saveVitals(p.id, next);
    sheet('');
    render();
    const n = news2(next);
    toast(`Constantes importées du DPI · NEWS2 ${n.total} (${LV[n.level].l}).`);
  },
  saveVitals: async (a) => {
    const v = readVitals();
    if ([v.fr, v.spo2, v.pas, v.pad, v.fc, v.temp].some((x) => !Number.isFinite(x) || x <= 0)) {
      toast('Vérifie les valeurs saisies.');
      return;
    }
    await Store.saveVitals(a, { ...v, at: hhmm(), src: 'saisie' });
    sheet('');
    render();
    const n = news2(v);
    toast(`Constantes enregistrées · NEWS2 ${n.total} (${LV[n.level].l}).`);
  },
  syncAll: () => syncAll(),
  settings: () => settingsSheet(),
  saveSettings: () => {
    const g = (id) => document.getElementById(id);
    const patch = { fhirBase: (g('s-fhir').value || '').trim() || DEFAULT_FHIR };
    if (g('s-name')) patch.name = g('s-name').value.trim();
    if (g('s-key')) {
      patch.apiKey = g('s-key').value.trim();
      patch.model = g('s-model').value.trim() || DEFAULT_MODEL;
    }
    saveSettings(patch);
    sheet('');
    render();
    toast('Réglages enregistrés.');
  },
  askReset: () =>
    sheet(
      `<h1 style="margin-top:0">Réinitialiser la démo ?</h1><p class="sub">Les comptes rendus, synthèses et constantes de cet appareil reviennent à l'état de départ.</p><div class="btns"><button type="button" class="btn sec" data-act="closeSheet">Annuler</button><button type="button" class="btn" data-act="reset">Réinitialiser</button></div>`,
    ),
  reset: () => {
    Store.resetLocal();
    U.pid = null;
    U.tab = 'dashboard';
    sheet('');
    render();
    toast('Démo réinitialisée.');
  },
  closeSheet: () => sheet(''),
  closeSheetBg: (_a, el, e) => {
    if (e.target === el) sheet('');
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
  if (el.dataset.act !== 'closeSheetBg') e.preventDefault();
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
  if (document.querySelector('details.menu[open]')) {
    for (const d of document.querySelectorAll('details.menu[open]')) d.open = false;
  } else if (document.getElementById('sheet').innerHTML) sheet('');
});

Voice.onSpeakingChange((s) => {
  U.speaking = s;
  if (U.tab === 'finale') render();
});
Store.onChange(softRender);
render();
AI.init().then(softRender);
Voice.init().then(softRender);
Store.init().then(softRender);
