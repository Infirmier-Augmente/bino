// Données entièrement fictives pour la démo. Aucune donnée réelle de patient.
// Service de chirurgie, poste de jour. L'infirmière qui utilise l'app : Martine Dubois (IDE).

// Soignants simulés : l'avatar permet de passer de l'un à l'autre pour la démo.
export const NURSES = ['Martine Dubois · IDE', 'Sophie Lemoine · IDE', 'Karim Haddad · IDE'];
export const DEFAULT_NURSE = NURSES[0];

const vit = (fr, spo2, o2, pas, pad, fc, temp, cons = 'A', at = '16h') => ({
  fr,
  spo2,
  o2,
  pas,
  pad,
  fc,
  temp,
  cons,
  at,
  src: 'saisie',
});
const morning = (v, patch = {}) => ({ ...v, ...patch, at: '8h' });

function patient(id, ch, nom, age, motif, more) {
  return {
    id,
    fhirId: `bino-${id}`,
    ch,
    nom,
    age,
    motif,
    atcd: 'Aucun',
    allergies: 'Aucune connue',
    precautions: '',
    famille: '',
    taches: [],
    disp: [],
    rx: null,
    ...more,
  };
}

export function seed() {
  const v12 = vit(24, 94, false, 98, 62, 108, 38.2, 'A', '17h40');
  const v10 = vit(18, 95, false, 108, 70, 92, 37.0, 'A', '16h30');
  const v15 = vit(22, 95, false, 132, 78, 102, 38.4, 'A', '17h15');
  const v7 = vit(22, 94, true, 118, 70, 96, 37.6, 'A', '15h45');
  const v21 = vit(20, 95, false, 104, 64, 98, 37.8, 'A', '15h30');
  const v14 = vit(18, 96, false, 132, 80, 88, 37.2, 'C', '13h15');
  const v18 = vit(17, 97, false, 124, 76, 104, 38.4, 'A', '14h40');
  const v3 = vit(16, 97, false, 128, 72, 76, 38.1, 'A', '16h');
  const v9 = vit(16, 99, false, 118, 72, 78, 36.9, 'A', '15h');
  const v16 = vit(14, 98, false, 126, 78, 74, 37.0, 'A', '12h30');
  const v19 = vit(14, 98, false, 122, 76, 70, 36.8, 'A', '16h');
  return {
    patients: [
      patient('p12', '12', 'M. Jean Dupond', 68, 'J2 post-opératoire de colectomie', {
        atcd: 'HTA',
        allergies: 'Pénicilline',
        famille: 'Fille appelée à 14h, inquiète.',
        v: v12,
        prev: morning(v12, { fr: 18, spo2: 97, pas: 125, pad: 74, fc: 84, temp: 37.4 }),
        taches: [{ t: 'Constantes à recontrôler dans 15 min', done: false }],
        disp: [
          { l: 'Drain abdominal', j: 2 },
          { l: 'Voie veineuse périphérique', j: 2 },
        ],
      }),
      patient('p10', '10', 'Mme Lucie Berger', 59, 'Cure de hernie inguinale, J1', {
        v: v10,
        prev: morning(v10, { pas: 118, pad: 72, fc: 80, temp: 36.9 }),
        disp: [{ l: 'Cathéter veineux périphérique', j: 4 }],
      }),
      patient('p15', '15', 'Mme Claire Laurent', 74, 'Cholécystectomie, J1', {
        atcd: 'Diabète de type 2',
        precautions: 'Contact · BMR',
        v: v15,
        prev: morning(v15, { fr: 17, spo2: 96, pas: 130, pad: 76, fc: 88, temp: 37.6 }),
        disp: [{ l: 'Voie veineuse périphérique', j: 1 }],
        rx: { t: 'Paracétamol 1 g IV toutes les 6 h', at: '17h10' },
      }),
      patient('p7', '7', 'M. Paul Moreau', 72, 'Sigmoïdectomie, J4', {
        atcd: 'BPCO',
        v: v7,
        prev: morning(v7, { fr: 20, spo2: 93 }),
        disp: [{ l: 'Oxygène lunettes 2 L/min', j: 1 }],
      }),
      patient('p21', '21', 'Mme Odile Perrin', 77, 'Occlusion du grêle opérée, J1', {
        atcd: 'Insuffisance cardiaque',
        precautions: 'Contact · BMR',
        v: v21,
        prev: morning(v21, { fc: 90, temp: 37.4 }),
        disp: [
          { l: 'Sonde nasogastrique', j: 1 },
          { l: 'Voie veineuse centrale', j: 1 },
        ],
      }),
      patient('p14', '14', 'M. Louis Garnier', 85, 'Fracture du col du fémur opérée, J2', {
        atcd: 'Troubles cognitifs légers',
        famille: 'Fils, personne de confiance.',
        v: v14,
        prev: morning(v14, { cons: 'A' }),
      }),
      patient('p18', '18', 'M. Hugo Lambert', 27, 'Appendicectomie, J1', {
        v: v18,
        prev: morning(v18, { fc: 86, temp: 37.5 }),
      }),
      patient('p3', '3', 'Mme Jeanne Keller', 81, 'Prothèse totale de hanche, J3', {
        atcd: 'Ostéoporose',
        allergies: 'Iode',
        famille: "Fils présent l'après-midi.",
        v: v3,
        prev: morning(v3, { pas: 126, pad: 70, fc: 74, temp: 37.2 }),
      }),
      patient('p9', '9', 'Mme Nadia Benali', 34, 'Cholécystectomie en ambulatoire, J0', {
        v: v9,
        prev: morning(v9),
      }),
      patient('p16', '16', 'Mme Rose Fontaine', 63, 'Mastectomie, J1', {
        allergies: 'Latex',
        v: v16,
        prev: morning(v16),
        disp: [{ l: 'Drain de Redon', j: 1 }],
      }),
      patient('p19', '19', 'M. Antoine Petit', 45, 'Appendicectomie, J2', {
        v: v19,
        prev: morning(v19, { pas: 120, pad: 74, fc: 72, temp: 36.9 }),
      }),
    ],
    trans: [],
    ack: {},
    addenda: [],
    seq: 1,
  };
}

