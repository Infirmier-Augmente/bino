// Rendu des écrans (HTML en chaînes), d'après les maquettes papier de l'équipe :
// 1. Patients (Bonjour + date, liste) ; 2. Popup patient (dossier médical, compte rendu, Valider) ;
// 3. Transmissions (Mes CR / Tous, filtre par soignant). Aucune écriture ici : les actions sont dans app.js.
import { LV, news2 } from './news2.js';
import * as Store from './store.js';
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
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
};
export const ic = (n, s = 20) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

export const badge = (lv) =>
  `<span class="badge" style="background:${LV[lv].bg};color:${LV[lv].fg}">${LV[lv].l}</span>`;

export const V = (p) => Store.vitalsFor(p.id) || p.v;
export const sorted = (patients) =>
  [...patients].sort((a, b) => news2(V(b)).total - news2(V(a)).total);

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const firstName = (s) => (s || '').split(/[·,]/)[0].trim().split(/\s+/)[0] || '';
const initials = (s) =>
  (s || '')
    .split(/[·,]/)[0]
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase() || '?';

export const micBtn = (U, Voice, target) =>
  Voice.canDictate()
    ? `<button type="button" class="mic ${U.listening === target ? 'on' : ''}" data-act="mic" data-arg="${target}" aria-label="${U.listening === target ? 'Arrêter la dictée' : 'Dicter'}">${ic(U.listening === target ? 'stop' : 'mic', 24)}</button>`
    : '';

/* ---------- en-tête : Bonjour + date + profil (maquette 1) ---------- */
export function vHeader() {
  const name = Store.displayName();
  const date = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `<div class="hello">
    <div class="eyebrow"><img src="assets/logo.png" width="22" height="22" alt="">Bino · Chirurgie, poste de jour</div>
    <div class="hello-t">Bonjour ${esc(firstName(name))}</div>
    <div class="hello-d">${ic('cal', 16)} Date : ${date}</div>
  </div>
  <button type="button" class="avatar" data-act="settings" aria-label="Profil de ${esc(name)}">${esc(initials(name))}</button>`;
}

/* ---------- onglet 1 : patients ---------- */
export function vPatients(S, U) {
  const ps = sorted(S.patients);
  return `<div class="between list-head"><h2 class="list-t">Patients <span class="count">${ps.length}</span></h2><button type="button" class="btn sec sm" data-act="syncAll" ${U.syncing ? 'disabled' : ''}>${U.syncing ? '<span class="spin dark"></span>' : ic('sync', 16)} DPI</button></div>
  ${Store.isStale() ? '<p class="note">Les comptes rendus de l\'équipe ne sont pas encore joignables.</p>' : ''}
  ${ps
    .map((p) => {
      const n = news2(V(p));
      const k = Store.crFor(p.id).length;
      return `<button type="button" class="card prow" style="--bar:${LV[n.level].bar}" data-act="openPatient" data-arg="${p.id}">
        <span class="prow-main"><span class="prow-name">${esc(p.nom)}</span><span class="prow-sub">${k ? plural(k, 'compte rendu', 'comptes rendus') : 'Aucun compte rendu'} · NEWS2 ${n.total} ${LV[n.level].l.toLowerCase()}</span></span>
        <span class="room-chip">ch${esc(p.ch)}</span>
      </button>`;
    })
    .join('')}
  <p class="foot">Démo hackathon · données entièrement fictives.</p>`;
}

