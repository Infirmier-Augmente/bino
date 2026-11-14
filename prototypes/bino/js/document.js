// Document de transmission global : tous les patients, à partir des comptes rendus de toute l'équipe.
// Même règle que partout : chaque phrase vient d'un compte rendu ; ce qui n'est pas dit reste une question.
import { LV, news2 } from './news2.js';
import { esc, num } from './util.js';

const PRIO = { critique: 1, eleve: 2, moyen: 3, faible: 4 };

const vitShort = (v) =>
  `FR ${v.fr} · SpO2 ${v.spo2} %${v.o2 ? ' sous O2' : ''} · TA ${v.pas}/${v.pad} · FC ${v.fc} · T ${num(v.temp)} °C`;

/**
 * @param items [{ p, v, crs, syn }] triés par priorité ; syn peut être null (aucun compte rendu)
 * @param meta { date, time, author, service, authorOf }
 */
export function buildModel(items, meta) {
  const crCount = items.reduce((a, it) => a + it.crs.length, 0);
  const nurses = [...new Set(items.flatMap((it) => it.crs.map((c) => meta.authorOf(c))))];
  // Priorité affichée : celle de l'app (IA ou choix de l'infirmière), sinon le niveau du NEWS2.
  const rows = items.map((it) => ({ ...it, n: news2(it.v), lv: it.level || news2(it.v).level }));
  return {
    ...meta,
    rows,
    crCount,
    nurses,
    attention: rows.filter((r) => r.lv === 'critique' || r.lv === 'eleve'),
  };
}

function cibleHtml(c) {
  const line = (k, f) => (f ? `<p><span class="doc-k">${k}</span>${esc(f.t)}</p>` : '');
  const r =
    c.R || !c.A
      ? line('R', c.R)
      : '<p class="doc-q"><span class="doc-k">R</span>Résultat non renseigné : quelle réévaluation ?</p>';
  return `<div class="doc-c"><div class="doc-ct">${esc(c.c)}</div>${line('D', c.D)}${line('A', c.A)}${r}</div>`;
}

