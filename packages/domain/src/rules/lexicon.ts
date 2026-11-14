import type { Appareil } from '../schemas/common';
import type { SeverityLevel } from '../schemas/transmission';
import { normalize } from './text';

/**
 * LEXIQUE SOIGNANT — source unique pour :
 *  - l'affichage (développer une abréviation au toucher),
 *  - le prompt LLM (glossaire),
 *  - le biais de vocabulaire du speech-to-text,
 *  - le moteur heuristique de secours.
 * Ajouter une entrée ici profite à toute la chaîne.
 */
export interface Abbreviation {
  abbr: string;
  meaning: string;
  /** Formes orales/variantes reconnues dans une dictée. */
  variants?: string[];
}

export const ABBREVIATIONS: readonly Abbreviation[] = [
  { abbr: 'GCS', meaning: 'Score de Glasgow (conscience, 3 à 15)', variants: ['glasgow'] },
  { abbr: 'RASS', meaning: 'Échelle de sédation et d’agitation' },
  { abbr: 'BPS', meaning: 'Échelle comportementale de douleur (patient intubé)' },
  { abbr: 'EVA', meaning: 'Échelle visuelle analogique de la douleur' },
  { abbr: 'EN', meaning: 'Échelle numérique de la douleur' },
  { abbr: 'DLE', meaning: 'Dérivation lombaire externe (drain de LCR)' },
  { abbr: 'AA', meaning: 'Air ambiant (sans oxygène)' },
  { abbr: 'PAS', meaning: 'Pression artérielle systolique' },
  { abbr: 'PA', meaning: 'Pression artérielle' },
  { abbr: 'FC', meaning: 'Fréquence cardiaque' },
  { abbr: 'FR', meaning: 'Fréquence respiratoire' },
  { abbr: 'SpO2', meaning: 'Saturation pulsée en oxygène', variants: ['sat', 'saturation'] },
  { abbr: 'IVSE', meaning: 'Intraveineuse à la seringue électrique' },
  { abbr: 'HGT', meaning: 'Hémoglucotest (glycémie capillaire)', variants: ['dextro'] },
  { abbr: 'SV', meaning: 'Sonde vésicale (urinaire)' },
  { abbr: 'SU', meaning: 'Sonde urinaire' },
  { abbr: 'VVP', meaning: 'Voie veineuse périphérique' },
  { abbr: 'KT', meaning: 'Cathéter', variants: ['cathé'] },
  { abbr: 'KTC', meaning: 'Cathéter central', variants: ['kt central', 'voie centrale'] },
  { abbr: 'PICC', meaning: 'Cathéter central à insertion périphérique', variants: ['picc line'] },
  { abbr: 'SNG', meaning: 'Sonde nasogastrique' },
  { abbr: 'VM', meaning: 'Ventilation mécanique' },
  { abbr: 'VNI', meaning: 'Ventilation non invasive' },
  { abbr: 'OHD', meaning: 'Oxygénothérapie à haut débit', variants: ['optiflow', 'haut débit'] },
  { abbr: 'PEP', meaning: 'Pression expiratoire positive' },
  { abbr: 'FiO2', meaning: 'Fraction inspirée en oxygène' },
  {
    abbr: 'Noradré',
    meaning: 'Noradrénaline (amine vasopressive)',
    variants: ['noradre', 'nora'],
  },
  { abbr: 'BMR', meaning: 'Bactérie multirésistante' },
  { abbr: 'BHRe', meaning: 'Bactérie hautement résistante émergente' },
  { abbr: 'LATA', meaning: 'Limitation ou arrêt des thérapeutiques actives' },
  { abbr: 'IDE', meaning: 'Infirmier(ère) diplômé(e) d’État' },
  { abbr: 'AS', meaning: 'Aide-soignant(e)' },
  { abbr: 'DPI', meaning: 'Dossier patient informatisé' },
  { abbr: 'NE', meaning: 'Nutrition entérale' },
  { abbr: 'NP', meaning: 'Nutrition parentérale' },
  { abbr: 'TA', meaning: 'Tension artérielle' },
  { abbr: 'T°', meaning: 'Température' },
  { abbr: 'O2', meaning: 'Oxygène' },
  { abbr: '/2', meaning: 'Toutes les 2 heures (ex. « tour neuro /2 »)' },
  { abbr: 'ECBU', meaning: 'Examen cytobactériologique des urines' },
  { abbr: 'NFS', meaning: 'Numération formule sanguine' },
  { abbr: 'BU', meaning: 'Bandelette urinaire' },
  { abbr: 'PO', meaning: 'Per os (par la bouche)' },
  { abbr: 'SC', meaning: 'Sous-cutané' },
  { abbr: 'IV', meaning: 'Intraveineux' },
];

