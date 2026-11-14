// Transmission finale : fusionne les comptes rendus de tous les soignants d'un patient.
// Ligne rouge : rien d'inventé. Chaque élément garde au moins un extrait exact d'un compte rendu,
// sinon il est écarté. Un résultat (R) non dit devient une question, jamais une supposition.
import { localStructure } from './structure.js';

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

// Garde uniquement les sources dont l'extrait figure vraiment dans le compte rendu cité.
export function groundSources(src, crs) {
  const byId = new Map(crs.map((c) => [c.id, c]));
  return (Array.isArray(src) ? src : [])
    .map((s) => ({ cr: s?.cr, q: String(s?.q || '').trim() }))
    .filter((s) => s.q && byId.has(s.cr) && norm(byId.get(s.cr).text).includes(norm(s.q)));
}

function groundField(f, crs) {
  if (!f || typeof f.t !== 'string' || !f.t.trim()) return null;
  const src = groundSources(f.src, crs);
  return src.length ? { t: f.t.trim(), src } : null;
}

export function normalizeSynth(raw, crs) {
  const r = raw || {};
  const list = (x) => (Array.isArray(x) ? x : []).map((f) => groundField(f, crs)).filter(Boolean);
  const cibles = (Array.isArray(r.cibles) ? r.cibles : [])
    .map((c) => ({
      c: String(c?.c || 'Cible'),
      D: groundField(c?.D, crs),
      A: groundField(c?.A, crs),
      R: groundField(c?.R, crs),
    }))
    .filter((c) => c.D);
  return {
    resume: groundField(r.resume, crs),
    points: list(r.points).slice(0, 6),
    cibles,
    todo: list(r.todo),
    soins: list(r.soins),
  };
}

// Identifiants courts pour le prompt (cr1, cr2…), remappés ensuite vers les vrais.
export function synthPrompt(p, crs, authorOf) {
  const lines = crs
    .map((c, i) => `[cr${i + 1}] ${c.t} · ${authorOf(c)} : « ${c.text} »`)
    .join('\n');
  return `Tu es Bino. Tu prépares la transmission finale de la relève de 19h45 pour un patient, à partir des comptes rendus de TOUS les soignants de la journée.
Patient : chambre ${p.ch}, ${p.nom}, ${p.age} ans, ${p.motif}.
Comptes rendus (ordre chronologique) :
${lines}

Produis une synthèse en transmissions ciblées DAR (Données, Actions, Résultats), fusionnée et à jour :
- Une cible par problème ; fusionne ce qui concerne le même problème ; garde l'information la plus récente.
- N'invente rien. Chaque élément cite au moins un extrait EXACT et court d'un compte rendu (champ "src" : [{"cr":"cr2","q":"extrait exact"}]).
- R (résultat, réévaluation) : null s'il n'est pas dit. Ne le déduis jamais.
- "points" : 3 à 5 puces courtes qui résument la journée du patient pour la relève (une idée par puce, la plus importante d'abord), chacune sourcée.
- "resume" : 1 phrase « à retenir » pour l'équipe suivante, sourcée, ou null.
- "todo" : ce qui reste à faire pour l'équipe suivante, seulement si c'est dit.
- "soins" : soins de routine faits (pansement, repas…), sans cible.
- Style transmission infirmière : phrases courtes, abréviations usuelles (FR, SpO2, TA, FC, T), unités.
Réponds uniquement avec ce JSON :
{"points":[{"t":"…","src":[]}],"resume":{"t":"…","src":[]}|null,"cibles":[{"c":"…","D":{"t":"…","src":[]},"A":{"t":"…","src":[]}|null,"R":{"t":"…","src":[]}|null}],"todo":[{"t":"…","src":[]}],"soins":[{"t":"…","src":[]}]}`;
}

// Remplace cr1, cr2… par les identifiants réels avant la vérification des sources.
export function remapIds(raw, crs) {
  const map = new Map(crs.map((c, i) => [`cr${i + 1}`, c.id]));
  const fix = (f) =>
    f && Array.isArray(f.src)
      ? { ...f, src: f.src.map((s) => ({ ...s, cr: map.get(s?.cr) || s?.cr })) }
      : f;
  const r = raw || {};
  return {
    resume: fix(r.resume),
    points: (r.points || []).map(fix),
    cibles: (r.cibles || []).map((c) => ({ ...c, D: fix(c.D), A: fix(c.A), R: fix(c.R) })),
    todo: (r.todo || []).map(fix),
    soins: (r.soins || []).map(fix),
  };
}

// Sans IA : règles locales appliquées à chaque compte rendu, puis fusion par cible.
export function localSynth(crs) {
  const cib = new Map();
  const todo = [];
  const soins = [];
  // Une source par phrase : les phrases d'une même cible ne se suivent pas toujours dans le texte.
  const sentences = (s) =>
    String(s || '')
      .split(/(?<=[.!?;])\s+/)
      .filter(Boolean);
  const add = (field, text, quote, crId) => {
    if (!text) return field;
    const f = field || { t: '', src: [] };
    const src = sentences(quote || text).map((q) => ({ cr: crId, q }));
    return { t: `${f.t} ${text}`.trim(), src: [...f.src, ...src] };
  };
  for (const cr of crs) {
    const r = localStructure(cr.text);
    for (const c of r.cibles) {
      const cur = cib.get(c.c) || { c: c.c, D: null, A: null, R: null };
      cur.D = add(cur.D, c.D, c.sD, cr.id);
      cur.A = add(cur.A, c.A, c.sA, cr.id);
      cur.R = add(cur.R, c.R, c.sR, cr.id);
      cib.set(c.c, cur);
    }
    for (const d of r.diag) soins.push({ t: d.t, src: [{ cr: cr.id, q: d.s || d.t }] });
    for (const d of r.todo) todo.push({ t: d.t, src: [{ cr: cr.id, q: d.s || d.t }] });
  }
  // Puces sans IA : une par cible (données, action, résultat), puis les tâches.
  const points = [...cib.values()]
    .filter((c) => c.D)
    .map((c) => ({
      t: `${c.c} : ${[c.D, c.A, c.R]
        .filter(Boolean)
        .map((f) => f.t)
        .join(' ')}`,
      src: [c.D, c.A, c.R].filter(Boolean).flatMap((f) => f.src),
    }));
  for (const t of todo) points.push({ t: `À faire : ${t.t}`, src: t.src });
  return normalizeSynth({ resume: null, points, cibles: [...cib.values()], todo, soins }, crs);
}
