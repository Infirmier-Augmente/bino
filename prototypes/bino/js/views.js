// Rendu des écrans (HTML en chaînes), d'après les maquettes papier de l'équipe :
// 1. Patients (Bonjour + date, liste organisée par sévérité, auto par l'IA ou manuelle) ;
// 2. Fiche « Nouveau compte rendu » (dossier médical, import DPI, micro, Valider) ;
// 3. Transmissions (Mes CR / Tous en puces résumées). Aucune écriture ici : les actions sont dans app.js.
import { LV, news2 } from './news2.js';
import * as Store from './store.js';
import { LEVELS, rank } from './triage.js';
import { esc, num } from './util.js';

/* ---------- briques ---------- */
const I = {
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-4-5.6"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  chevr: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  sync: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13l2 2 4-4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  spark:
    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
};
export const ic = (n, s = 20) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

export const badge = (lv) =>
  `<span class="badge" style="background:${LV[lv].bg};color:${LV[lv].fg}">${LV[lv].l}</span>`;

export const V = (p) => Store.vitalsFor(p.id) || p.v;

// Priorité 1 (la plus urgente) à 4. Proposée par l'IA (repli NEWS2), modifiable à la main :
// le choix de l'infirmière prime toujours.
export const PRIO = { critique: 1, eleve: 2, moyen: 3, faible: 4 };
export const prioTag = (lv) => `Priorité ${PRIO[lv]}`;
export function levelOf(p) {
  const manual = Store.manualLevels()[p.id];
  if (manual) return manual;
  const ai = Store.prioAI()?.order?.find((x) => x.id === p.id);
  return ai?.niveau || news2(V(p)).level;
}
const aiPos = (p) => {
  const i = (Store.prioAI()?.order || []).findIndex((x) => x.id === p.id);
  return i < 0 ? 999 : i;
};
const byPrio = (a, b) =>
  rank(levelOf(a)) - rank(levelOf(b)) ||
  aiPos(a) - aiPos(b) ||
  news2(V(b)).total - news2(V(a)).total;
const lastName = (p) =>
  p.nom
    .replace(/^(M\.|Mme|Mlle)\s+/, '')
    .split(/\s+/)
    .slice(-1)[0];
export const SORTS = {
  prio: { l: 'Priorité', f: byPrio },
  chambre: { l: 'Chambre', f: (a, b) => Number(a.ch) - Number(b.ch) },
  nom: { l: 'Nom', f: (a, b) => lastName(a).localeCompare(lastName(b), 'fr') },
};
export const sorted = (patients, by = 'prio') => [...patients].sort((SORTS[by] || SORTS.prio).f);

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const firstName = (s) => (s || '').split(/[·,]/)[0].trim().split(/\s+/)[0] || '';

export function vLogin(error, matricule) {
  return `<div class="login">
    <img class="login-mark" src="assets/bino/presente-bust.png" width="104" height="126" alt="">
    <h1>Connexion</h1>
    <p class="sub">Entre ton matricule et ton mot de passe.</p>
    <div class="card login-card">
      <label class="l" for="login-id">Matricule</label>
      <input class="f" id="login-id" inputmode="numeric" autocomplete="username" value="${esc(matricule || '')}">
      <label class="l" for="login-pw">Mot de passe</label>
      <input class="f" id="login-pw" type="password" autocomplete="current-password">
      ${error ? `<p class="login-err" role="alert">${esc(error)}</p>` : ''}
      <button type="button" class="btn" data-act="login">Se connecter</button>
    </div>
    <p class="small muted login-hint">Démo · matricule 10482 · mot de passe bino</p>
  </div>`;
}

export function vLogged(name) {
  return `<div class="login logged">
    <img class="login-mark" src="assets/bino/pouce-bust.png" width="200" height="220" alt="">
    <h1>${esc(name)}</h1>
    <p class="sub">Connexion réussie</p>
    <button type="button" class="btn" data-act="enter">Continuer</button>
  </div>`;
}

export const micBtn = (U, target) =>
  `<button type="button" class="mic ${U.listening === target ? 'on' : ''}" data-act="mic" data-arg="${target}" aria-label="${U.listening === target ? 'Arrêter la dictée' : 'Dicter le compte rendu'}">${ic(U.listening === target ? 'stop' : 'mic', 28)}</button>`;

