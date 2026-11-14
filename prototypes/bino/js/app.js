// Bino — le binôme des infirmiers. Démo hackathon IA santé (Hôpital Foch), données fictives.

import { EXAMPLES, seed } from './data.js';
import { LV, news2 } from './news2.js';
import * as AI from './services/ai.js';
import * as FHIR from './services/fhir.js';
import * as Voice from './services/voice.js';
import { DEFAULT_FHIR, DEFAULT_MODEL, saveSettings, settings } from './settings.js';
import {
  extractVitals,
  localAnswer,
  localStructure,
  normalize,
  qaPrompt,
  serviceSummary,
  structurePrompt,
} from './structure.js';
import { esc, fmtVital, hhmm, num, VITAL_KEYS, VITAL_LABELS, vitLine } from './util.js';

const STORE = 'bino-demo-v4';
let S;
try {
  S = JSON.parse(localStorage.getItem(STORE));
} catch (_e) {
  S = null;
}
if (!S?.patients) S = seed();
const save = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(S));
  } catch (_e) {
    /* ignore */
  }
};
const U = {
  tab: 'patients',
  txPid: 'p12',
  draft: '',
  live: '',
  busy: false,
  result: null,
  resultSrc: '',
  qa: null,
  qaQ: '',
  qaBusy: false,
  listening: null,
  speaking: false,
  syncing: false,
};

/* Le logo est l'illustration finale (PNG). Un SVG redessiné à 36 px devenait flou. */
export function bino(_mood, size = 44) {
  return `<img class="mark" src="assets/logo.png" width="${size}" height="${size}" alt="" draggable="false">`;
}

/* ---------- icônes ---------- */
const I = {
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="M10 7.5l5 7"/>',
  tube: '<path d="M9 3h6M10 3v13a2 2 0 0 0 4 0V3"/><path d="M10 10h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  phone:
    '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  spark:
    '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  send: '<path d="M4 12l16-8-6 16-2-6z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sync: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
};
const ic = (n, s = 20) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

/* ---------- helpers métier ---------- */
const P = (id) => S.patients.find((p) => p.id === id);
const sorted = () => [...S.patients].sort((a, b) => news2(b.v).total - news2(a.v).total);
const badge = (lv) =>
  `<span class="badge" style="background:${LV[lv].bg};color:${LV[lv].fg}">${LV[lv].l}</span>`;
const srcTag = (v) => (v.src === 'DPI' ? `<span class="src-tag">${ic('dl', 12)} DPI</span>` : '');

function alerts() {
  const a = [];
  sorted().forEach((p) => {
    const n = news2(p.v);
    if (n.level === 'critique' || n.level === 'eleve')
      a.push({
        id: `news-${p.id}-${n.total}-${p.v.at}`,
        kind: 'news',
        pid: p.id,
        lv: n.level,
        title: `Ch. ${p.ch} · ${p.nom} · NEWS2 ${n.total}`,
        sub:
          n.level === 'critique'
            ? 'Détérioration des constantes : avis médical recommandé'
            : 'Score élevé : surveillance rapprochée',
        ord: n.level === 'critique' ? 0 : 2,
      });
    if (p.rx)
      a.push({
        id: `rx-${p.id}-${p.rx.at}`,
        kind: 'rx',
        pid: p.id,
        title: `Ch. ${p.ch} · nouvelle prescription`,
        sub: `${p.rx.t} (${p.rx.at})`,
        ord: 1,
      });
    p.disp.forEach((d, i) => {
      if (d.j >= 4)
        a.push({
          id: `disp-${p.id}-${i}-${d.j}`,
          kind: 'disp',
          pid: p.id,
          di: i,
          title: `Ch. ${p.ch} · ${d.l} à J${d.j}`,
          sub: 'Durée de pose à réévaluer avec le médecin',
          ord: 4,
        });
    });
  });
  S.trans.forEach((t) => {
    t.cibles.forEach((c, i) => {
      if (!c.R) {
        const p = P(t.pid);
        a.push({
          id: `r-${t.id}-${i}`,
          kind: 'r',
          pid: t.pid,
          tid: t.id,
          ci: i,
          title: `Ch. ${p.ch} · résultat non réévalué`,
          sub: `Cible « ${c.c} » tracée à ${t.at}`,
          ord: 3,
        });
      }
    });
  });
  return a.sort((x, y) => x.ord - y.ord);
}
const openCount = () => alerts().filter((a) => !S.ack[a.id]).length;

/* ---------- rendu principal ---------- */
function render() {
  const app = document.getElementById('app');
  app.innerHTML = { patients: vPatients, transmission: vTrans, releve: vReleve, alertes: vAlertes }[
    U.tab
  ]();
  const n = openCount();
  const tabs = [
    ['patients', 'Patients', 'list'],
    ['transmission', 'Transmission', 'mic'],
    ['releve', 'Relève', 'doc'],
    ['alertes', 'Alertes', 'bell'],
  ];
  document.getElementById('tabs').innerHTML = tabs
    .map(
      ([k, l, i]) =>
        `<button class="${U.tab === k ? 'on' : ''}" data-act="tab" data-arg="${k}" ${U.tab === k ? 'aria-current="page"' : ''}>${ic(i, 22)}<span>${l}</span>${k === 'alertes' && n ? `<span class="dot" aria-label="${n} alertes">${n}</span>` : ''}</button>`,
    )
    .join('');
}

function modeChip() {
  const m = AI.mode();
  const on = m === 'claude' || m === 'api';
  const txt =
    m === 'claude'
      ? 'IA : Claude'
      : m === 'api'
        ? 'IA : clé API'
        : 'IA désactivée · règles locales';
  return `<button class="mode" data-act="settings"><i class="${on ? 'on' : ''}"></i>${txt}</button>`;
}

/* Libellé court pour la carte seulement. Le motif complet reste sur p.motif (fiche). */
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
  return `<div class="id-grid"><div class="id-copy"><div class="room">Chambre ${p.ch}</div><div class="pname">${esc(p.nom)}</div><div class="profile">${p.age} ans · ${esc(shortStay(p.motif))}</div></div><div class="score-col">${badge(n.level)}</div></div>`;
}

function handoverSentence(p) {
  const last = [...S.trans].reverse().find((t) => t.pid === p.id);
  if (!last) return "Pas de transmission ciblée aujourd'hui.";
  const bits = last.cibles.map((c) => {
    const d = c.D.replace(/\.\s*$/, '');
    return c.R
      ? `${c.c} : ${d}. ${c.R.replace(/\.\s*$/, '')}.`
      : `${c.c} : ${d}. Résultat à réévaluer.`;
  });
  return `${last.at} · ${bits.join(' ')}`;
}