/** Glossaire compact pour un prompt LLM ou un biais STT. */
export function glossaryForPrompt(): string {
  return ABBREVIATIONS.map((a) => `${a.abbr} = ${a.meaning}`).join('\n');
}

export function sttVocabulary(): string {
  return ABBREVIATIONS.flatMap((a) => [a.abbr, ...(a.variants ?? [])]).join(', ');
}

/** Retrouve la signification d'une abréviation (insensible à la casse). */
export function expandAbbreviation(token: string): Abbreviation | undefined {
  const n = normalize(token);
  return ABBREVIATIONS.find(
    (a) => normalize(a.abbr) === n || (a.variants ?? []).some((v) => normalize(v) === n),
  );
}

// ─── Mots-clés par appareil ──────────────────────────────────────────────────
// Formes NORMALISÉES (minuscules, sans accents). Un mot-clé peut être multi-mots.

export const APPAREIL_KEYWORDS: Record<Appareil, readonly string[]> = {
  neuro: [
    'neuro',
    'glasgow',
    'gcs',
    'sedation',
    'seda',
    'rass',
    'pupille',
    'pupilles',
    'conscient',
    'confus',
    'confusion',
    'agite',
    'agitee',
    'agitation',
    'dle',
    'tour neuro',
    'somnolent',
    'somnolente',
    'reveil',
    'deficit',
    'convulsion',
    'orientee',
    'oriente',
  ],
  respiratoire: [
    'respi',
    'respiratoire',
    'ventil',
    'ventilation',
    'extube',
    'extubee',
    'intube',
    'intubee',
    'vm',
    'vni',
    'lunettes',
    'o2',
    'oxygene',
    'fio2',
    'pep',
    'secretions',
    'aspiration',
    'aspire',
    'kine',
    'saturation',
    'sat',
    'spo2',
    'eupneique',
    'dyspnee',
    'dyspneique',
    'polypnee',
    'desaturation',
    'desature',
    'air ambiant',
    'aa',
    'optiflow',
    'masque',
    'encombre',
    'toux',
  ],
  hemodynamique: [
    'hemodynamique',
    'hemodyn',
    'hemodynamiquement',
    'tension',
    'pa',
    'normotendu',
    'normotendue',
    'hypotension',
    'hypertension',
    'hypotendu',
    'fc',
    'normocarde',
    'tachycarde',
    'tachycardie',
    'bradycarde',
    'bradycardie',
    'noradre',
    'noradrenaline',
    'amines',
    'remplissage',
    'marbrures',
    'anti agregant',
    'scope',
  ],
  digestif: [
    'digestif',
    'dig',
    'sng',
    'sonde nasogastrique',
    'alimentation',
    'enterale',
    'parenterale',
    'transit',
    'selles',
    'vomi',
    'vomissement',
    'vomissements',
    'nausee',
    'nausees',
    'glycemie',
    'hgt',
    'dextro',
    'a jeun',
    'mange',
    'repas',
    'nutrition',
  ],
  renal: [
    'renal',
    'urinaire',
    'diurese',
    'sv',
    'sonde vesicale',
    'sonde urinaire',
    'urines',
    'elim',
    'elimination',
    'dialyse',
    'epuration',
    'globe',
    'miction',
  ],
  cutane: [
    'cutane',
    'cutanee',
    'peau',
    'escarre',
    'braden',
    'pansement',
    'plaie',
    'rougeur',
    'erytheme',
    'cicatrice',
    'oedeme',
    'toilette',
  ],
  dispositifs: [
    'kt',
    'ktc',
    'catheter',
    'cathe',
    'vvp',
    'picc',
    'drain',
    'redon',
    'voie centrale',
    'voie veineuse',
    'perfusion',
  ],
  douleur: [
    'douleur',
    'douloureux',
    'douloureuse',
    'algique',
    'eva',
    'bps',
    'antalgique',
    'antalgie',
    'doliprane',
    'paracetamol',
    'morphine',
    'oxynorm',
    'acupan',
    'tramadol',
  ],
  psy: [
    'anxieux',
    'anxieuse',
    'angoisse',
    'angoissee',
    'pleure',
    'moral',
    'triste',
    'refus',
    'refuse',
    'opposant',
    'opposante',
  ],
  general: ['fievre', 'temperature', 'hyperthermie', 'febrile', 'frissons', 'chute', 'malaise'],
};