/* ---------- en-tête : logo + Bonjour + date (maquette 1), page Patients seulement ---------- */
export function vHeader() {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const who = esc(firstName(Store.displayName()));
  return `<div class="hello">
    <img class="hello-logo" src="assets/bino/salue-bust.png" width="52" height="52" alt="">
    <div><div class="hello-t">${who}</div><div class="hello-d">Date : ${date}</div></div>
    <button type="button" class="hello-out" data-act="logout">Déconnexion</button>
  </div>`;
}

/* ---------- onglet 1 : patients ---------- */
export const prioBtn = (p, sm = false) => {
  const lv = levelOf(p);
  return `<button type="button" class="lvl ${sm ? 'sm' : ''}" style="--c:${LV[lv].bg};--f:${LV[lv].fg}" data-act="pickLevel" data-arg="${p.id}" aria-label="${esc(p.nom)} : ${prioTag(lv)}. Changer la priorité">${prioTag(lv)} ${ic('chev', 14)}</button>`;
};

function reasonOf(p) {
  const ai = Store.prioAI();
  const r = ai?.order?.find((x) => x.id === p.id)?.raison || `NEWS2 ${news2(V(p)).total}`;
  return Store.manualLevels()[p.id] ? `${r} · priorité modifiée` : r;
}

export function vPatients(S, U) {
  const ps = sorted(S.patients, U.sortBy);
  return `<div class="list-head between"><h2 class="list-t">Patients <span class="count">${ps.length}</span></h2>
    <details class="menu sort-menu"><summary class="btn sec sm" role="button">Trier : ${SORTS[U.sortBy]?.l || 'Priorité'} ${ic('chev', 16)}</summary>
      <div class="menu-pop right">${Object.entries(SORTS)
        .map(
          ([k, o]) =>
            `<button type="button" data-act="sortBy" data-arg="${k}" aria-pressed="${U.sortBy === k}"><span><b>${o.l}</b></span>${U.sortBy === k ? ic('check', 18) : ''}</button>`,
        )
        .join('')}</div></details></div>
  ${Store.isStale() ? '<p class="note">Les comptes rendus de l\'équipe ne sont pas encore joignables.</p>' : ''}
  ${ps
    .map((p) => {
      const lv = levelOf(p);
      return `<div class="card prow" style="--bar:${LV[lv].bar}">
        <button type="button" class="prow-open" data-act="openPatient" data-arg="${p.id}"><span class="prow-main"><span class="prow-name">${esc(p.nom)}</span><span class="prow-sub">${esc(reasonOf(p))}</span></span><span class="room-chip">${esc(p.ch)}</span></button>
        ${prioBtn(p)}
      </div>`;
    })
    .join('')}`;
}

export function vLevelPicker(p) {
  const cur = levelOf(p);
  const manual = Store.manualLevels()[p.id];
  const ai = Store.prioAI()?.order?.find((x) => x.id === p.id);
  const hint = ['la plus urgente', 'à voir rapidement', 'à surveiller', 'stable'];
  return `<h1 style="margin-top:0">Priorité</h1><p class="sub">${esc(p.nom)} · ${esc(p.ch)} · NEWS2 ${news2(V(p)).total}</p>
  ${ai ? `<p class="small muted">Proposée ${Store.prioAI()?.engine === 'ai' ? "par l'IA" : 'selon le NEWS2'} : ${prioTag(ai.niveau)} · ${esc(ai.raison)}</p>` : ''}
  <div class="card level-list">${LEVELS.map((l, i) => `<button type="button" class="level-opt ${cur === l ? 'on' : ''}" data-act="setLevel" data-arg="${p.id}:${l}"><span class="lvl ro" style="--c:${LV[l].bg};--f:${LV[l].fg}">${prioTag(l)}</span><span class="small muted lo-hint">${hint[i]}</span>${cur === l ? ic('check', 18) : ''}</button>`).join('')}</div>
  ${manual ? `<button type="button" class="btn sec" data-act="setLevel" data-arg="${p.id}:">Revenir à la priorité proposée</button>` : ''}`;
}

