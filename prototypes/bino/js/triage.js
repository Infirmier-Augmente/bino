// Organisation des patients par sévérité.
// Automatique : l'IA classe les patients et donne une raison courte, factuelle (repli : NEWS2).
// Manuel : l'infirmière choisit le niveau ; son choix prime (ligne rouge de l'équipe :
// « la priorité est une suggestion explicable, la couleur manuelle prime »).
import { LV, news2 } from './news2.js';
import { num } from './util.js';

export const LEVELS = ['critique', 'eleve', 'moyen', 'faible'];
export const rank = (lv) => {
  const i = LEVELS.indexOf(lv);
  return i < 0 ? LEVELS.length : i;
};

const PARAMS = {
  fr: (v) => `FR ${v.fr}`,
  spo2: (v) => `SpO2 ${v.spo2} %`,
  o2: () => 'sous O2',
  pas: (v) => `TA ${v.pas}/${v.pad}`,
  fc: (v) => `FC ${v.fc}`,
  temp: (v) => `T ${num(v.temp)} °C`,
  cons: () => 'conscience altérée',
};

// Raison sans IA : le score et les paramètres qui pèsent le plus.
export function newsReason(v) {
  const n = news2(v);
  const top = Object.entries(n.p)
    .filter(([, pts]) => pts >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => PARAMS[k](v));
  return `NEWS2 ${n.total}${top.length ? ` · ${top.join(', ')}` : ''}`;
}

export function localTriage(items) {
  return items
    .map(({ p, v }) => ({
      id: p.id,
      niveau: news2(v).level,
      raison: newsReason(v),
      s: news2(v).total,
    }))
    .sort((a, b) => rank(a.niveau) - rank(b.niveau) || b.s - a.s)
    .map(({ id, niveau, raison }) => ({ id, niveau, raison }));
}

export function triagePrompt(items) {
  const lines = items
    .map(({ p, v, crs }) => {
      const n = news2(v);
      const cr = crs.length
        ? crs.map((c) => `   - ${c.t} : « ${c.text} »`).join('\n')
        : '   - aucun compte rendu';
      return `[${p.id}] ch${p.ch} · ${p.nom}, ${p.age} ans, ${p.motif}. NEWS2 ${n.total} (${LV[n.level].l}) : FR ${v.fr}, SpO2 ${v.spo2} %${v.o2 ? ' sous O2' : ''}, TA ${v.pas}/${v.pad}, FC ${v.fc}, T ${num(v.temp)} °C, conscience ${v.cons === 'A' ? 'normale' : 'altérée'}. Allergie : ${p.allergies}.\n  Comptes rendus du jour :\n${cr}`;
    })
    .join('\n');
  return `Tu aides une infirmière d'un service de chirurgie à organiser ses patients par sévérité. Données fictives.
${lines}

Classe TOUS les patients, du plus urgent au moins urgent.
Pour chacun : "niveau" parmi critique, eleve, moyen, faible, et "raison" : 6 à 14 mots, factuelle, qui reprend uniquement des faits présents ci-dessus (constantes, comptes rendus).
N'invente rien. Le NEWS2 est un repère : un compte rendu inquiétant peut faire monter un patient, mais ne descends jamais un patient sous le niveau de son NEWS2.
Réponds uniquement avec ce JSON :
{"patients":[{"id":"p12","niveau":"critique","raison":"…"}]}`;
}

// Garde-fous sur la réponse de l'IA : identifiants connus, niveaux valides, jamais sous le NEWS2,
// tout patient oublié est ajouté avec sa raison NEWS2.
export function normalizeTriage(raw, items) {
  const byId = new Map(items.map((it) => [it.p.id, it]));
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(raw?.patients) ? raw.patients : []) {
    const it = byId.get(r?.id);
    if (!it || seen.has(r.id)) continue;
    const floor = news2(it.v).level;
    let niveau = LEVELS.includes(r.niveau) ? r.niveau : floor;
    if (rank(niveau) > rank(floor)) niveau = floor;
    const raison =
      String(r.raison || '')
        .trim()
        .slice(0, 140) || newsReason(it.v);
    out.push({ id: r.id, niveau, raison });
    seen.add(r.id);
  }
  for (const miss of localTriage(items.filter((it) => !seen.has(it.p.id)))) out.push(miss);
  return out;
}