function patientHtml(r, authorOf) {
  const { p, v, n, lv, crs, syn } = r;
  const flags = [
    p.allergies !== 'Aucune connue' ? `Allergie : ${esc(p.allergies)}` : '',
    p.precautions ? `Précautions ${esc(p.precautions)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const body = !crs.length
    ? '<p class="doc-none">Aucun compte rendu aujourd\'hui.</p>'
    : `${syn?.resume ? `<p class="doc-res"><b>À retenir :</b> ${esc(syn.resume.t)}</p>` : ''}
      ${(syn?.cibles || []).map(cibleHtml).join('')}
      ${syn?.todo?.length ? `<div class="doc-todo"><b>À faire</b><ul>${syn.todo.map((t) => `<li>${esc(t.t)}</li>`).join('')}</ul></div>` : ''}
      <p class="doc-src">Comptes rendus : ${crs.map((c) => `${esc(authorOf(c))} (${esc(c.t || '')})`).join(', ')}</p>`;
  return `<section class="doc-p" style="border-left-color:${LV[lv].bar}">
    <div class="doc-ph"><span class="doc-room">ch${esc(p.ch)}</span><b>${esc(p.nom)}</b><span class="doc-lv" style="background:${LV[lv].bg};color:${LV[lv].fg}">Priorité ${PRIO[lv]}</span></div>
    <p class="doc-meta">${p.age} ans · ${esc(p.motif)}${flags ? `<br>${flags}` : ''}<br>NEWS2 ${n.total} · ${vitShort(v)} (${esc(v.at)})</p>
    ${body}
  </section>`;
}

export const DOC_CSS = `
.doc{font-size:14px;line-height:20px;color:#002244}
.doc h1{font-size:24px;line-height:30px;margin:0}
.doc .doc-sub{color:#5f5f5f;margin:4px 0 12px}
.doc .doc-sum{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.doc .doc-sum span{background:#edf0f3;border-radius:999px;padding:4px 10px;font-size:13px}
.doc .doc-att{background:#fff1f2;border-radius:12px;padding:10px 12px;margin:0 0 16px}
.doc .doc-att ul{margin:4px 0 0;padding-left:18px}
.doc .doc-p{background:#fff;border-radius:14px;border-left:4px solid #5bb8f0;padding:12px 14px;margin:0 0 12px;break-inside:avoid}
.doc .doc-ph{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:16px}
.doc .doc-room{border:1.5px solid #002244;border-radius:999px;padding:0 8px;font-size:12px;font-weight:700}
.doc .doc-lv{border-radius:999px;padding:2px 8px;font-size:12px;font-weight:700;margin-left:auto}
.doc .doc-meta{color:#5f5f5f;font-size:13px;line-height:18px;margin:6px 0 8px}
.doc .doc-c{border-top:1px solid rgba(0,34,68,.1);padding:8px 0 2px}
.doc .doc-ct{font-weight:700}
.doc .doc-c p{margin:3px 0}
.doc .doc-k{display:inline-block;width:18px;font-weight:700;color:#5f5f5f}
.doc .doc-q{color:#9a4a06}
.doc .doc-res{background:rgba(91,184,240,.18);border-radius:10px;padding:8px 10px;margin:0 0 6px}
.doc .doc-todo ul{margin:2px 0 0;padding-left:18px}
.doc .doc-src,.doc .doc-none{color:#5f5f5f;font-size:12px;margin:8px 0 0}
.doc .doc-foot{color:#5f5f5f;font-size:12px;margin-top:8px}`;

export function docHtml(m) {
  return `<article class="doc">
  <h1>Transmission du service</h1>
  <p class="doc-sub">${esc(m.service)} · Date : ${esc(m.date)} · relève de 19h45<br>Généré par ${esc(m.author)} à ${esc(m.time)}</p>
  <div class="doc-sum"><span>${m.rows.length} patients</span><span>${m.crCount} comptes rendus</span><span>${m.nurses.length} soignants : ${esc(m.nurses.join(', '))}</span></div>
  ${
    m.attention.length
      ? `<div class="doc-att"><b>Priorités</b><ul>${m.attention.map((r) => `<li>Priorité ${PRIO[r.lv]} · ch${esc(r.p.ch)} · ${esc(r.p.nom)} (NEWS2 ${r.n.total})</li>`).join('')}</ul></div>`
      : ''
  }
  ${m.rows.map((r) => patientHtml(r, m.authorOf)).join('')}
  <p class="doc-foot">Document généré à partir des comptes rendus validés par l'équipe. Chaque phrase vient d'un compte rendu ; à relire avant la relève. Données fictives.</p>
  </article>`;
}

export function docText(m) {
  const lines = [
    'TRANSMISSION DU SERVICE',
    `${m.service} · Date : ${m.date} · relève de 19h45`,
    `Généré par ${m.author} à ${m.time} · ${m.rows.length} patients · ${m.crCount} comptes rendus`,
    '',
  ];
  if (m.attention.length) {
    lines.push('PRIORITÉS');
    for (const r of m.attention)
      lines.push(`- Priorité ${PRIO[r.lv]} · ch${r.p.ch} ${r.p.nom} (NEWS2 ${r.n.total})`);
    lines.push('');
  }
  for (const r of m.rows) {
    lines.push(
      `ch${r.p.ch} · ${r.p.nom}, ${r.p.age} ans · ${r.p.motif} · NEWS2 ${r.n.total} (${LV[r.n.level].l})`,
    );
    if (r.p.allergies !== 'Aucune connue') lines.push(`Allergie : ${r.p.allergies}`);
    if (!r.crs.length) lines.push("Aucun compte rendu aujourd'hui.");
    if (r.syn?.resume) lines.push(`À retenir : ${r.syn.resume.t}`);
    for (const c of r.syn?.cibles || []) {
      lines.push(`* ${c.c}`);
      lines.push(`  D : ${c.D.t}`);
      if (c.A) lines.push(`  A : ${c.A.t}`);
      if (c.R) lines.push(`  R : ${c.R.t}`);
      else if (c.A) lines.push('  R : non renseigné, à réévaluer');
    }
    if (r.syn?.todo?.length) lines.push(`À faire : ${r.syn.todo.map((t) => t.t).join(' ; ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function docFile(m) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Transmission ${esc(m.date)}</title><style>body{margin:0;padding:24px;background:#f3f3f3;font-family:system-ui,sans-serif}${DOC_CSS}</style></head><body>${docHtml(m)}</body></html>`;
}
