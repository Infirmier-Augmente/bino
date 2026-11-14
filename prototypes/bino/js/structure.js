// Structuration d'une dictée en transmissions ciblées DAR.
// Deux moteurs : l'IA (prompt ci-dessous) et des règles locales de secours.
import { LV, news2 } from './news2.js';
import { vitLine } from './util.js';

export function extractVitals(t) {
  const v = {};
  const fr = t.match(/\b(?:FR|fréquence respiratoire)\s*(?:à|de|:)?\s*(\d{1,2})\b/i);
  if (fr) v.fr = +fr[1];
  const sat = t.match(/\b(?:sat(?:uration)?|spo2)\s*(?:à|de|:)?\s*(\d{2,3})\b/i);
  if (sat) v.spo2 = +sat[1];
  const ta = t.match(/\b(?:tension|TA|PA)\s*(?:à|de|:)?\s*(\d{2,3})\s*(?:sur|\/)\s*(\d{2,3})/i);
  if (ta) {
    v.pas = +ta[1];
    v.pad = +ta[2];
  }
  const fc = t.match(/\b(?:pouls|FC|fréquence cardiaque)\s*(?:à|de|:)?\s*(\d{2,3})\b/i);
  if (fc) v.fc = +fc[1];
  const temp = t.match(/\b(?:température|temp|T)\s*(?:à|de|:)?\s*(\d{2})(?:[.,](\d))?/i);
  if (temp) {
    const x = Number.parseFloat(`${temp[1]}.${temp[2] || '0'}`);
    if (x >= 34 && x <= 42.5) v.temp = x;
  }
  if (/lunettes|masque|sous o2|sous oxyg/i.test(t)) v.o2 = true;
  if (/air ambiant/i.test(t)) v.o2 = false;
  if (/confus|désorient|somnolent|ne répond/i.test(t)) v.cons = 'C';
  else if (/conscient/i.test(t)) v.cons = 'A';
  return v;
}

const FAMILIES = [
  ['Douleur', /douleur|mal au|mal à|se plaint|eva|sur 10/i],
  ['Respiratoire', /respir|essouffl|dyspn|encombr|tousse|oxyg|lunettes|désatur/i],
  ['Agitation / confusion', /agit|confus|désorient|arrach/i],
  ['Hyperthermie', /fièvre|fébrile|frisson|température 3[89]/i],
  ['Nausées / vomissements', /naus|vomi/i],
  ['Chute', /chute|tombé/i],
  ['Élimination', /urin|diurèse|selles|transit|globe/i],
  ['Alimentation', /mangé|repas|aliment|à jeun|appétit/i],
  ['Famille / entourage', /\b(fille|fils|famille|épou|mari|proche|enfants?)\b/i],
  ['Psychologique', /angoiss|anxi|pleur|inquiet/i],
  [
    'Surveillance des constantes',
    /\b(FR|sat|spo2|tension|TA|pouls|FC|température)\b\s*(à|de|:)?\s*\d/i,
  ],
];