function vPatients() {
  const ps = sorted();
  const crit = ps.filter((p) => ['critique', 'eleve'].includes(news2(p.v).level)).length;
  const attention = crit
    ? `${crit} demande${crit > 1 ? 'nt' : ''} votre attention`
    : 'tout est calme';
  return `<div class="between"><h1>Patients</h1><button class="btn sec sm" data-act="syncAll" ${U.syncing ? 'disabled' : ''}>${U.syncing ? '<span class="spin" style="border-color:rgba(0,34,68,.2);border-top-color:#002244"></span>' : ic('sync', 18)} DPI</button></div>
  <p class="sub">Priorisation · ${ps.length} patients · ${attention}</p>
  ${ps
    .map((p) => {
      const n = news2(p.v);
      return `<button class="card pcard" style="--bar:${LV[n.level].bar}" data-act="openPatient" data-arg="${p.id}">${idGrid(p, n)}</button>`;
    })
    .join('')}
  <p class="foot">Démo hackathon · données entièrement fictives · NEWS2 calculé automatiquement, l'infirmier a toujours le dernier mot.</p>`;
}

const micBtn = (target, label, sm = true) =>
  Voice.canDictate()
    ? `<button class="mic ${sm ? 'sm' : ''} ${U.listening === target ? 'on' : ''}" data-act="mic" data-arg="${target}" aria-label="${U.listening === target ? 'Arrêter la dictée' : label}">${ic(U.listening === target ? 'stop' : 'mic', sm ? 18 : 22)}</button>`
    : '';

