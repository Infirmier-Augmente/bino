// Rendu des écrans (HTML en chaînes). Aucune écriture ici : les actions sont dans app.js.
import { LV, news2 } from './news2.js';
import * as Store from './store.js';
import { esc, num } from './util.js';

/* ---------- briques ---------- */
const I = {
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark:
    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  sync: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
  send: '<path d="M4 12l16-8-6 16-2-6z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-4-5.6"/>',
};
export const ic = (n, s = 20) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

export const badge = (lv) =>
  `<span class="badge" style="background:${LV[lv].bg};color:${LV[lv].fg}">${LV[lv].l}</span>`;
export const bino = (size = 44) =>
  `<img class="mark" src="assets/logo.png" width="${size}" height="${size}" alt="" draggable="false">`;

export const V = (p) => Store.vitalsFor(p.id) || p.v;
export const sorted = (patients) =>
  [...patients].sort((a, b) => news2(V(b)).total - news2(V(a)).total);

function shortStay(motif) {
  return motif
    .replace('post-opératoire de ', '')
    .replace('totale de ', 'de ')
    .replace('inguinale', '')
    .replace(/\s+,/g, ',')
    .replace(/ {2,}/g, ' ')
    .trim();
}
function idGrid(p, n) {
  return `<div class="id-grid"><div class="id-copy"><div class="room">Chambre ${p.ch}</div><div class="pname">${esc(p.nom)}</div><div class="profile">${p.age} ans · ${esc(shortStay(p.motif))}</div></div><div class="score-col"><div class="ntag">NEWS2 ${n.total}</div>${badge(n.level)}</div></div>`;
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/* ---------- onglet 1 : dashboard ---------- */
export function vDashboard(S, U) {
  const ps = sorted(S.patients);
  const crit = ps.filter((p) => ['critique', 'eleve'].includes(news2(V(p)).level)).length;
  const loading = Store.isLoading();
  return `<div class="between"><h1>Patients</h1><button class="btn sec sm" data-act="syncAll" ${U.syncing ? 'disabled' : ''}>${U.syncing ? '<span class="spin dark"></span>' : ic('sync', 18)} DPI</button></div>
  <p class="sub">${plural(ps.length, 'patient', 'patients')} · ${crit ? `${crit} demande${crit > 1 ? 'nt' : ''} votre attention` : 'tout est calme'}${Store.storeMode() === 'shared' ? " · partagé avec l'équipe" : ''}</p>
  ${Store.isStale() ? '<p class="note">Les comptes rendus de l\'équipe ne sont pas encore joignables. Ce qui s\'affiche peut ne pas être à jour.</p>' : ''}
  ${ps
    .map((p) => {
      const n = news2(V(p));
      const k = Store.crFor(p.id).length;
      return `<button class="card pcard" style="--bar:${LV[n.level].bar}" data-act="openPatient" data-arg="${p.id}">${idGrid(p, n)}<div class="pmeta">${loading ? 'Chargement…' : k ? `${ic('pen', 14)} ${plural(k, 'compte rendu', 'comptes rendus')} aujourd'hui` : "Aucun compte rendu aujourd'hui"}</div></button>`;
    })
    .join('')}
  <p class="foot">Démo hackathon · données entièrement fictives · NEWS2 calculé automatiquement, l'infirmier a toujours le dernier mot.</p>`;
}

/* ---------- fiche patient ---------- */
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

function constantsMenu(pid) {
  return `<details class="menu"><summary class="btn sec sm" role="button">${ic('pulse', 18)} Constantes ${ic('chev', 16)}</summary>
  <div class="menu-pop">
    <button type="button" data-act="dpiImport" data-arg="${pid}"><span class="mi">${ic('dl', 18)}</span><span><b>Récupérer depuis le DPI</b><small>Dernières constantes du dossier patient (FHIR)</small></span></button>
    <button type="button" data-act="editVitals" data-arg="${pid}"><span class="mi">${ic('pen', 18)}</span><span><b>Saisie manuelle</b><small>Le NEWS2 se recalcule en direct</small></span></button>
  </div></details>`;
}

const info = (k, v) => `<div class="info"><span>${k}</span><b>${esc(v)}</b></div>`;

export const micBtn = (U, Voice, target, sm = false) =>
  Voice.canDictate()
    ? `<button type="button" class="mic ${sm ? 'sm' : ''} ${U.listening === target ? 'on' : ''}" data-act="mic" data-arg="${target}" aria-label="${U.listening === target ? 'Arrêter la dictée' : 'Dicter'}">${ic(U.listening === target ? 'stop' : 'mic', sm ? 18 : 22)}</button>`
    : '';

export function vPatient(S, U, Voice, EXAMPLES) {
  const p = S.patients.find((x) => x.id === U.pid);
  const v = V(p);
  const n = news2(v);
  const crs = [...Store.crFor(p.id)].reverse();
  const ex = EXAMPLES.find(
    (e) => e.pid === p.id && !Store.crFor(p.id).some((c) => c.text === e.text),
  );
  return `<button type="button" class="back" data-act="back">${ic('back', 18)} Patients</button>
  <div class="card pcard static" style="--bar:${LV[n.level].bar}">${idGrid(p, n)}</div>

  <details class="card fold" ${U.foldOpen ? 'open' : ''} data-fold>
    <summary><span class="fold-t">Données du patient</span><span class="fold-s">NEWS2 ${n.total} · ${v.at}${v.src === 'DPI' ? ' · DPI' : ''}${p.allergies !== 'Aucune connue' ? ` · Allergie ${esc(p.allergies)}` : ''}</span>${ic('chev', 18)}</summary>
    <div class="fold-body">
      ${vtable(v)}
      <div class="row" style="margin:10px 0 4px">${constantsMenu(p.id)}</div>
      ${info('Motif', p.motif)}${info('Antécédents', p.atcd)}${info('Allergies', p.allergies)}
      ${p.precautions ? info('Précautions', p.precautions) : ''}
      ${p.disp.length ? info('Dispositifs', p.disp.map((d) => `${d.l} (J${d.j})`).join(', ')) : ''}
      ${p.rx ? info('Nouvelle prescription', `${p.rx.t} (${p.rx.at})`) : ''}
      ${p.famille ? info('Famille', p.famille) : ''}
    </div>
  </details>

  <div class="card">
    <label class="l" for="draft">Compte rendu</label>
    <textarea id="draft" class="draft" data-model="draft" placeholder="Ce que tu as vu et fait, comme tu le dirais à la relève : « douleur à 6 sur 10, paracétamol donné à 17h… »">${esc(U.draft)}</textarea>
    <div class="live" id="live" aria-live="polite"></div>
    <div class="row cr-actions">
      ${micBtn(U, Voice, 'draft')}
      <button type="button" class="btn" data-act="saveCr" ${U.saving ? 'disabled' : ''}>${U.saving ? '<span class="spin"></span>' : ic('send', 18)} Enregistrer</button>
    </div>
    <p class="small muted sig">${Voice.canDictate() ? 'Micro ou clavier. ' : 'Astuce : le micro du clavier marche aussi. '}Signé : <b>${esc(Store.storeMode() === 'shared' ? 'votre compte Claude' : Store.myName() || 'prénom à renseigner')}</b>${Store.storeMode() === 'local' ? ` · <button type="button" class="linkbtn" data-act="settings">changer</button>` : ''}</p>
    ${ex ? `<button type="button" class="chip" data-act="useEx" data-arg="${EXAMPLES.indexOf(ex)}">${ic('play', 14)} Exemple : ${esc(ex.label)}</button>` : ''}
  </div>

  <h2>Comptes rendus du jour <span class="count">${crs.length}</span></h2>
  ${crs.length ? crs.map((c) => crCard(c)).join('') : '<p class="small muted">Personne n\'a encore écrit pour ce patient aujourd\'hui.</p>'}
  <button type="button" class="btn sec" data-act="tab" data-arg="finale" style="margin-top:6px">${ic('doc', 18)} Voir la transmission finale</button>`;
}

function crCard(c) {
  return `<div class="card cr"><div class="between"><span class="cr-by">${esc(Store.authorOf(c))}</span><span class="row" style="gap:4px"><span class="small muted">${esc(c.t || '')}</span>${Store.isMine(c) ? `<button type="button" class="icon-btn sm" data-act="delCr" data-arg="${esc(c.id)}" aria-label="Supprimer ce compte rendu">${ic('trash', 16)}</button>` : ''}</span></div><p class="cr-text">${esc(c.text)}</p></div>`;
}

/* ---------- onglet 2 : transmission finale ---------- */
function srcList(field, crs) {
  if (!field?.src?.length) return '';
  const byId = new Map(crs.map((c) => [c.id, c]));
  const items = field.src
    .map((s) => {
      const c = byId.get(s.cr);
      return c
        ? `<li>« ${esc(s.q)} » <span class="muted">· ${esc(Store.authorOf(c))}, ${esc(c.t || '')}</span></li>`
        : '';
    })
    .join('');
  return `<details class="src"><summary>Sources ›</summary><ul>${items}</ul></details>`;
}

function darRow(k, f, crs) {
  const lab = { D: 'Données', A: 'Actions', R: 'Résultats' }[k];
  if (f)
    return `<div class="dar-row"><div class="dar-l">${k}</div><div class="dar-c"><div class="dar-k">${lab}</div><div class="dar-t">${esc(f.t)}</div>${srcList(f, crs)}</div></div>`;
  if (k === 'R')
    return `<div class="dar-row"><div class="dar-l warn">R</div><div class="dar-c"><div class="miss"><div class="k">Résultat non renseigné : quelle réévaluation ?</div></div></div></div>`;
  return '';
}

function synthCard(p, crs) {
  const n = news2(V(p));
  const s = Store.synthFor(p.id);
  const fresh = s ? crs.filter((c) => !(s.crIds || []).includes(c.id)).length : 0;
  const gone = s ? (s.crIds || []).filter((id) => !crs.some((c) => c.id === id)).length : 0;
  const authors = [...new Set(crs.map((c) => Store.authorOf(c)))];
  const head = `${idGrid(p, n)}<div class="pmeta">${ic('users', 14)} ${crs.length ? `${plural(crs.length, 'compte rendu', 'comptes rendus')} · ${esc(authors.join(', '))}` : "Aucun compte rendu aujourd'hui"}</div>`;
  if (!crs.length)
    return `<div class="card pcard static" style="--bar:${LV[n.level].bar}">${head}</div>`;
  if (!s)
    return `<div class="card pcard static" style="--bar:${LV[n.level].bar}">${head}<button type="button" class="btn sm syn-btn" data-act="synth" data-arg="${p.id}">${ic('spark', 16)} Synthétiser</button></div>`;
  const validated = s.validatedAt
    ? `<span class="ok-tag">${ic('check', 14)} Validée par ${esc(s.validatedBy ? Store.personLabel(s.validatedBy) || 'un soignant' : s.validatedName || 'un soignant')} à ${esc(s.validatedT || '')}</span>`
    : `<button type="button" class="btn sm" data-act="validateSynth" data-arg="${p.id}">${ic('check', 16)} Valider</button>`;
  return `<div class="card pcard static" style="--bar:${LV[n.level].bar}">${head}
    ${s.resume ? `<div class="resume"><b>À retenir</b> ${esc(s.resume.t)}${srcList(s.resume, crs)}</div>` : ''}
    ${s.cibles.map((c) => `<div class="syn-cible"><div class="target-title">${esc(c.c)}</div>${darRow('D', c.D, crs)}${darRow('A', c.A, crs)}${c.A || c.R ? darRow('R', c.R, crs) : ''}</div>`).join('')}
    ${s.todo.length ? `<div class="syn-list"><div class="dar-k">À faire</div>${s.todo.map((t) => `<div class="row li">${ic('clock', 16)}<span>${esc(t.t)}</span></div>`).join('')}</div>` : ''}
    ${s.soins.length ? `<div class="syn-list"><div class="dar-k">Soins faits</div>${s.soins.map((t) => `<div class="row li">${ic('check', 16)}<span>${esc(t.t)}</span></div>`).join('')}</div>` : ''}
    <div class="syn-foot"><span class="small muted">Synthèse de ${esc(s.t || '')} · ${s.engine === 'ai' ? 'IA' : 'règles locales'}${fresh ? ` · <b class="warn-t">${plural(fresh, 'nouveau compte rendu', 'nouveaux comptes rendus')}</b>` : ''}${gone ? ` · <b class="warn-t">${plural(gone, 'compte rendu supprimé', 'comptes rendus supprimés')}</b>` : ''}</span>
    <span class="row" style="gap:8px">${fresh || gone ? `<button type="button" class="btn sec sm" data-act="synth" data-arg="${p.id}">${ic('sync', 16)} Mettre à jour</button>` : ''}${validated}</span></div>
  </div>`;
}

export function vFinale(S, U, Voice) {
  const ps = sorted(S.patients);
  const all = Store.allCr();
  const authors = new Set(all.map((c) => Store.authorOf(c)));
  const pending = ps.filter((p) => {
    const crs = Store.crFor(p.id);
    const s = Store.synthFor(p.id);
    return crs.length && Store.needsSynth(s, crs);
  }).length;
  return `<h1>Transmission finale</h1><p class="sub">Ce que toute l'équipe a fait, patient par patient · relève de 19h45</p>
  <div class="card bino-card">${bino(40)}<div style="flex:1"><div class="t">${plural(all.length, 'compte rendu', 'comptes rendus')} · ${plural(authors.size, 'soignant', 'soignants')}</div><div class="small muted">${pending ? `${plural(pending, 'patient à synthétiser', 'patients à synthétiser')}` : 'Toutes les synthèses sont à jour'}</div></div>
  ${Voice.canSpeak() ? `<button type="button" class="btn sm navy" data-act="speak">${ic(U.speaking ? 'stop' : 'play', 16)} ${U.speaking ? 'Stop' : 'Écouter'}</button>` : ''}</div>
  <div class="btns" style="margin-bottom:12px"><button type="button" class="btn" data-act="synthAll" ${U.synthBusy || !pending ? 'disabled' : ''}>${U.synthBusy ? '<span class="spin"></span> Synthèse en cours…' : `${ic('spark', 18)} Tout synthétiser`}</button><button type="button" class="btn sec" data-act="copyAll">${ic('copy', 18)} Copier</button></div>
  ${ps.map((p) => synthCard(p, Store.crFor(p.id))).join('')}
  <p class="foot">Chaque phrase renvoie au compte rendu d'origine. Rien n'est inventé : ce qui n'a pas été dit reste une question.</p>`;
}