export function localStructure(text) {
  const routine = /pansement|toilette|réfection|perfusion changée/i;
  const act =
    /j'ai |j’ai |on a |appelé|administré|donné|posé|reposé|mis en place|prévenu|prélev|installé/i;
  const res = /après|réévalu|amélior|soulag|calmé|résolu|efficace|toléré|diminu/i;
  const todo = /à faire|à prévoir|à contrôler|à surveiller|il passe|prévu|demain|cette nuit/i;
  // « M. Petit » n'est pas une fin de phrase : on protège l'abréviation le temps du découpage.
  const parts = text
    .replace(/\bM\.\s/g, 'M\u00a0')
    .split(/(?<=[.!?;])\s+/)
    .map((s) => s.replace(/M\u00a0/g, 'M. ').trim())
    .filter(Boolean);
  const cib = {},
    order = [],
    diag = [],
    td = [];
  let cur = null;
  parts.forEach((s, i) => {
    if (i === 0 && /chambre|box|^m(me|\.|onsieur|adame)/i.test(s) && s.length < 40) return;
    if (
      routine.test(s) &&
      !act.test(s.replace(/refait|changé/g, '')) &&
      !FAMILIES.some((f) => f[1].test(s))
    ) {
      diag.push({ t: s, s });
      return;
    }
    const f = FAMILIES.find((f) => f[1].test(s));
    // Une phrase « à faire » sans problème identifié va seulement dans les tâches.
    if (!f && todo.test(s)) {
      td.push({ t: s, s });
      return;
    }
    const key = f ? f[0] : cur || 'Observation';
    if (!cib[key]) {
      cib[key] = { c: key, D: '', A: '', R: '', sD: '', sA: '', sR: '' };
      order.push(key);
    }
    cur = key;
    const c = cib[key];
    const k = res.test(s) ? 'R' : act.test(s) ? 'A' : 'D';
    c[k] = `${c[k]} ${s}`.trim();
    c[`s${k}`] = `${c[`s${k}`]} ${s}`.trim();
    if (todo.test(s)) td.push({ t: s, s });
  });
  const cibles = order
    .map((k) => {
      const c = cib[k];
      return {
        c: c.c,
        D: c.D || null,
        A: c.A || null,
        R: c.R || null,
        sD: c.sD,
        sA: c.sA,
        sR: c.sR,
      };
    })
    .filter((c) => c.D || c.A || c.R);
  // Une cible sans Données mais avec une Action : l'action sert de Données.
  // Une cible avec seulement un Résultat est gardée : elle complète une cible d'un autre compte rendu.
  cibles.forEach((c) => {
    if (!c.D && c.A) {
      c.D = c.A;
      c.sD = c.sA;
      c.A = null;
      c.sA = null;
    }
  });
  return { cibles, diag, todo: td, v: extractVitals(text) };
}

export function normalize(raw) {
  const r = raw || {};
  const arr = (x) => (Array.isArray(x) ? x : []);
  const item = (d) => (typeof d === 'string' ? { t: d, s: null } : { t: d?.t, s: d?.s || null });
  return {
    cibles: arr(r.cibles)
      .map((c) => ({
        c: c.c || 'Cible',
        D: c.D || null,
        A: c.A || null,
        R: c.R || null,
        sD: c.sD || null,
        sA: c.sA || null,
        sR: c.sR || null,
      }))
      .filter((c) => c.D || c.A),
    diag: arr(r.diag)
      .map(item)
      .filter((d) => d.t),
    todo: arr(r.todo)
      .map(item)
      .filter((d) => d.t),
    v: Object.fromEntries(
      Object.entries(r.v || {}).filter(
        ([k, x]) =>
          x !== null &&
          x !== undefined &&
          ['fr', 'spo2', 'pas', 'pad', 'fc', 'temp', 'o2', 'cons'].includes(k),
      ),
    ),
  };
}

export function structurePrompt(text, p) {
  return `Tu es Bino, assistant de transmissions pour infirmiers d'un service de soins en France.
Patient : chambre ${p.ch}, ${p.nom}, ${p.motif}.
Dictée brute de l'infirmier(ère) :
"""${text}"""
Transforme cette dictée en transmissions ciblées au format DAR (Données, Actions, Résultats).
Règles strictes :
- N'invente aucune information. Ce qui n'est pas dit vaut null.
- Une cible = un problème, une réaction ou un événement qui demande une attention particulière. Les soins de routine (pansement simple, toilette, repas normal) vont dans "diag", sans cible.
- R (résultat, réévaluation) : null s'il n'est pas dit explicitement. Ne le déduis jamais.
- Pour chaque champ rempli, donne en source l'extrait exact et court de la dictée (sD, sA, sR).
- Style transmission infirmière : phrases courtes, abréviations usuelles (FR, SpO2, TA, FC, T), unités.
- "todo" : ce qui reste à faire pour l'équipe suivante, seulement si c'est dit, ou la réévaluation d'un R manquant (source null).
- "v" : uniquement les constantes dites avec un nombre : fr, spo2, pas, pad, fc, temp (nombre en °C), o2 (true si oxygène, false si air ambiant), cons ("A" si conscient/alerte, "C" si confusion). Omets les clés non dites.
Réponds uniquement avec ce JSON, sans texte autour :
{"cibles":[{"c":"intitulé","D":"…","sD":"…","A":"…ou null","sA":"…ou null","R":"…ou null","sR":"…ou null"}],"diag":[{"t":"…","s":"…"}],"todo":[{"t":"…","s":"…ou null"}],"v":{}}`;
}