/* ---------- popup patient ---------- */
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
  return `<table class="vtable"><tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td class="v">${r[1]}</td><td class="p p${r[2]}">${r[2] ? `+${r[2]}` : '0'}</td></tr>`).join('')}<tr><td><b>Total NEWS2</b></td><td class="v">${badge(n.level)}</td><td class="p p${n.total >= 7 ? 3 : n.total >= 5 ? 2 : n.total ? 1 : 0}">${n.total}</td></tr></tbody></table>`;
}

const info = (k, v) => `<div class="info"><span>${k}</span><b>${esc(v)}</b></div>`;

export function vPatientPopup(S, U, Voice, EXAMPLES) {
  const p = S.patients.find((x) => x.id === U.pid);
  const v = V(p);
  const ex = EXAMPLES.find(
    (e) => e.pid === p.id && !Store.crFor(p.id).some((c) => c.text === e.text),
  );
  return `<div class="pp">
  <div class="pp-head"><div><h1 class="pp-name">${esc(p.nom)}</h1><div class="pp-sub">Chambre ${esc(p.ch)} · ${p.age} ans</div></div></div>

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

  <label class="sr" for="draft">Compte rendu</label>
  <textarea id="draft" class="draft cr-box" data-model="draft" placeholder="Compte rendu : ce que tu as vu et fait, comme à la relève.">${esc(U.draft)}</textarea>
  <div class="live" id="live" aria-live="polite"></div>
  <div class="pp-mic">${micBtn(U, Voice, 'draft')}<span class="small muted">${Voice.canDictate() ? 'Touche le micro et parle.' : 'Le micro du clavier marche aussi.'}</span></div>
  ${ex ? `<button type="button" class="chip ex" data-act="useEx" data-arg="${EXAMPLES.indexOf(ex)}">${ic('play', 14)} Exemple : ${esc(ex.label)}</button>` : ''}
  <button type="button" class="btn valider" data-act="saveCr" ${U.saving ? 'disabled' : ''}>${U.saving ? '<span class="spin"></span>' : ''} Valider</button>

  </div>`;
}

export const vDone = () =>
  `<div class="done-wrap" data-act="closeDone"><div class="done-card" role="dialog" aria-modal="true" aria-labelledby="done-t"><button type="button" class="icon-btn done-x" data-act="closeDone" aria-label="Fermer">${ic('x', 22)}</button><div class="done-check">${ic('check', 56)}</div><div class="done-t" id="done-t">Compte rendu fait</div></div></div>`;

/* ---------- onglet 2 : transmissions ---------- */
function crItem(c, withPatient, S) {
  const p = withPatient ? S.patients.find((x) => x.id === c.pid) : null;
  return `<div class="cr-item">
    <div class="between"><span class="cr-who">${p ? `${esc(p.nom)} <span class="room-chip sm">ch${esc(p.ch)}</span>` : esc(Store.authorOf(c))}</span><span class="small muted">${esc(c.t || '')}</span></div>
    ${p ? `<div class="cr-by small muted">${esc(Store.authorOf(c))}</div>` : ''}
    <p class="cr-text">${esc(c.text)}</p>
    ${Store.isMine(c) ? `<button type="button" class="linkbtn danger" data-act="delCr" data-arg="${esc(c.id)}">${ic('trash', 14)} Supprimer</button>` : ''}
  </div>`;
}

export function vTransmissions(S, U) {
  const all = [...Store.allCr()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const authors = [...new Set(all.map((c) => Store.authorOf(c)))];
  let list = all;
  if (U.trScope === 'mine') list = all.filter((c) => Store.isMine(c));
  else if (U.trWho) list = all.filter((c) => Store.authorOf(c) === U.trWho);
  const seg = (k, l) =>
    `<button type="button" class="seg-b ${U.trScope === k ? 'on' : ''}" data-act="trScope" data-arg="${k}" aria-pressed="${U.trScope === k}">${l}</button>`;
  return `<h1>Transmissions</h1>
  <div class="seg" role="group" aria-label="Quels comptes rendus">${seg('mine', 'Mes CR')}${seg('all', 'Tous')}</div>
  ${
    U.trScope === 'all' && authors.length > 1
      ? `<div class="chips who" role="group" aria-label="Filtrer par soignant"><button type="button" class="chip ${!U.trWho ? 'on' : ''}" data-act="trWho" data-arg="">Tout le monde</button>${authors.map((a) => `<button type="button" class="chip ${U.trWho === a ? 'on' : ''}" data-act="trWho" data-arg="${esc(a)}">${esc(a)}</button>`).join('')}</div>`
      : ''
  }
  ${
    U.trScope === 'all'
      ? `<div class="card doc-card"><div class="doc-card-t">${ic('file', 24)}<div><b>Document de transmission</b><div class="small muted">Tous les patients, à partir des comptes rendus de toute l'équipe</div></div></div>
    <button type="button" class="btn" data-act="genDoc" ${U.docBusy ? 'disabled' : ''}>${U.docBusy ? `<span class="spin"></span> ${esc(U.docBusy)}` : 'Générer le document'}</button></div>`
      : ''
  }
  <p class="sub">${U.trScope === 'mine' ? `${plural(list.length, 'compte rendu écrit', 'comptes rendus écrits')} par vous` : `${plural(list.length, 'compte rendu', 'comptes rendus')}${U.trWho ? ` de ${esc(U.trWho)}` : " de toute l'équipe"}`} · aujourd'hui</p>
  ${
    list.length
      ? `<div class="card cr-list">${list.map((c) => crItem(c, true, S)).join('')}</div>`
      : `<div class="card empty">${U.trScope === 'mine' ? "Tu n'as pas encore écrit de compte rendu. Touche un patient dans l'onglet Patients." : 'Aucun compte rendu pour ce filtre.'}</div>`
  }`;
}