/** Événements qui justifient une CIBLE (un problème, un changement d'état). */
export interface TargetRule {
  keywords: readonly string[];
  label: string;
  appareil: Appareil;
  severity: SeverityLevel;
}

export const TARGET_RULES: readonly TargetRule[] = [
  {
    keywords: ['arrete cardiaque', 'acr', 'massage'],
    label: 'Arrêt cardio-respiratoire',
    appareil: 'hemodynamique',
    severity: 'urgent',
  },
  {
    keywords: ['desaturation', 'desature', 'detresse respiratoire', 'dyspnee', 'polypnee'],
    label: 'Détresse respiratoire',
    appareil: 'respiratoire',
    severity: 'urgent',
  },
  {
    keywords: ['hemorragie', 'saigne', 'saignement', 'hematemese', 'melena'],
    label: 'Saignement',
    appareil: 'hemodynamique',
    severity: 'urgent',
  },
  {
    keywords: ['convulsion', 'convulse', 'crise comitiale'],
    label: 'Convulsions',
    appareil: 'neuro',
    severity: 'urgent',
  },
  {
    keywords: ['hypotension', 'hypotendu', 'hypotendue', 'marbrures', 'collapsus'],
    label: 'Instabilité hémodynamique',
    appareil: 'hemodynamique',
    severity: 'preoccupant',
  },
  {
    keywords: ['agite', 'agitee', 'agitation', 'arrache', 'arrachee'],
    label: 'Agitation',
    appareil: 'neuro',
    severity: 'preoccupant',
  },
  {
    keywords: ['confus', 'confuse', 'confusion', 'desoriente', 'desorientee'],
    label: 'Confusion',
    appareil: 'neuro',
    severity: 'preoccupant',
  },
  {
    keywords: ['chute', 'tombe', 'tombee', 'retrouve au sol', 'retrouvee au sol'],
    label: 'Chute',
    appareil: 'general',
    severity: 'preoccupant',
  },
  {
    keywords: ['malaise'],
    label: 'Malaise',
    appareil: 'general',
    severity: 'preoccupant',
  },
  {
    keywords: ['fievre', 'febrile', 'hyperthermie', 'frissons'],
    label: 'Hyperthermie',
    appareil: 'general',
    severity: 'surveillance',
  },
  {
    keywords: ['hypoglycemie', 'hyperglycemie'],
    label: 'Déséquilibre glycémique',
    appareil: 'digestif',
    severity: 'preoccupant',
  },
  {
    keywords: ['vomi', 'vomissement', 'vomissements', 'nausee', 'nausees'],
    label: 'Nausées / vomissements',
    appareil: 'digestif',
    severity: 'surveillance',
  },
  {
    keywords: ['douleur', 'douloureux', 'douloureuse', 'algique', 'mal au', 'mal a la'],
    label: 'Douleur',
    appareil: 'douleur',
    severity: 'surveillance',
  },
  {
    keywords: ['extube', 'extubee', 'sevrage'],
    label: 'Sevrage ventilatoire',
    appareil: 'respiratoire',
    severity: 'surveillance',
  },
  {
    keywords: ['globe', 'retention'],
    label: 'Rétention urinaire',
    appareil: 'renal',
    severity: 'surveillance',
  },
  {
    keywords: ['escarre', 'rougeur', 'erytheme'],
    label: 'Atteinte cutanée',
    appareil: 'cutane',
    severity: 'surveillance',
  },
  {
    keywords: ['angoisse', 'angoissee', 'anxieux', 'anxieuse', 'pleure', 'refuse', 'refus'],
    label: 'Anxiété / refus de soins',
    appareil: 'psy',
    severity: 'surveillance',
  },
];

// ─── Marqueurs de structure DAR ──────────────────────────────────────────────

/** Indices qu'une proposition décrit une ACTION réalisée. */
export const ACTION_MARKERS: readonly string[] = [
  'j ai',
  'je l ai',
  'je les ai',
  'je lui ai',
  'je leur ai',
  'on a',
  'on l a',
  'on lui a',
  'a ete pose',
  'a ete posee',
  'refait',
  'refaite',
  'repose',
  'reposee',
  'pose',
  'posee',
  'appele',
  'appelee',
  'prevenu',
  'prevenue',
  'administre',
  'donne',
  'est passe',
  'est passee',
  'realise',
  'realisee',
  'mis en place',
  'change',
  'retire',
  'retiree',
  'preleve',
  'prelevement',
  'aspire',
  'installe',
  'installee',
  'surveillance mise',
];