function vTrans() {
  const p = P(U.txPid);
  const exs = EXAMPLES.filter((e) => e.pid === U.txPid);
  const h = `<h1>Transmission</h1><p class="sub">Dictée structurée en transmissions ciblées (DAR)</p>
  <div class="chips" role="group" aria-label="Patient" style="margin-bottom:12px">${sorted()
    .map(
      (q) =>
        `<button class="chip ${q.id === U.txPid ? 'on' : ''}" data-act="txPid" data-arg="${q.id}">Ch. ${q.ch} · ${esc(q.nom)}</button>`,
    )
    .join('')}</div>`;
  if (U.result) return h + vResult(p);
  return (
    h +
    `<div class="card bino-card">${bino(U.listening === 'draft' || U.busy ? 'concentre' : 'neutre', 52)}<div style="flex:1"><div class="t">${U.listening === 'draft' ? 'Je vous écoute…' : U.busy ? 'Je structure votre dictée…' : `Ch. ${p.ch} · ${esc(p.nom)}`}</div><div class="small muted">${U.busy ? 'Rien ne sera versé au dossier sans votre validation.' : esc(p.motif)}</div><div style="margin-top:6px">${modeChip()}</div></div></div>
  <div class="card">
    <label class="l" for="draft">Ce que vous dites, comme à la relève</label>
    <textarea id="draft" class="draft" data-model="draft" placeholder="Ex. : « Chambre 12, elle est plus essoufflée, sat 94, j'ai appelé l'interne… »">${esc(U.draft)}</textarea>
    <div class="live" id="live" aria-live="polite">${esc(U.live)}</div>
    <div class="row" style="margin-top:6px">${micBtn('draft', 'Dicter', false)}
      <div class="small muted" style="flex:1">${Voice.canDictate() ? 'Touchez le micro et parlez naturellement : abréviations, chiffres, langage oral.' : 'Astuce : utilisez le micro de votre clavier pour dicter.'}</div></div>
  </div>
  ${exs.length ? `<div class="small muted" style="margin:0 0 8px">Ou testez avec une dictée d'exemple :</div><div class="chips" style="margin-bottom:14px">${exs.map((e) => `<button class="chip" data-act="useEx" data-arg="${EXAMPLES.indexOf(e)}">${ic('play', 14)} ${esc(e.label)}</button>`).join('')}</div>` : '<p class="small muted" style="margin:0 0 14px">Exemples prêts pour les chambres 12 et 8.</p>'}
  <div class="dock"><button class="btn" data-act="structure" ${U.busy ? 'disabled' : ''}>${U.busy ? '<span class="spin"></span> Structuration…' : `${ic('spark')} Structurer avec Bino`}</button></div>`
  );
}

const srcHtml = (s) =>
  s ? `<details class="src"><summary>Entendu ›</summary><p>« ${esc(s)} »</p></details>` : '';

function vResult(p) {
  const r = U.result;
  const nv = r.v && Object.keys(r.v).length ? { ...p.v, ...r.v } : null;
  const n0 = news2(p.v),
    n1 = nv ? news2(nv) : null;
  const miss = r.cibles.filter((c) => !c.R).length;
  const lab = { D: 'Données', A: 'Actions', R: 'Résultats' };
  return `<div class="card bino-card">${bino(miss ? 'clin' : 'content', 52)}<div><div class="t">${r.cibles.length} cible${r.cibles.length > 1 ? 's' : ''} · ${miss ? `${miss} résultat${miss > 1 ? 's' : ''} à compléter` : 'transmission complète'}</div><div class="small muted">${U.resultSrc === 'ai' ? 'Proposé par Bino à partir de votre dictée.' : U.resultSrc === 'ex' ? 'Exemple de démo.' : 'Règles locales (sans IA) : vérifiez le classement.'} Touchez un texte pour le corriger.</div></div></div>
  ${r.cibles
    .map(
      (c, i) => `<div class="card">
    <div class="between" style="margin-bottom:4px"><div class="ed target-title" contenteditable="true" id="c-${i}-c" aria-label="Intitulé de la cible">${esc(c.c)}</div><span class="badge" style="background:var(--sky-l);color:var(--navy)">Cible</span></div>
    ${['D', 'A', 'R']
      .map((k) => {
        if (c[k])
          return `<div class="dar-row"><div class="dar-l">${k}</div><div class="dar-c"><div class="dar-k">${lab[k]}</div><div class="ed" contenteditable="true" id="c-${i}-${k}" aria-label="${lab[k]}">${esc(c[k])}</div>${srcHtml(c[`s${k}`])}</div></div>`;
        if (k === 'R')
          return `<div class="dar-row"><div class="dar-l" style="background:var(--warn)">R</div><div class="dar-c"><div class="miss"><div class="k">Non dit : réévaluation à compléter</div><div class="small" style="color:var(--warn);margin:2px 0 8px">Bino ne l'invente pas. Complétez maintenant ou plus tard : une relance apparaîtra dans Alertes.</div>
        <div class="row"><input class="f" id="c-${i}-R" placeholder="Ex. : douleur à 2/10 à 18h" aria-label="Résultat">${micBtn(`c-${i}-R`, 'Dicter le résultat')}</div></div></div></div>`;
        return `<div class="dar-row"><div class="dar-l" style="background:#9AA5B1">${k}</div><div class="dar-c"><div class="dar-k">${lab[k]}</div><div class="ed muted" contenteditable="true" id="c-${i}-${k}" aria-label="${lab[k]}"></div></div></div>`;
      })
      .join('')}
  </div>`,
    )
    .join('')}
  ${r.diag.length ? `<div class="card"><div class="dar-k" style="margin-bottom:6px">Diagramme de soins · sans cible</div>${r.diag.map((d) => `<div class="row" style="align-items:flex-start;padding:4px 0">${ic('check', 18)}<div style="flex:1"><div style="font-size:15px">${esc(d.t)}</div>${srcHtml(d.s)}</div></div>`).join('')}</div>` : ''}
  ${r.todo.length ? `<div class="card"><div class="dar-k" style="margin-bottom:6px">Ajouté à faire pour la relève</div>${r.todo.map((d) => `<div class="row" style="padding:4px 0">${ic('clock', 18)}<div style="font-size:15px">${esc(d.t)}</div></div>`).join('')}</div>` : ''}
  ${nv ? `<div class="card"><div class="dar-k" style="margin-bottom:6px">Constantes repérées</div><div style="font-size:14px">${vitLine(nv)}</div><div class="row" style="margin-top:8px"><span class="small muted">NEWS2</span> <b>${n0.total} → ${n1.total}</b> ${badge(n1.level)}</div></div>` : ''}
  <div class="btns" style="margin-top:4px"><button class="btn sec" data-act="discard">Recommencer</button><button class="btn" data-act="validate">Valider</button></div>
  <p class="foot">En validant, vous signez ce qui est versé au dossier de soins (simulé ici).</p>`;
}

function line(icn, txt, go) {
  const col =
    icn === 'warn' ? 'var(--warn)' : icn === 'check' ? 'var(--news-faible)' : 'var(--navy)';
  return `<div class="row" style="padding:6px 0;font-size:14px"><span style="color:${col}">${ic(icn, 18)}</span><span style="flex:1">${txt}</span>${go ? `<button class="chip" data-act="tab" data-arg="${go}">Voir</button>` : ''}</div>`;
}

function vReleve() {
  const ps = sorted();
  const lv = ps.map((p) => news2(p.v).level);
  const c = lv.filter((l) => l === 'critique').length,
    w = lv.filter((l) => l === 'eleve' || l === 'moyen').length,
    s = lv.filter((l) => l === 'faible').length;
  const pr = alerts().filter((a) => a.kind === 'r');
  const rx = ps.filter((p) => p.rx && !S.ack[`rx-${p.id}-${p.rx.at}`]);
  const open = ps.reduce((a, p) => a + p.taches.filter((t) => !t.done).length, 0);
  return `<h1>Relève</h1><p class="sub">Synthèse de fin de service · relève de 19h45</p>
  <div class="card bino-card">${bino('content', 52)}<div style="flex:1"><div class="t">${ps.length} patients</div><div class="small muted">Synthèse prête pour l'équipe de nuit</div></div>
  ${Voice.canSpeak() ? `<button class="btn sm navy" data-act="speak">${ic(U.speaking ? 'stop' : 'play', 16)} ${U.speaking ? 'Stop' : 'Écouter'}</button>` : ''}</div>
  <div class="counters"><div class="counter"><b class="lv-critique">${c}</b><span>Critique</span></div><div class="counter"><b class="lv-moyen">${w}</b><span>À surveiller</span></div><div class="counter"><b class="lv-faible">${s}</b><span>Stables</span></div></div>
  <div class="card"><div class="dar-k" style="margin-bottom:6px">Avant de transmettre</div>
    ${line(pr.length ? 'warn' : 'check', pr.length ? `${pr.length} résultat${pr.length > 1 ? 's' : ''} non réévalué${pr.length > 1 ? 's' : ''}` : 'Toutes les cibles ont un résultat', pr.length ? 'alertes' : null)}
    ${line(rx.length ? 'warn' : 'check', rx.length ? `${rx.length} nouvelle${rx.length > 1 ? 's' : ''} prescription${rx.length > 1 ? 's' : ''} non vue${rx.length > 1 ? 's' : ''}` : 'Nouvelles prescriptions vues', rx.length ? 'alertes' : null)}
    ${line('check', `Allergies renseignées pour ${ps.filter((p) => p.allergies).length}/${ps.length} patients`)}
    ${line(open ? 'clock' : 'check', `${open} tâche${open > 1 ? 's' : ''} à transmettre`)}
  </div>
  <h2>Points clés, par priorité</h2>
  ${ps
    .map((p) => {
      const n = news2(p.v);
      const said = handoverSentence(p);
      const quiet = !S.trans.some((t) => t.pid === p.id);
      return `<div class="card h-card" style="--bar:${LV[n.level].bar}">
      ${idGrid(p, n)}
      <p class="handover${quiet ? ' muted' : ''}">${esc(said)}</p>
    </div>`;
    })
    .join('')}
  <h2>Une question sur la relève ?</h2>
  <div class="card"><div class="row"><input class="f" id="qa" placeholder="Ex. : qui dois-je voir en premier ?" aria-label="Question à Bino" value="${esc(U.qaQ)}">${micBtn('qa', 'Dicter la question')}<button class="btn sm" data-act="ask" aria-label="Envoyer" ${U.qaBusy ? 'disabled' : ''}>${U.qaBusy ? '<span class="spin"></span>' : ic('send', 18)}</button></div>
    <div class="chips" style="margin-top:10px">${['Qui voir en premier ?', 'Quelles allergies ?', "Qu'est-ce qui reste à faire cette nuit ?"].map((q) => `<button class="chip" data-act="askQ" data-arg="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    ${U.qa ? `<div class="row" style="align-items:flex-start;margin-top:12px">${bino('neutre', 36)}<div class="answer" style="flex:1">${esc(U.qa)}</div></div>` : ''}
  </div>
  <h2>Addendum après la relève</h2>
  <div class="card"><div class="small muted" style="margin-bottom:8px">Un changement après 19h45 ? Il est poussé à l'équipe de nuit sans refaire la relève.</div>
    ${S.addenda.map((a) => `<div class="row" style="align-items:flex-start;padding:6px 0;border-top:1px solid #EEF1F4">${ic('plus', 16)}<div style="flex:1;font-size:14px"><b>${a.at}</b> · ${esc(a.t)}</div></div>`).join('')}
    <div class="row" style="margin-top:6px"><input class="f" id="add" placeholder="Ex. : Ch. 15, T 38,7 °C à 20h, hémocultures faites" aria-label="Addendum"><button class="btn sm navy" data-act="addendum">Ajouter</button></div>
  </div>`;
}

function vAlertes() {
  const all = alerts();
  const op = all.filter((a) => !S.ack[a.id]);
  const done = all.filter((a) => S.ack[a.id]);
  const icon = (a) =>
    a.kind === 'news'
      ? ['warn', LV[a.lv].bg, '#fff']
      : a.kind === 'rx'
        ? ['pill', '#E6F4FD', '#002244']
        : a.kind === 'r'
          ? ['clock', '#FDF1E3', '#9A4A06']
          : ['tube', '#EDF0F3', '#002244'];
  const card = (a) => {
    const [n, bg, fg] = icon(a);
    return `<button class="card pcard" style="border-left:0;display:flex;gap:12px;align-items:center" data-act="openAlert" data-arg="${a.id}"><span class="alert-i" style="background:${bg};color:${fg}">${ic(n, 20)}</span><span style="flex:1"><span style="display:block;font-weight:700;font-size:15px">${esc(a.title)}</span><span class="small muted" style="display:block">${esc(a.sub)}</span></span>${a.kind === 'news' ? badge(a.lv) : ''}</button>`;
  };
  return `<h1>Alertes</h1><p class="sub">Détérioration, prescriptions, relances de réévaluation</p>
  ${op.length ? op.map(card).join('') : `<div class="card bino-card">${bino('content', 52)}<div class="t">Aucune alerte en attente</div></div>`}
  ${done.length ? `<h2>Traitées</h2>${done.map((a) => `<div class="card small muted row">${ic('check', 16)} ${esc(a.title)}</div>`).join('')}` : ''}`;
}

/* ---------- feuilles ---------- */
let lastFocus = null;
function sheet(html) {
  const el = document.getElementById('sheet');
  if (!html) {
    el.innerHTML = '';
    if (lastFocus?.focus) lastFocus.focus();
    return;
  }
  if (!el.innerHTML) lastFocus = document.activeElement;
  el.innerHTML = `<div class="sheet-wrap" data-act="closeSheetBg"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><div class="between"><span></span><button class="icon-btn" data-act="closeSheet" aria-label="Fermer">${ic('x', 22)}</button></div>${html}</div></div>`;
  const first = el.querySelector('h1');
  if (first) {
    first.setAttribute('tabindex', '-1');
    first.focus({ preventScroll: true });
  }
}

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

// Le bouton déroulant « Constantes » : DPI, saisie manuelle, dictée.
function constantsMenu(pid, label = 'Constantes') {
  return `<details class="menu"><summary class="btn sec sm" role="button">${ic('pulse', 18)} ${label} ${ic('chev', 16)}</summary>
  <div class="menu-pop">
    <button data-act="dpiImport" data-arg="${pid}"><span class="mi">${ic('dl', 18)}</span><span><b>Récupérer depuis le DPI</b><small>Dernières constantes du dossier patient (FHIR)</small></span></button>
    <button data-act="editVitals" data-arg="${pid}"><span class="mi">${ic('pen', 18)}</span><span><b>Saisie manuelle</b><small>Le NEWS2 se recalcule en direct</small></span></button>
    <button data-act="dictVitals" data-arg="${pid}"><span class="mi">${ic('mic', 18)}</span><span><b>Dicter les constantes</b><small>« FR 22, sat 95, tension 120 sur 70… »</small></span></button>
  </div></details>`;
}

function openPatient(id) {
  const p = P(id),
    n = news2(p.v);
  const ts = S.trans.filter((t) => t.pid === id).reverse();
  sheet(`<div class="small muted">Chambre ${p.ch} · ${p.v.at} · ${p.age} ans</div><h1 style="margin-top:0">${esc(p.nom)}</h1><p class="sub">${esc(p.motif)} · ATCD : ${esc(p.atcd)}</p>
  <div class="card scoreline" style="background:${n.level === 'critique' ? '#FFF1F2' : '#fff'}"><div class="nscore" style="color:${LV[n.level].bg}">${n.total}</div><div><div class="ntag" style="color:${LV[n.level].bg}">NEWS2 · ${LV[n.level].l}</div><div class="small muted">Constantes de ${p.v.at} ${srcTag(p.v)}</div></div></div>
  <div class="card">${vtable(p.v)}</div>
  <div class="btns" style="margin-bottom:10px">${constantsMenu(id)}<button class="btn sm navy" data-act="saed" data-arg="${id}">${ic('phone', 16)} Appel SAED</button></div>
  <button class="btn" data-act="dictateFor" data-arg="${id}" style="margin-bottom:14px">${ic('mic')} Dicter une transmission</button>
  <div class="card"><div class="dar-k" style="margin-bottom:6px">Informations à ne pas perdre</div><div class="chips"><span class="chip">Allergie : ${esc(p.allergies)}</span>${p.precautions ? `<span class="chip" style="background:var(--warn-l);color:var(--warn)">${esc(p.precautions)}</span>` : ''}${p.disp.map((d) => `<span class="chip">${esc(d.l)} · J${d.j}</span>`).join('')}${p.famille ? `<span class="chip">${esc(p.famille)}</span>` : ''}</div></div>
  ${p.taches.length ? `<h2>À transmettre</h2><div class="card">${p.taches.map((t, i) => `<label class="check${t.done ? ' done' : ''}"><input type="checkbox" data-act="task" data-arg="${p.id}:${i}" ${t.done ? 'checked' : ''}><span>${esc(t.t)}</span></label>`).join('')}</div>` : ''}
  <h2>Transmissions du jour</h2>
  ${ts.length ? ts.map((t) => `<div class="card"><div class="small muted" style="margin-bottom:4px">${t.at}</div>${t.cibles.map((c, i) => `<div style="margin-bottom:8px"><div style="font-weight:700">${esc(c.c)}</div><div class="small"><b>D</b> ${esc(c.D)}</div>${c.A ? `<div class="small"><b>A</b> ${esc(c.A)}</div>` : ''}${c.R ? `<div class="small"><b>R</b> ${esc(c.R)}</div>` : `<button class="chip" style="margin-top:6px;background:var(--warn-l);color:var(--warn)" data-act="openAlert" data-arg="r-${t.id}-${i}">R manquant · compléter</button>`}</div>`).join('')}${t.diag?.length ? `<div class="small muted">Diagramme : ${esc(t.diag.join(' '))}</div>` : ''}</div>`).join('') : '<p class="small muted">Aucune transmission ciblée aujourd\'hui.</p>'}`);
}

function vitalsForm(id, prefill, note) {
  const p = P(id);
  const v = { ...p.v, ...(prefill || {}) };
  const hl = (k) =>
    prefill && k in prefill ? 'style="border-color:#5BB8F0;background:#F2FAFF"' : '';
  const inp = (k, l, step) =>
    `<div><label class="l" for="v-${k}">${l}</label><input class="f" type="number" inputmode="decimal" step="${step || 1}" id="v-${k}" data-vit="${k}" value="${v[k]}" ${hl(k)}></div>`;
  sheet(`<h1 style="margin-top:0">Constantes</h1><p class="sub">Ch. ${p.ch} · ${esc(p.nom)} · le score se recalcule en direct</p>
  ${note ? `<div class="card small" style="background:var(--sky-l)">${note}</div>` : ''}
  <div class="card"><div class="grid2">${inp('fr', 'FR (/min)')}${inp('spo2', 'SpO2 (%)')}${inp('pas', 'TA systolique')}${inp('pad', 'TA diastolique')}${inp('fc', 'FC (/min)')}${inp('temp', 'Température (°C)', '0.1')}
    <div><label class="l" for="v-o2">Oxygène</label><select class="f" id="v-o2" data-vit="o2" ${hl('o2')}><option value="0" ${!v.o2 ? 'selected' : ''}>Air ambiant</option><option value="1" ${v.o2 ? 'selected' : ''}>Sous O2</option></select></div>
    <div><label class="l" for="v-cons">Conscience</label><select class="f" id="v-cons" data-vit="cons" ${hl('cons')}><option value="A" ${v.cons === 'A' ? 'selected' : ''}>Alerte</option><option value="C" ${v.cons !== 'A' ? 'selected' : ''}>Confusion / altérée</option></select></div></div></div>
  <div class="card" id="vprev"></div>
  <button class="btn" data-act="saveVitals" data-arg="${id}">Enregistrer</button>`);
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
    temp: parseFloat(String(g('temp').value).replace(',', '.')),
    o2: g('o2').value === '1',
    cons: g('cons').value,
  };
}
function vprev() {
  const el = document.getElementById('vprev');
  if (!el) return;
  const n = news2(readVitals());
  el.innerHTML = `<div class="between"><span class="small muted">Nouveau score NEWS2</span><span class="row" style="gap:8px"><b style="font-size:22px">${n.total}</b>${badge(n.level)}</span></div>`;
}

function dictVitals(id) {
  const p = P(id);
  sheet(`<h1 style="margin-top:0">Dicter les constantes</h1><p class="sub">Ch. ${p.ch} · ${esc(p.nom)}. Dites-les comme d'habitude, vous vérifiez avant d'enregistrer.</p>
  <div class="card"><label class="l" for="vdict">Constantes dites</label><div class="row" style="align-items:flex-start"><textarea class="f" id="vdict" placeholder="FR 22, sat 95 en air ambiant, tension 120 sur 70, pouls 88, température 37,8, consciente"></textarea>${micBtn('vdict', 'Dicter les constantes')}</div><div class="live" id="live"></div></div>
  <button class="btn" data-act="parseVitals" data-arg="${id}">${ic('spark')} Repérer les valeurs</button>`);
}

async function dpiImport(id) {
  const p = P(id);
  sheet(
    `<h1 style="margin-top:0">Import depuis le DPI</h1><p class="sub">Ch. ${p.ch} · ${esc(p.nom)}</p><div class="card bino-card">${bino('concentre', 48)}<div><div class="t">Lecture du dossier patient…</div><div class="small muted">${FHIR.isMock(settings.fhirBase) ? 'DPI simulé (FHIR R4, données fictives)' : esc(settings.fhirBase)}</div></div></div>`,
  );
  try {
    const res = await FHIR.fetchVitals(p, settings.fhirBase);
    U.dpi = { pid: id, res };
    const merged = { ...p.v, ...res.v };
    const n0 = news2(p.v),
      n1 = news2(merged);
    const keys = VITAL_KEYS;
    sheet(`<h1 style="margin-top:0">Import depuis le DPI</h1><p class="sub">Ch. ${p.ch} · ${esc(p.nom)} · dernières valeurs du dossier à ${res.at || '—'}</p>
    <div class="card"><table class="vtable cmp"><tbody><tr><td class="small muted">Paramètre</td><td class="small muted" style="text-align:right">Actuel (${p.v.at})</td><td class="small muted" style="text-align:right">DPI</td></tr>
      ${keys
        .map((k) => {
          const has = k in res.v;
          const chg = has && res.v[k] !== p.v[k];
          return `<tr><td>${VITAL_LABELS[k]}</td><td style="text-align:right">${fmtVital(k, p.v[k])}</td><td style="text-align:right" class="${chg ? 'new chg' : ''}">${has ? fmtVital(k, res.v[k]) : '<span class="muted">non trouvé</span>'}</td></tr>`;
        })
        .join('')}
    </tbody></table></div>
    <div class="card between"><span class="small muted">NEWS2</span><span class="row" style="gap:8px"><b>${n0.total} → ${n1.total}</b>${badge(n1.level)}</span></div>
    <p class="small muted">Source : ${Object.keys(res.v).length} Observations FHIR · ${FHIR.isMock(settings.fhirBase) ? 'DPI simulé' : esc(settings.fhirBase)}. Le DPI reste la source de vérité ; les valeurs non trouvées sont conservées.</p>
    <div class="btns"><button class="btn sec" data-act="closeSheet">Annuler</button><button class="btn" data-act="applyDpi">${ic('dl', 18)} Importer</button></div>`);
  } catch (e) {
    sheet(`<h1 style="margin-top:0">Import depuis le DPI</h1><div class="card bino-card">${bino('clin', 48)}<div><div class="t">Le DPI n'a pas répondu</div><div class="small muted">${esc(e.message)}</div></div></div>
    <p class="small muted">Vérifiez l'adresse du serveur FHIR dans Réglages, ou utilisez la saisie manuelle.</p>
    <div class="btns"><button class="btn sec" data-act="editVitals" data-arg="${id}">Saisie manuelle</button><button class="btn" data-act="dpiImport" data-arg="${id}">Réessayer</button></div>`);
  }
}

function saed(id) {
  const p = P(id),
    n = news2(p.v);
  const last = [...S.trans].reverse().find((t) => t.pid === id);
  const txt = `S — Situation : ${p.nom}, ${p.age} ans, chambre ${p.ch}. NEWS2 à ${n.total} (${LV[n.level].l.toLowerCase()}) à ${p.v.at}.
A — Antécédents : ${p.motif}. ATCD : ${p.atcd}. Allergie : ${p.allergies}.${p.precautions ? ` Précautions : ${p.precautions}.` : ''}
E — Évaluation : FR ${p.v.fr}/min, SpO2 ${p.v.spo2} % ${p.v.o2 ? 'sous O2' : 'en air ambiant'}, TA ${p.v.pas}/${p.v.pad}, FC ${p.v.fc}/min, T ${num(p.v.temp)} °C, ${p.v.cons === 'A' ? 'conscient(e), alerte' : 'conscience altérée'}.${last ? ` ${last.cibles.map((c) => `${c.c} : ${c.D}`).join(' ')}` : ''}
D — Demande : ${n.level === 'critique' ? 'je souhaite que vous veniez évaluer le patient dans les 15 minutes.' : 'je souhaite un avis sur la conduite à tenir.'}`;
  sheet(`<h1 style="margin-top:0">Appel au médecin</h1><p class="sub">Message préparé au format SAED (recommandé par la HAS). Relisez et modifiez avant d'appeler.</p>
  <div class="card"><label class="l" for="saedtxt">Message</label><textarea class="f" id="saedtxt" style="min-height:260px">${esc(txt)}</textarea></div>
  <div class="btns"><button class="btn sec" data-act="copySaed">${ic('copy', 18)} Copier</button><button class="btn" data-act="closeSheet">${ic('check', 18)} Prêt</button></div>`);
}

function openAlert(aid) {
  const a = alerts().find((x) => x.id === aid);
  if (!a) {
    sheet('');
    return;
  }
  const p = P(a.pid);
  if (a.kind === 'news') {
    const n = news2(p.v);
    sheet(`<div class="small muted">Ch. ${p.ch} · ${esc(p.nom)}</div><h1 style="margin-top:0">Alerte</h1><p class="sub">Détérioration des constantes</p>
    <div class="card scoreline" style="background:#FFF1F2"><div class="nscore" style="color:${LV[n.level].bg}">${n.total}</div><div><div class="ntag" style="color:${LV[n.level].bg}">NEWS2 · ${LV[n.level].l}</div><div class="small muted">Constantes de ${p.v.at} ${srcTag(p.v)}</div></div></div>
    <div class="card">${vtable(p.v)}</div><p class="small muted">Le calcul est automatique. L'infirmier a le dernier mot.</p>
    <button class="btn navy" data-act="saed" data-arg="${p.id}" style="margin-bottom:10px">${ic('phone', 18)} Préparer l'appel SAED</button>
    <div class="btns"><button class="btn" data-act="ack" data-arg="${aid}">Valider</button>${constantsMenu(p.id, 'Ajuster')}</div>`);
  } else if (a.kind === 'r') {
    const t = S.trans.find((x) => x.id === a.tid),
      c = t.cibles[a.ci];
    sheet(`<div class="small muted">Ch. ${p.ch} · ${esc(p.nom)} · tracé à ${t.at}</div><h1 style="margin-top:0">Réévaluation</h1><p class="sub">Le champ Résultats est le plus souvent oublié. Bino vous relance.</p>
    <div class="card"><div style="font-weight:700;font-size:17px;margin-bottom:6px">${esc(c.c)}</div><div class="small"><b>D</b> ${esc(c.D)}</div>${c.A ? `<div class="small"><b>A</b> ${esc(c.A)}</div>` : ''}
    <div style="margin-top:12px"><label class="l" for="rfill">R · Résultat, effet des actions</label><div class="row"><input class="f" id="rfill" placeholder="Ex. : douleur à 2/10 à 18h30">${micBtn('rfill', 'Dicter le résultat')}</div></div></div>
    <button class="btn" data-act="saveR" data-arg="${aid}">Enregistrer la réévaluation</button>`);
  } else if (a.kind === 'rx') {
    sheet(
      `<div class="small muted">Ch. ${p.ch} · ${esc(p.nom)}</div><h1 style="margin-top:0">Nouvelle prescription</h1><p class="sub">Prescrite à ${p.rx.at}</p><div class="card" style="font-size:16px;font-weight:500">${esc(p.rx.t)}</div><div class="card small">Allergie connue : <b>${esc(p.allergies)}</b></div><button class="btn" data-act="ack" data-arg="${aid}">J'ai pris connaissance</button>`,
    );
  } else {
    const d = p.disp[a.di];
    sheet(
      `<div class="small muted">Ch. ${p.ch} · ${esc(p.nom)}</div><h1 style="margin-top:0">${esc(d.l)}</h1><p class="sub">Posé depuis ${d.j} jours. À rediscuter selon le protocole du service.</p><button class="btn" data-act="ack" data-arg="${aid}">Signalé au médecin</button>`,
    );
  }
}

function settingsSheet() {
  const m = AI.mode();
  sheet(`<h1 style="margin-top:0">Réglages</h1><p class="sub">Propres à ce navigateur. Rien n'est envoyé ailleurs.</p>
  <h2>Intelligence artificielle</h2>
  <div class="card">${
    AI.insideClaude()
      ? `<div class="small">Dans Claude, l'IA est fournie par la page${m === 'claude' ? ' : <b>active</b>.' : ' : pas encore disponible ici.'}</div>`
      : `
    <div class="small muted" style="margin-bottom:8px">Sans clé, Bino structure avec des règles simples et les deux exemples restent fidèles. Avec une clé API Anthropic de test, la structuration et les questions passent par Claude.</div>
    <label class="l" for="s-key">Clé API Anthropic (facultatif)</label><input class="f" id="s-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(settings.apiKey)}">
    <label class="l" for="s-model" style="margin-top:10px">Modèle</label><input class="f" id="s-model" value="${esc(settings.model || DEFAULT_MODEL)}">
    <p class="small muted" style="margin:8px 0 0">Utilisez une clé de test à budget limité. Elle reste dans ce navigateur. Données fictives uniquement.</p>`
  }
  </div>
  <h2>Dossier patient (DPI)</h2>
  <div class="card"><label class="l" for="s-fhir">Serveur FHIR R4</label><input class="f" id="s-fhir" value="${esc(settings.fhirBase)}" placeholder="${DEFAULT_FHIR}">
    <p class="small muted" style="margin:8px 0 0"><code>${DEFAULT_FHIR}</code> = DPI simulé fourni avec l'app. Pour un vrai serveur, indiquez son URL de base (ex. <code>https://…/fhir</code>) : l'app lit les Observations « vital-signs ». Le serveur doit autoriser les requêtes du navigateur (CORS).</p>
    <button class="btn sec sm" data-act="testFhir" style="margin-top:10px">Tester la connexion</button><div id="fhirtest" class="small" style="margin-top:8px"></div></div>
  <button class="btn" data-act="saveSettings" style="margin-bottom:10px">Enregistrer</button>
  <button class="btn sec" data-act="askReset">Réinitialiser les données de démo</button>
  <p class="foot">Bino · démo hackathon IA santé · Hôpital Foch</p>`);
}

/* ---------- structuration ---------- */
async function structure() {
  const el = document.getElementById('draft');
  if (el) U.draft = el.value;
  const text = (U.draft || '').trim();
  if (!text) {
    toast("Dictez ou écrivez d'abord quelques mots.");
    return;
  }
  if (U.listening) {
    await Voice.stop();
    U.listening = null;
  }
  const p = P(U.txPid);
  const ex = EXAMPLES.find((e) => e.pid === p.id && e.text === text);
  if (ex) {
    U.result = JSON.parse(JSON.stringify(ex.out));
    U.resultSrc = 'ex';
    render();
    window.scrollTo(0, 0);
    return;
  }
  U.busy = true;
  render();
  try {
    if (AI.mode() === 'off') throw Object.assign(new Error('off'), { code: 'off' });
    U.result = normalize(await AI.askJSON(structurePrompt(text, p)));
    U.resultSrc = 'ai';
  } catch (e) {
    U.result = normalize(localStructure(text));
    U.resultSrc = 'local';
    if (e && e.code === 'rate_limited')
      toast('Bino est très sollicité : règles locales utilisées.');
    else if (e && e.code === 'bad_key') toast('Clé API refusée : règles locales utilisées.');
    else if (e && e.code !== 'off') toast("L'IA n'a pas répondu : règles locales utilisées.");
  }
  U.busy = false;
  if (!U.result.cibles.length && !U.result.diag.length) {
    U.result = null;
    render();
    toast('Rien à structurer : précisez ce que vous avez observé ou fait.');
    return;
  }
  render();
  window.scrollTo(0, 0);
}

function validate() {
  const r = U.result,
    p = P(U.txPid);
  const g = (id) => {
    const e = document.getElementById(id);
    if (!e) return null;
    const v = (e.isContentEditable ? e.textContent : e.value || '').trim();
    return v || null;
  };
  const cibles = r.cibles.map((c, i) => ({
    c: g(`c-${i}-c`) || c.c,
    D: g(`c-${i}-D`) || c.D,
    A: g(`c-${i}-A`),
    R: g(`c-${i}-R`),
  }));
  S.trans.push({ id: `t${S.seq++}`, pid: p.id, at: hhmm(), cibles, diag: r.diag.map((d) => d.t) });
  for (const d of r.todo) p.taches.push({ t: d.t, done: false });
  if (r.v && Object.keys(r.v).length) {
    const nv = { ...p.v, ...r.v };
    if (VITAL_KEYS.some((k) => nv[k] !== p.v[k])) p.v = { ...nv, at: hhmm(), src: 'dictée' };
  }
  save();
  const miss = cibles.filter((c) => !c.R).length;
  U.result = null;
  U.draft = '';
  render();
  toast(
    `Transmission versée au dossier (simulé).${miss ? ` ${miss} relance${miss > 1 ? 's' : ''} de réévaluation créée${miss > 1 ? 's' : ''}.` : ''}`,
  );
}

/* ---------- relève : voix et questions ---------- */
function releveText() {
  return (
    'Relève de 19 heures 45. ' +
    sorted()
      .map((p) => {
        const n = news2(p.v);
        const last = [...S.trans].reverse().find((t) => t.pid === p.id);
        const todo = p.taches.filter((t) => !t.done).map((t) => t.t);
        return `Chambre ${p.ch}, ${p.nom.replace('Mme', 'Madame').replace('M.', 'Monsieur')}, ${p.motif}. Score NEWS2 à ${n.total}, ${LV[n.level].l}. ${last ? last.cibles.map((c) => `${c.c} : ${c.D}${c.R ? ` ${c.R}` : ' Résultat à réévaluer.'}`).join(' ') : ''} ${p.allergies !== 'Aucune connue' ? `Allergie : ${p.allergies}.` : ''} ${p.precautions ? `Précautions ${p.precautions}.` : ''} ${todo.length ? `À faire : ${todo.join(', ')}.` : ''}`;
      })
      .join(' ') +
    (S.addenda.length ? ` Addendum : ${S.addenda.map((a) => a.t).join('. ')}` : '')
  );
}

async function ask(question) {
  const q = (question || '').trim();
  if (!q) return;
  U.qaQ = q;
  U.qaBusy = true;
  U.qa = null;
  render();
  try {
    if (AI.mode() === 'off') throw new Error('off');
    U.qa = await AI.ask(qaPrompt(serviceSummary(sorted(), S.trans, S.addenda), q), {
      tier: 'quick',
      maxTokens: 400,
    });
  } catch (_e) {
    U.qa = localAnswer(q, sorted());
  }
  U.qaBusy = false;
  render();
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
  if (target === 'draft') {
    const el = document.getElementById('draft');
    if (el) U.draft = el.value;
  }
  if (target === 'qa') {
    const el = document.getElementById('qa');
    if (el) U.qaQ = el.value;
  }
  U.listening = target;
  Voice.start({
    onPartial: (t) => {
      const l = document.getElementById('live');
      if (l) l.textContent = t;
    },
    onFinal: (t) => appendDictation(target, t),
    onEnd: () => {
      if (U.listening === target) {
        U.listening = null;
        const l = document.getElementById('live');
        if (l) l.textContent = '';
        refreshMic();
      }
    },
    onError: (e) => {
      U.listening = null;
      refreshMic();
      toast(
        e && e.code === 'not_granted'
          ? 'Micro refusé : vous pouvez taper le texte.'
          : 'Dictée indisponible ici : utilisez le micro du clavier.',
      );
    },
  });
  refreshMic();
}
function refreshMic() {
  document.querySelectorAll('[data-act="mic"]').forEach((b) => {
    const on = b.dataset.arg === U.listening;
    b.classList.toggle('on', on);
    b.innerHTML = ic(on ? 'stop' : 'mic', b.classList.contains('sm') ? 18 : 22);
    b.setAttribute('aria-label', on ? 'Arrêter la dictée' : 'Dicter');
  });
}
function appendDictation(target, text) {
  if (target === 'draft') U.draft = (U.draft ? `${U.draft.trim()} ` : '') + text;
  if (target === 'qa') U.qaQ = (U.qaQ ? `${U.qaQ.trim()} ` : '') + text;
  const el = document.getElementById(target);
  if (el) {
    if (el.isContentEditable) el.textContent = `${(el.textContent || '').trim()} ${text}`.trim();
    else el.value = `${(el.value || '').trim()} ${text}`.trim();
  }
  const l = document.getElementById('live');
  if (l) l.textContent = '';
}

/* ---------- synchronisation DPI de tout le service ---------- */
async function syncAll() {
  U.syncing = true;
  render();
  let ok = 0,
    changed = 0,
    fail = 0;
  await Promise.all(
    S.patients.map(async (p) => {
      try {
        const res = await FHIR.fetchVitals(p, settings.fhirBase);
        const before = news2(p.v).total;
        if (VITAL_KEYS.some((k) => k in res.v && res.v[k] !== p.v[k])) {
          p.v = { ...p.v, ...res.v, at: res.at || hhmm(), src: 'DPI' };
          if (news2(p.v).total !== before) changed++;
        }
        ok++;
      } catch (_e) {
        fail++;
      }
    }),
  );
  save();
  U.syncing = false;
  render();
  toast(
    fail === S.patients.length
      ? "Le DPI n'a pas répondu. Vérifiez l'adresse dans Réglages."
      : `${ok} patient${ok > 1 ? 's' : ''} synchronisé${ok > 1 ? 's' : ''} avec le DPI · ${changed} score${changed > 1 ? 's' : ''} modifié${changed > 1 ? 's' : ''}.${fail ? ` ${fail} échec${fail > 1 ? 's' : ''}.` : ''}`,
  );
}

/* ---------- actions ---------- */
let tt;
function toast(m) {
  const t = document.getElementById('toast');
  t.innerHTML = `<div class="toast">${esc(m)}</div>`;
  clearTimeout(tt);
  tt = setTimeout(() => (t.innerHTML = ''), 4000);
}

const A = {
  tab: (a) => {
    U.tab = a;
    sheet('');
    render();
    window.scrollTo(0, 0);
  },
  openPatient,
  txPid: (a) => {
    U.txPid = a;
    U.result = null;
    U.draft = '';
    render();
  },
  useEx: (a) => {
    const e = EXAMPLES[+a];
    U.txPid = e.pid;
    U.draft = e.text;
    U.result = null;
    render();
  },
  structure: () => structure(),
  discard: () => {
    U.result = null;
    render();
  },
  validate: () => validate(),
  mic: (a) => startMic(a),
  dictateFor: (a) => {
    U.txPid = a;
    U.result = null;
    U.draft = '';
    U.tab = 'transmission';
    sheet('');
    render();
    window.scrollTo(0, 0);
  },
  editVitals: (a) => vitalsForm(a),
  dictVitals: (a) => dictVitals(a),
  parseVitals: (a) => {
    const t = (document.getElementById('vdict').value || '').trim();
    const v = extractVitals(t);
    if (!Object.keys(v).length) {
      toast('Aucune valeur repérée. Exemple : « FR 22, sat 95, tension 120 sur 70 ».');
      return;
    }
    if (U.listening) {
      Voice.stop();
      U.listening = null;
    }
    vitalsForm(
      a,
      v,
      `${Object.keys(v).length} valeur${Object.keys(v).length > 1 ? 's' : ''} repérée${Object.keys(v).length > 1 ? 's' : ''} dans votre dictée (en bleu). Vérifiez avant d'enregistrer.`,
    );
  },
  dpiImport: (a) => dpiImport(a),
  applyDpi: () => {
    const { pid, res } = U.dpi || {};
    if (!pid) return;
    const p = P(pid);
    p.v = { ...p.v, ...res.v, at: res.at || hhmm(), src: 'DPI' };
    save();
    sheet('');
    render();
    const n = news2(p.v);
    toast(`Constantes importées du DPI · NEWS2 ${n.total} (${LV[n.level].l}).`);
  },
  syncAll: () => syncAll(),
  saveVitals: (a) => {
    const p = P(a),
      v = readVitals();
    if ([v.fr, v.spo2, v.pas, v.pad, v.fc, v.temp].some((x) => !Number.isFinite(x) || x <= 0)) {
      toast('Vérifiez les valeurs saisies.');
      return;
    }
    p.v = { ...v, at: hhmm(), src: 'saisie' };
    save();
    sheet('');
    render();
    const n = news2(p.v);
    toast(`Constantes enregistrées · NEWS2 ${n.total} (${LV[n.level].l}).`);
  },
  saed: (a) => saed(a),
  copySaed: () => {
    const e = document.getElementById('saedtxt');
    const done = () => toast('Message copié.');
    if (navigator.clipboard)
      navigator.clipboard
        .writeText(e.value)
        .then(done)
        .catch(() => {
          e.focus();
          e.select();
          toast('Texte sélectionné : copiez-le.');
        });
    else {
      e.focus();
      e.select();
      toast('Texte sélectionné : copiez-le.');
    }
  },
  openAlert: (a) => openAlert(a),
  ack: (a) => {
    S.ack[a] = true;
    save();
    sheet('');
    render();
    toast('Alerte traitée.');
  },
  saveR: (a) => {
    const al = alerts().find((x) => x.id === a);
    const v = (document.getElementById('rfill').value || '').trim();
    if (!v) {
      toast('Écrivez ou dictez le résultat.');
      return;
    }
    S.trans.find((x) => x.id === al.tid).cibles[al.ci].R = `${v} (${hhmm()})`;
    save();
    sheet('');
    render();
    toast('Réévaluation tracée.');
  },
  task: (a, el) => {
    const [pid, i] = a.split(':');
    const t = P(pid).taches[+i];
    t.done = el.checked;
    el.closest('.check')?.classList.toggle('done', t.done);
    save();
    render();
  },
  speak: () => {
    if (Voice.isSpeaking()) Voice.stopSpeaking();
    else Voice.speak(releveText());
  },
  ask: () => ask(document.getElementById('qa').value),
  askQ: (a) => ask(a),
  addendum: () => {
    const el = document.getElementById('add');
    const v = (el.value || '').trim();
    if (!v) return;
    S.addenda.push({ at: hhmm(), t: v });
    save();
    render();
    toast("Addendum envoyé à l'équipe de nuit.");
  },
  settings: () => settingsSheet(),
  saveSettings: () => {
    const g = (id) => document.getElementById(id);
    const patch = { fhirBase: (g('s-fhir').value || '').trim() || DEFAULT_FHIR };
    if (g('s-key')) {
      patch.apiKey = g('s-key').value.trim();
      patch.model = g('s-model').value.trim() || DEFAULT_MODEL;
    }
    saveSettings(patch);
    sheet('');
    render();
    toast('Réglages enregistrés.');
  },
  testFhir: async () => {
    const out = document.getElementById('fhirtest');
    const base = (document.getElementById('s-fhir').value || '').trim() || DEFAULT_FHIR;
    out.textContent = 'Test en cours…';
    try {
      const r = await FHIR.fetchVitals(S.patients[0], base);
      out.innerHTML = `<span class="ok">Connexion réussie : ${Object.keys(r.v).length} constantes lues pour la chambre ${S.patients[0].ch}.</span>`;
    } catch (e) {
      out.innerHTML = `<span class="bad">${esc(e.message)}</span>`;
    }
  },
  closeSheet: () => sheet(''),
  closeSheetBg: (_a, el, e) => {
    if (e.target === el) sheet('');
  },
  askReset: () =>
    sheet(
      `<h1 style="margin-top:0">Réinitialiser la démo ?</h1><p class="sub">Les transmissions, constantes et alertes reviennent à leur état de départ. Vos réglages sont conservés.</p><div class="btns"><button class="btn sec" data-act="closeSheet">Annuler</button><button class="btn" data-act="reset">Réinitialiser</button></div>`,
    ),
  reset: () => {
    S = seed();
    save();
    Object.assign(U, { tab: 'patients', result: null, draft: '', qa: null, qaQ: '' });
    sheet('');
    render();
    toast('Démo réinitialisée.');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) {
    document.querySelectorAll('details.menu[open]').forEach((d) => {
      if (!d.contains(e.target)) d.open = false;
    });
    return;
  }
  const menu = el.closest('details.menu');
  if (menu) menu.open = false;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') {
    A[el.dataset.act](el.dataset.arg, el, e);
    return;
  }
  if (el.dataset.act !== 'closeSheetBg') e.preventDefault();
  const f = A[el.dataset.act];
  if (f) f(el.dataset.arg, el, e);
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.model) U[t.dataset.model] = t.value;
  if (t.dataset.vit !== undefined) vprev();
  if (t.id === 'qa') U.qaQ = t.value;
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.vit !== undefined) vprev();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.querySelector('details.menu[open]'))
      for (const d of document.querySelectorAll('details.menu[open]')) d.open = false;
    else if (document.getElementById('sheet').innerHTML) sheet('');
  }
  if (e.key === 'Enter' && e.target.id === 'qa') {
    e.preventDefault();
    ask(e.target.value);
  }
  if (e.key === 'Enter' && e.target.id === 'add') {
    e.preventDefault();
    A.addendum();
  }
});

Voice.onSpeakingChange((s) => {
  U.speaking = s;
  if (U.tab === 'releve') render();
});
render();
AI.init().then(render);
Voice.init().then(render);