/* ---------- fiche : nouveau compte rendu ---------- */
function vtable(v) {
  const n = news2(v);
  const rows = [
    ['Fréquence respiratoire', `${v.fr} /min`, n.p.fr],
    ['SpO2', `${v.spo2} %`, n.p.spo2],
    ['Oxygène', v.o2 ? 'Oui' : 'Air ambiant', n.p.o2],
    ['Tension artérielle', `${v.pas}/${v.pad} mmHg`, n.p.pas],
    ['Fréquence cardiaque', `${v.fc} /min`, n.p.fc],
    ['Température', `${num(v.temp)} °C`, n.p.temp],
    ['Conscience', v.cons === 'A' ? 'Alerte' : 'Altérée', n.p.cons],
  ];
  return `<table class="vtable"><tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td class="v">${r[1]}</td><td class="p p${r[2]}">${r[2] ? `+${r[2]}` : '0'}</td></tr>`).join('')}<tr><td><b>Total NEWS2</b></td><td></td><td class="p p${n.total >= 7 ? 3 : n.total >= 5 ? 2 : n.total ? 1 : 0}">${n.total}</td></tr></tbody></table>`;
}

const info = (k, v) => `<div class="info"><span>${k}</span><b>${esc(v)}</b></div>`;

export function vPatientPopup(S, U, EXAMPLES) {
  const p = S.patients.find((x) => x.id === U.pid);
  const v = V(p);
  const ex = EXAMPLES.find(
    (e) => e.pid === p.id && !Store.crFor(p.id).some((c) => c.text === e.text),
  );
  return `<div class="pp">
  <h1 class="pp-title">Nouveau compte rendu</h1>
  <div class="pp-name">${esc(p.nom)}</div>
  <div class="pp-sub">Chambre ${esc(p.ch)} · ${p.age} ans</div>

  <div class="pp-actions">
    <button type="button" class="pill ${U.foldOpen ? 'on' : ''}" data-act="toggleDossier" aria-expanded="${U.foldOpen}">${ic('folder', 18)} Dossier médical ${ic('chev', 16)}</button>
    <button type="button" class="pill" data-act="dpiImport" data-arg="${p.id}">${ic('dl', 18)} Import DPI</button>
  </div>
  ${
    U.foldOpen
      ? `<div class="dossier-body card">
      ${vtable(v)}
      <div class="small muted" style="margin-top:6px">Constantes de ${esc(v.at)}${v.src === 'DPI' ? ' · importées du DPI' : ''}</div>
      <button type="button" class="btn sec sm" data-act="editVitals" data-arg="${p.id}" style="margin:10px 0 6px">${ic('pen', 16)} Modifier les constantes</button>
      ${info('Motif', p.motif)}${info('Antécédents', p.atcd)}${info('Allergies', p.allergies)}
      ${p.precautions ? info('Précautions', p.precautions) : ''}
      ${p.disp.length ? info('Dispositifs', p.disp.map((d) => `${d.l} (J${d.j})`).join(', ')) : ''}
      ${p.rx ? info('Nouvelle prescription', `${p.rx.t} (${p.rx.at})`) : ''}
      ${p.famille ? info('Famille', p.famille) : ''}
    </div>`
      : ''
  }

  <div class="cr-zone">
    <label class="sr" for="draft">Compte rendu</label>
    <textarea id="draft" class="draft cr-box" data-model="draft" placeholder="Ce que tu as vu et fait, comme à la relève.">${esc(U.draft)}</textarea>
    <div class="live" id="live" aria-live="polite"></div>
    <div class="pp-mic">${micBtn(U, 'draft')}</div>
    ${ex ? `<div class="pp-ex"><button type="button" class="chip ex" data-act="useEx" data-arg="${EXAMPLES.indexOf(ex)}">${ic('play', 14)} Exemple : ${esc(ex.label)}</button></div>` : ''}
  </div>
  <div class="pp-foot"><button type="button" class="btn valider" data-act="saveCr" ${U.saving ? 'disabled' : ''}>${U.saving ? '<span class="spin"></span>' : ''} Valider</button></div>
  </div>`;
}

export const vDone = () =>
  `<div class="done-wrap" data-act="closeDone"><div class="done-card" role="dialog" aria-modal="true" aria-labelledby="done-t"><button type="button" class="icon-btn done-x" data-act="closeDone" aria-label="Fermer">${ic('x', 22)}</button><div class="done-check">${ic('check', 56)}</div><div class="done-t" id="done-t">Compte rendu fait</div></div></div>`;

/* ---------- onglet 2 : transmissions ---------- */
function crItem(c, S) {
  const p = S.patients.find((x) => x.id === c.pid);
  return `<div class="cr-item">
    <div class="between"><span class="cr-who">${esc(p?.nom || '')} <span class="room-chip sm">${esc(p?.ch || '')}</span></span><span class="small muted">${esc(c.t || '')}</span></div>
    <p class="cr-text">${esc(c.text)}</p>
    ${Store.isMine(c) ? `<button type="button" class="linkbtn danger" data-act="delCr" data-arg="${esc(c.id)}">${ic('trash', 14)} Supprimer</button>` : ''}
  </div>`;
}

function srcLine(field, crs) {
  if (!field?.src?.length) return '';
  const byId = new Map(crs.map((c) => [c.id, c]));
  const who = [
    ...new Set(
      field.src
        .map((s) => byId.get(s.cr))
        .filter(Boolean)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
        .map((c) => `${Store.authorOf(c).split(' ')[0]} ${c.t || ''}`.trim()),
    ),
  ];
  return who.length ? `<span class="pt-src">${esc(who.join(' · '))}</span>` : '';
}

// Une puce est datée par le plus ancien compte rendu qu'elle cite : on les affiche dans l'ordre de la journée.
function chrono(points, crs) {
  const at = new Map(crs.map((c) => [c.id, Date.parse(c.at)]));
  const t = (pt) => Math.min(...(pt.src || []).map((x) => at.get(x.cr) ?? Infinity));
  return [...points].sort((a, b) => t(a) - t(b));
}

function summaryCard(p) {
  const crs = Store.crFor(p.id);
  const lv = levelOf(p);
  const s = Store.synthFor(p.id);
  const fresh = s && !Store.needsSynth(s, crs);
  let body;
  if (!crs.length) body = '<p class="small muted">Aucun compte rendu aujourd\'hui.</p>';
  else if (!fresh)
    body = '<p class="small muted"><span class="spin dark"></span> Résumé en cours…</p>';
  else
    body = `<ul class="pts">${chrono(s.points || [], crs)
      .map((pt) => `<li>${esc(pt.t)} ${srcLine(pt, crs)}</li>`)
      .join('')}</ul>`;
  return `<div class="card sum" style="--bar:${LV[lv].bar}">
    <div class="between"><span class="cr-who">${esc(p.nom)} <span class="room-chip sm">${esc(p.ch)}</span></span>${prioBtn(p, true)}</div>
    ${body}
  </div>`;
}

export function vTransmissions(S, U) {
  const seg = (k, l) =>
    `<button type="button" class="seg-b ${U.trScope === k ? 'on' : ''}" data-act="trScope" data-arg="${k}" aria-pressed="${U.trScope === k}">${l}</button>`;
  const out = `<button type="button" class="hello-out" data-act="logout">Déconnexion</button>`;
  const head =
    `<div class="tr-top"><h1 class="tr-title">Transmissions</h1>${out}</div>` +
    `<div class="seg" role="group" aria-label="Quels comptes rendus">${seg('mine', 'Mes CR')}${seg('all', 'Tous')}</div>`;
  if (U.trScope === 'mine') {
    const mine = Store.allCr()
      .filter((c) => Store.isMine(c))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return `${head}<p class="sub">${plural(mine.length, 'compte rendu écrit', 'comptes rendus écrits')} par vous · aujourd'hui, dans l'ordre de la journée</p>
    ${mine.length ? `<div class="card cr-list">${mine.map((c) => crItem(c, S)).join('')}</div>` : '<div class="card empty">Pas encore de compte rendu. Touche un patient dans l\'onglet Patients.</div>'}`;
  }
  const ps = sorted(S.patients, 'prio');
  const engines = new Set(ps.map((p) => Store.synthFor(p.id)?.engine).filter(Boolean));
  return `${head}
  <div class="sum-head between"><span class="small muted">${U.sumBusy ? `Résumé par l'IA… ${esc(U.sumBusy)}` : `Résumé de l'équipe${engines.has('ai') ? " par l'IA" : engines.size ? ' · règles locales' : ''}`}</span>
  <button type="button" class="linkbtn" data-act="genDoc" ${U.docBusy ? 'disabled' : ''}>${ic('file', 14)} ${U.docBusy ? esc(U.docBusy) : 'Document complet'}</button></div>
  ${ps.map((p) => summaryCard(p)).join('')}
  <p class="foot">Puces dans l'ordre de la journée ; chacune vient d'un compte rendu (auteur et heure dessous). À relire avant la relève.</p>`;
}