/** Indices qu'une proposition décrit un RÉSULTAT / une réévaluation. */
export const RESULT_MARKERS: readonly string[] = [
  'ok',
  'efficace',
  'inefficace',
  'ameliore',
  'amelioree',
  'amelioration',
  'soulage',
  'soulagee',
  'calme',
  'calmee',
  'apaise',
  'apaisee',
  'valide',
  'validee',
  'bien tolere',
  'bien toleree',
  'tolere',
  'resolu',
  'resolue',
  'diminue',
  'diminuee',
  'pas de recidive',
  'normalise',
  'normalisee',
  'controle',
  'reevalue',
  'reevaluee',
];

/** Indices d'un soin de ROUTINE (diagramme de soins, pas de cible). */
export const ROUTINE_MARKERS: readonly string[] = [
  'refait le pansement',
  'pansement refait',
  'refection',
  'c est propre',
  'propre',
  'toilette',
  'ras',
  'rien a signaler',
  'change de position',
  'changement de position',
  'nursing',
  'bilan sanguin fait',
  'prelevement fait',
];

/** Indices d'un "à faire". */
export const TODO_MARKERS: readonly string[] = [
  'a faire',
  'prevu',
  'prevue',
  'prevoir',
  'a prevoir',
  'a surveiller',
  'surveiller',
  'a reevaluer',
  'reevaluer',
  'penser a',
  'a rappeler',
  'rappeler',
  'cette nuit',
  'demain',
  'a jeun',
  'bilan a',
  'a controler',
  'a confirmer',
];

/** Recherche de mots-clés sur texte normalisé, avec frontières de mots. */
export function containsKeyword(normalizedText: string, keyword: string): boolean {
  const k = normalize(keyword);
  if (k.length === 0) return false;
  return ` ${normalizedText} `.includes(` ${k} `);
}

export function findKeywords(normalizedText: string, keywords: readonly string[]): string[] {
  return keywords.filter((k) => containsKeyword(normalizedText, k));
}

/** Appareil le plus probable pour un texte (null si aucun indice). */
export function detectAppareil(text: string): Appareil | null {
  const n = normalize(text);
  let best: { appareil: Appareil; hits: number } | null = null;
  for (const [appareil, keywords] of Object.entries(APPAREIL_KEYWORDS) as [
    Appareil,
    readonly string[],
  ][]) {
    const hits = findKeywords(n, keywords).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { appareil, hits };
  }
  return best?.appareil ?? null;
}

const NEGATIONS = ['pas', 'pas de', 'non', 'sans', 'aucun', 'aucune', 'ni', 'plus de', 'jamais'];

/** Le mot-clé est-il nié juste avant ("pas de douleur", "non algique", "sans fièvre") ? */
export function isNegated(normalizedText: string, keyword: string): boolean {
  const k = normalize(keyword);
  const padded = ` ${normalizedText} `;
  let idx = padded.indexOf(` ${k} `);
  while (idx >= 0) {
    const before = padded.slice(0, idx).trim().split(' ').slice(-2);
    const negated = NEGATIONS.some((neg) => {
      const parts = neg.split(' ');
      return parts.length === 1 ? before.includes(neg) : before.join(' ') === neg;
    });
    if (!negated) return false;
    idx = padded.indexOf(` ${k} `, idx + 1);
  }
  return true;
}

const HYPERTHERMIA_RULE: TargetRule = {
  keywords: ['fievre'],
  label: 'Hyperthermie',
  appareil: 'general',
  severity: 'surveillance',
};
/** "elle a fait 38,9", "température à 39" : fièvre exprimée en chiffres. */
const FEVER_VALUE = /\b(fait|temperature|temp|t) (a )?(3[89]|4[0-2])( [0-9])?\b/;

/** Règle de cible déclenchée par un texte (la plus grave d'abord), en ignorant les négations. */
export function detectTargetRule(text: string): TargetRule | null {
  const n = normalize(text);
  for (const rule of TARGET_RULES) {
    if (findKeywords(n, rule.keywords).some((k) => !isNegated(n, k))) return rule;
  }
  if (FEVER_VALUE.test(n)) return HYPERTHERMIA_RULE;
  return null;
}

/** Gravité suggérée d'après le lexique (repli quand aucun classifieur n'est configuré). */
export function lexicalSeverity(text: string): SeverityLevel {
  return detectTargetRule(text)?.severity ?? 'routine';
}