export function serviceSummary(patients, trans, addenda) {
  return (
    patients
      .map((p) => {
        const n = news2(p.v);
        const ts = trans
          .filter((t) => t.pid === p.id)
          .map(
            (t) =>
              `${t.at} ${t.cibles.map((c) => `${c.c} D:${c.D} A:${c.A || '—'} R:${c.R || 'NON RÉÉVALUÉ'}`).join(' | ')}`,
          )
          .join(' || ');
        return `[Ch.${p.ch}] ${p.nom}, ${p.age} ans, ${p.motif}. ATCD ${p.atcd}. Allergie : ${p.allergies}. Précautions : ${p.precautions || 'aucune'}. NEWS2 ${n.total} (${LV[n.level].l}) à ${p.v.at} : ${vitLine(p.v)}. Ce matin : ${vitLine(p.prev)}. Prescription récente : ${p.rx ? `${p.rx.t} à ${p.rx.at}` : 'aucune'}. Dispositifs : ${p.disp.map((d) => `${d.l} J${d.j}`).join(', ') || 'aucun'}. Famille : ${p.famille || '—'}. Tâches : ${p.taches.map((t) => t.t + (t.done ? ' (fait)' : '')).join(' ; ') || 'aucune'}.
Transmissions : ${ts || 'aucune'}`;
      })
      .join('\n') +
    (addenda.length ? `\nAddenda : ${addenda.map((a) => `${a.at} ${a.t}`).join(' ; ')}` : '')
  );
}

export function qaPrompt(summary, q) {
  return `Tu es Bino et tu aides l'infirmier(ère) de nuit qui reçoit la relève d'un service de chirurgie. Réponds en français, en 2 à 4 phrases courtes, uniquement à partir des données ci-dessous. Cite la chambre et l'heure de la source entre crochets, par exemple [Ch.12 · 17h40]. Si l'information n'y est pas, dis-le clairement et propose de la demander à l'infirmière sortante. Ne donne aucune prescription ni posologie.
Données du service :
${summary}

Question : ${q}`;
}

// Réponses de secours sans IA, à partir des données (patients triés par priorité).
export function localAnswer(question, ps) {
  const q = question.toLowerCase();
  if (/premier|priorit|qui voir/.test(q)) {
    const p = ps[0],
      n = news2(p.v);
    return `Commencez par la chambre ${p.ch} (${p.nom}) : NEWS2 à ${n.total}, ${LV[n.level].l.toLowerCase()}. Puis la chambre ${ps[1].ch} (NEWS2 ${news2(ps[1].v).total}). [Ch.${p.ch} · ${p.v.at}]`;
  }
  if (/allerg/.test(q))
    return `${ps
      .filter((p) => p.allergies !== 'Aucune connue')
      .map((p) => `Ch. ${p.ch} ${p.nom} : ${p.allergies}`)
      .join('\n')}\nAucune allergie connue pour les autres patients.`;
  if (/faire|nuit|reste/.test(q))
    return (
      ps
        .map((p) => {
          const t = p.taches.filter((x) => !x.done);
          return t.length ? `Ch. ${p.ch} : ${t.map((x) => x.t).join(' ; ')}` : '';
        })
        .filter(Boolean)
        .join('\n') || 'Aucune tâche ouverte.'
    );
  const m = q.match(/(?:ch(?:ambre)?\.?\s*)(\d+)/);
  if (m) {
    const p = ps.find((x) => x.ch === m[1]);
    if (p) {
      const n = news2(p.v);
      return `Ch. ${p.ch} ${p.nom} : NEWS2 ${n.total}. ${vitLine(p.v)}. Allergie : ${p.allergies}.`;
    }
  }
  return "Je ne trouve pas la réponse dans le dossier. Posez la question à l'infirmière sortante avant son départ.";
}