// Dictées d'exemple, proposées dans la fiche patient pour la démo.
export const EXAMPLES = [
  {
    pid: 'p12',
    label: 'M. Dupond se dégrade',
    text: "Chambre 12, M. Dupond. Il est plus essoufflé qu'à 14h, FR 24, sat 94 en air ambiant, tension 98 sur 62, pouls 108, température 38,2. Conscient, il se plaint du ventre à 6 sur 10. J'ai appelé l'interne, il passe dans un quart d'heure. J'ai donné le paracétamol à 17h. Pansement du drain refait, propre.",
  },
  {
    pid: 'p10',
    label: 'Mme Berger, journée calme',
    text: "Chambre 10, Mme Berger. Journée calme, elle a bien mangé, premier lever avec aide ce matin, bien toléré. Douleur à 5 sur 10 à 11h, j'ai donné le tramadol prescrit, réévaluée à 1 sur 10 à midi. Le cathéter a 4 jours. Tension 112 sur 70, pouls 84, sat 97, température 36,9.",
  },
];

// Comptes rendus de la journée (soignants et patients fictifs).
// En mode local ils remplissent l'app au premier lancement ; dans Claude, la base partagée
// est remplie une fois avec les mêmes textes.
const cr = (id, pid, hm, byName, text) => {
  const [h, m] = hm.split(':');
  return {
    id,
    pid,
    at: new Date(`2026-11-14T${h.padStart(2, '0')}:${m}:00+01:00`).toISOString(),
    t: `${Number(h)}h${m}`,
    byName,
    text,
  };
};
const [MARTINE, SOPHIE, KARIM] = NURSES;

export const SEED_CR = [
  cr(
    'seed-12a',
    'p12',
    '08:10',
    SOPHIE,
    "Chambre 12, M. Dupond. Nuit calme selon l'équipe de nuit. Douleur abdominale à 4 sur 10 au réveil, j'ai donné le paracétamol à 8h. Pansement du drain sec. FR 18, sat 97, tension 125 sur 74, pouls 84, température 37,4.",
  ),
  cr(
    'seed-12b',
    'p12',
    '14:05',
    KARIM,
    "Chambre 12. Douleur réévaluée à 2 sur 10 à 9h après le paracétamol. Il a peu mangé à midi. Sa fille a appelé à 14h, inquiète, je l'ai rassurée.",
  ),
  cr(
    'seed-7a',
    'p7',
    '10:20',
    MARTINE,
    'Chambre 7, M. Moreau. Sous lunettes à 2 litres, sat 94. Encombré ce matin, kiné respiratoire faite à 10h. Après la kiné, il crache facilement et respire mieux.',
  ),
  cr(
    'seed-14a',
    'p14',
    '13:15',
    MARTINE,
    "Chambre 14, M. Garnier. Désorienté ce matin, il a essayé de se lever seul. J'ai remonté les barrières et prévenu son fils. Plus calme à 13h après le repas.",
  ),
  cr(
    'seed-21a',
    'p21',
    '15:30',
    MARTINE,
    'Chambre 21, Mme Perrin. Sonde nasogastrique en place, 300 ml de liquide gastrique. Pas de transit. Douleur à 3 sur 10. Ionogramme prélevé à 15h, résultat à récupérer.',
  ),
  cr(
    'seed-15a',
    'p15',
    '15:20',
    SOPHIE,
    'Chambre 15, Mme Laurent. Température 38,2 avec frissons. Hémocultures prélevées, médecin prévenu. Frissons calmés à 16h, température 38,0.',
  ),
  cr(
    'seed-19a',
    'p19',
    '11:30',
    SOPHIE,
    'Chambre 19, M. Petit. Bonne journée, il mange normalement, douleur à 1 sur 10. Sortie prévue demain, ordonnance à préparer.',
  ),
  cr(
    'seed-9a',
    'p9',
    '09:40',
    SOPHIE,
    "Chambre 9, Mme Benali. Ambulatoire, elle a uriné et mangé une compote. Douleur à 2 sur 10. Sortie prévue à 17h si l'interne valide.",
  ),
  cr(
    'seed-3a',
    'p3',
    '16:00',
    KARIM,
    'Chambre 3, Mme Keller. Premier lever au fauteuil reporté, elle était fatiguée. Température 38,1. Lever à prévoir demain matin.',
  ),
  cr(
    'seed-16a',
    'p16',
    '12:30',
    KARIM,
    'Chambre 16, Mme Fontaine. Pansement propre, drain de Redon 40 ml. Douleur à 2 sur 10. Elle a pleuré en voyant la cicatrice, je suis resté avec elle.',
  ),
  cr(
    'seed-18a',
    'p18',
    '14:40',
    KARIM,
    "Chambre 18, M. Lambert. Température 38,4, pouls 104. J'ai prévenu l'interne, hémocultures prélevées. À recontrôler à 18h.",
  ),
];
