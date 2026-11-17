// Organisation des patients par sévérité.
// Automatique : l'IA classe les patients et donne une raison courte, factuelle (repli : NEWS2).
// Manuel : l'infirmière choisit le niveau ; son choix prime (ligne rouge de l'équipe :
// « la priorité est une suggestion explicable, la couleur manuelle prime »).
import type { Level, TriageItem, TriageRow, Vitals } from './model.js';
import { LV, news2 } from './news2.js';
import { num } from './util.js';

export const LEVELS = ['critique', 'eleve', 'moyen', 'stable'] as const;
// Ancien niveau « faible » : replié sur le jaune.
export function canonLevel(lv: string | null | undefined): Level | null {
  if (lv === 'faible') return 'moyen';
  for (const item of LEVELS) if (item === lv) return item;
  return null;
}
export const rank = (lv: string | null | undefined): number => {
  const level = canonLevel(lv);
  if (!level) return LEVELS.length;
  const i = LEVELS.indexOf(level);
  return i < 0 ? LEVELS.length : i;
};

const PARAMS = {
  fr: (v: Vitals) => `FR ${v.fr}`,
  spo2: (v: Vitals) => `SpO2 ${v.spo2} %`,
  o2: () => 'sous O2',
  pas: (v: Vitals) => `TA ${v.pas}/${v.pad}`,
  fc: (v: Vitals) => `FC ${v.fc}`,
  temp: (v: Vitals) => `T ${num(v.temp)} °C`,
  cons: () => 'conscience altérée',
};

function isParam(k: string): k is keyof typeof PARAMS {
  return k in PARAMS;
}

// Raison sans IA : le score et les paramètres qui pèsent le plus.
export function newsReason(v: Vitals): string {
  const n = news2(v);
  const top = Object.entries(n.p)
    .filter((entry): entry is [keyof typeof PARAMS, number] => {
      const [k, pts] = entry;
      return pts >= 2 && isParam(k);
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => {
      if (k === 'o2') return PARAMS.o2();
      if (k === 'cons') return PARAMS.cons();
      return PARAMS[k](v);
    });
  return `NEWS2 ${n.total}${top.length ? ` · ${top.join(', ')}` : ''}`;
}

export function localTriage(items: TriageItem[]): TriageRow[] {
  return items
    .map(({ p, v }) => ({
      id: p.id,
      niveau: canonLevel(news2(v).level) ?? 'moyen',
      raison: newsReason(v),
      s: news2(v).total,
    }))
    .sort((a, b) => rank(a.niveau) - rank(b.niveau) || b.s - a.s)
    .map(({ id, niveau, raison }) => ({ id, niveau, raison }));
}

export function triagePrompt(items: TriageItem[]): string {
  const lines = items
    .map(({ p, v, crs }) => {
      const n = news2(v);
      const notes = crs ?? [];
      const cr = notes.length
        ? notes.map((c) => `   - ${c.t} : « ${c.text} »`).join('\n')
        : '   - aucun compte rendu';
      return `[${p.id}] ch${p.ch} · ${p.nom}, ${p.age} ans, ${p.motif}. NEWS2 ${n.total} (${LV[n.level].l}) : FR ${v.fr}, SpO2 ${v.spo2} %${v.o2 ? ' sous O2' : ''}, TA ${v.pas}/${v.pad}, FC ${v.fc}, T ${num(v.temp)} °C, conscience ${v.cons === 'A' ? 'normale' : 'altérée'}. Allergie : ${p.allergies}.\n  Comptes rendus du jour :\n${cr}`;
    })
    .join('\n');
  return `Tu aides une infirmière d'un service de chirurgie à organiser ses patients par sévérité. Données fictives.
${lines}

Classe TOUS les patients, du plus urgent au moins urgent.
Pour chacun : "niveau" parmi critique, eleve, moyen, et "raison" : 6 à 14 mots, factuelle, qui reprend uniquement des faits présents ci-dessus (constantes, comptes rendus).
N'invente rien. Le NEWS2 est un repère : un compte rendu inquiétant peut faire monter un patient, mais ne descends jamais un patient sous le niveau de son NEWS2.
Réponds uniquement avec ce JSON :
{"patients":[{"id":"p12","niveau":"critique","raison":"…"}]}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Garde-fous sur la réponse de l'IA : identifiants connus, niveaux valides, jamais sous le NEWS2,
// tout patient oublié est ajouté avec sa raison NEWS2.
export function normalizeTriage(raw: unknown, items: TriageItem[]): TriageRow[] {
  const byId = new Map(items.map((it) => [it.p.id, it]));
  const seen = new Set<string>();
  const out: TriageRow[] = [];
  const patients = isRecord(raw) && Array.isArray(raw.patients) ? raw.patients : [];
  for (const r of patients) {
    if (!isRecord(r) || typeof r.id !== 'string') continue;
    const it = byId.get(r.id);
    if (!it || seen.has(r.id)) continue;
    const floor = canonLevel(news2(it.v).level) || 'moyen';
    let niveau = canonLevel(typeof r.niveau === 'string' ? r.niveau : null) || floor;
    if (rank(niveau) > rank(floor)) niveau = floor;
    const raison =
      (typeof r.raison === 'string' ? r.raison : '').trim().slice(0, 140) || newsReason(it.v);
    out.push({ id: r.id, niveau, raison });
    seen.add(r.id);
  }
  for (const miss of localTriage(items.filter((it) => !seen.has(it.p.id)))) out.push(miss);
  return out;
}
