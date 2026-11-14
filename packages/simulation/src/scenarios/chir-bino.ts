import type { Consciousness, Device, Patient, ScenarioEvent, Vitals } from '@infirmier/domain';
import { patient, record, recordSource, scenarioDay } from '../helpers';
import { NURSES_CHIR, UNIT_CHIR } from '../hospital';
import { defineScenario } from '../scenario';

/**
 * SCÉNARIO DU FRONT « BINO » — Chirurgie, poste de jour du 14/11/2026.
 * Reprend à l'identique les données FICTIVES du prototype de l'équipe (branche demo,
 * `prototypes/bino/js/data.js`) : 11 patients, 3 IDE, constantes, dispositifs et les
 * 11 comptes rendus de démo, tapés au clavier, patient présélectionné, laissés « À relire ».
 */
const at = scenarioDay('2026-11-14');

/** Constantes du dossier (DPI simulé), relevées à `hhmm` le jour du scénario. */
function vitals(
  v: [number, number, boolean, number, number, number, number, Consciousness],
  hhmm: string,
): Vitals {
  const [respiratoryRate, spo2, onOxygen, systolic, diastolic, heartRate, temperature, cons] = v;
  return {
    respiratoryRate,
    spo2,
    onOxygen,
    systolic,
    diastolic,
    heartRate,
    temperature,
    consciousness: cons,
    measuredAt: at(hhmm),
    source: recordSource('vitals'),
  };
}

interface BinoSeed {
  room: string;
  sex: 'F' | 'M';
  firstName: string;
  lastName: string;
  birthDate: string;
  admittedAt: string;
  admissionReason: string;
  /** null = « Aucun ». */
  history: string | null;
  /** null = « Aucune connue ». */
  allergies: string | null;
  /** « Contact · BMR » = précautions complémentaires ; null = standard. */
  precautions: string | null;
  famille: string | null;
  prescription?: { text: string; time: string };
  /** Libellé, date de pose. */
  devices: [string, string][];
  vitals: Vitals;
}

function binoPatient(s: BinoSeed): Patient {
  const id = `chir-${s.room}`;
  const devices: Device[] = s.devices.map(([label, insertedAt], i) => ({
    id: `${id}-dispositif-${i + 1}`,
    label,
    insertedAt,
    source: recordSource('devices'),
  }));
  return patient({
    id,
    unitId: 'chir',
    room: s.room,
    lastName: s.lastName,
    firstName: s.firstName,
    sex: s.sex,
    birthDate: s.birthDate,
    admittedAt: s.admittedAt,
    admissionReason: s.admissionReason,
    history: s.history ?? undefined,
    vitals: s.vitals,
    devices,
    transverse: (t) => {
      t.allergies = s.allergies
        ? { status: 'connues', items: [record('allergies', s.allergies)] }
        : { status: 'aucune', items: [] };
      t.precautions = s.precautions
        ? { status: 'complementaires', items: [record('precautions', s.precautions)] }
        : { status: 'standard', items: [] };
      if (s.famille) t.famille.push(record('famille', s.famille));
      if (s.prescription) {
        t.prescriptions.push(
          record(
            'prescriptions',
            s.prescription.text,
            `Prescription médicale (DPI simulé) · ${s.prescription.time}`,
          ),
        );
      }
    },
  });
}

const VVP = 'Voie veineuse périphérique';

const PATIENTS: Patient[] = [
  binoPatient({
    room: '12',
    sex: 'M',
    firstName: 'Jean',
    lastName: 'Dupond',
    birthDate: '1958-03-12',
    admittedAt: at('07:00', -2),
    admissionReason: 'Post-opératoire de colectomie',
    history: 'HTA',
    allergies: 'Pénicilline',
    precautions: null,
    famille: 'Fille appelée à 14h, inquiète.',
    devices: [
      ['Drain abdominal', at('10:30', -2)],
      [VVP, at('08:15', -2)],
    ],
    vitals: vitals([24, 94, false, 98, 62, 108, 38.2, 'A'], '17:40'),
  }),
  binoPatient({
    room: '10',
    sex: 'F',
    firstName: 'Lucie',
    lastName: 'Berger',
    birthDate: '1967-06-21',
    admittedAt: at('07:00', -1),
    admissionReason: 'Cure de hernie inguinale',
    history: null,
    allergies: null,
    precautions: null,
    famille: null,
    devices: [['Cathéter veineux périphérique', at('09:00', -4)]],
    vitals: vitals([18, 95, false, 108, 70, 92, 37.0, 'A'], '16:30'),
  }),
  binoPatient({
    room: '15',
    sex: 'F',
    firstName: 'Claire',
    lastName: 'Laurent',
    birthDate: '1952-09-03',
    admittedAt: at('06:45', -1),
    admissionReason: 'Cholécystectomie',
    history: 'Diabète de type 2',
    allergies: null,
    precautions: 'Contact · BMR',
    famille: null,
    prescription: { text: 'Paracétamol 1 g IV toutes les 6 h', time: '17h10' },
    devices: [[VVP, at('08:00', -1)]],
    vitals: vitals([22, 95, false, 132, 78, 102, 38.4, 'A'], '17:15'),
  }),
  binoPatient({
    room: '7',
    sex: 'M',
    firstName: 'Paul',
    lastName: 'Moreau',
    birthDate: '1954-01-27',
    admittedAt: at('07:30', -4),
    admissionReason: 'Sigmoïdectomie',
    history: 'BPCO',
    allergies: null,
    precautions: null,
    famille: null,
    devices: [['Oxygène lunettes 2 L/min', at('11:00', -1)]],
    vitals: vitals([22, 94, true, 118, 70, 96, 37.6, 'A'], '15:45'),
  }),
  binoPatient({
    room: '21',
    sex: 'F',
    firstName: 'Odile',
    lastName: 'Perrin',
    birthDate: '1949-05-16',
    admittedAt: at('03:40', -1),
    admissionReason: 'Occlusion du grêle opérée',
    history: 'Insuffisance cardiaque',
    allergies: null,
    precautions: 'Contact · BMR',
    famille: null,
    devices: [
      ['Sonde nasogastrique', at('04:30', -1)],
      ['Voie veineuse centrale', at('06:00', -1)],
    ],
    vitals: vitals([20, 95, false, 104, 64, 98, 37.8, 'A'], '15:30'),
  }),
  binoPatient({
    room: '14',
    sex: 'M',
    firstName: 'Louis',
    lastName: 'Garnier',
    birthDate: '1941-02-08',
    admittedAt: at('18:20', -2),
    admissionReason: 'Fracture du col du fémur opérée',
    history: 'Troubles cognitifs légers',
    allergies: null,
    precautions: null,
    famille: 'Fils, personne de confiance.',
    devices: [],
    vitals: vitals([18, 96, false, 132, 80, 88, 37.2, 'C'], '13:15'),
  }),
  binoPatient({
    room: '18',
    sex: 'M',
    firstName: 'Hugo',
    lastName: 'Lambert',
    birthDate: '1999-07-30',
    admittedAt: at('02:10', -1),
    admissionReason: 'Appendicectomie',
    history: null,
    allergies: null,
    precautions: null,
    famille: null,
    devices: [],
    vitals: vitals([17, 97, false, 124, 76, 104, 38.4, 'A'], '14:40'),
  }),
  binoPatient({
    room: '3',
    sex: 'F',
    firstName: 'Jeanne',
    lastName: 'Keller',
    birthDate: '1945-10-11',
    admittedAt: at('07:15', -3),
    admissionReason: 'Prothèse totale de hanche',
    history: 'Ostéoporose',
    allergies: 'Iode',
    precautions: null,
    famille: "Fils présent l'après-midi.",
    devices: [],
    vitals: vitals([16, 97, false, 128, 72, 76, 38.1, 'A'], '16:00'),
  }),
  binoPatient({
    room: '9',
    sex: 'F',
    firstName: 'Nadia',
    lastName: 'Benali',
    birthDate: '1992-04-05',
    admittedAt: at('07:00'),
    admissionReason: 'Cholécystectomie en ambulatoire',
    history: null,
    allergies: null,
    precautions: null,
    famille: null,
    devices: [],
    vitals: vitals([16, 99, false, 118, 72, 78, 36.9, 'A'], '15:00'),
  }),
  binoPatient({
    room: '16',
    sex: 'F',
    firstName: 'Rose',
    lastName: 'Fontaine',
    birthDate: '1963-08-19',
    admittedAt: at('07:00', -1),
    admissionReason: 'Mastectomie',
    history: null,
    allergies: 'Latex',
    precautions: null,
    famille: null,
    devices: [['Drain de Redon', at('11:30', -1)]],
    vitals: vitals([14, 98, false, 126, 78, 74, 37.0, 'A'], '12:30'),
  }),
  binoPatient({
    room: '19',
    sex: 'M',
    firstName: 'Antoine',
    lastName: 'Petit',
    birthDate: '1981-03-02',
    admittedAt: at('21:30', -2),
    admissionReason: 'Appendicectomie',
    history: null,
    allergies: null,
    precautions: null,
    famille: null,
    devices: [],
    vitals: vitals([14, 98, false, 122, 76, 70, 36.8, 'A'], '16:00'),
  }),
];

/** Compte rendu de démo du prototype : tapé au clavier depuis la fiche, laissé « À relire ». */
function cr(
  hhmm: string,
  nurseId: string,
  room: string,
  label: string,
  text: string,
): ScenarioEvent {
  return {
    type: 'dictation',
    at: at(hhmm),
    label,
    nurseId,
    patientId: `chir-${room}`,
    inputMethod: 'keyboard',
    review: 'none',
    text,
    expect: { patientId: `chir-${room}` },
  };
}

export const chirBino = defineScenario({
  id: 'chir-bino',
  title: 'Chirurgie — journée de Martine, Sophie et Karim (front Bino)',
  description:
    'Onze patients en chirurgie, poste de jour. Les comptes rendus de l’équipe (8h10 → 16h00) sont tapés depuis la fiche patient et restent « À relire ». Constantes et NEWS2 du dossier : M. Dupond (chambre 12) se dégrade à 17h40.',
  tags: ['chirurgie', 'démo', 'Bino'],
  unitId: 'chir',
  startsAt: at('07:50'),
  units: [UNIT_CHIR],
  nurses: NURSES_CHIR,
  patients: PATIENTS,
  events: [
    cr(
      '08:10',
      'sophie',
      '12',
      'Chambre 12 : nuit calme, douleur',
      "Chambre 12, M. Dupond. Nuit calme selon l'équipe de nuit. Douleur abdominale à 4 sur 10 au réveil, j'ai donné le paracétamol à 8h. Pansement du drain sec. FR 18, sat 97, tension 125 sur 74, pouls 84, température 37,4.",
    ),
    cr(
      '14:05',
      'karim',
      '12',
      'Chambre 12 : douleur réévaluée, fille inquiète',
      "Chambre 12. Douleur réévaluée à 2 sur 10 à 9h après le paracétamol. Il a peu mangé à midi. Sa fille a appelé à 14h, inquiète, je l'ai rassurée.",
    ),
    cr(
      '10:20',
      'martine',
      '7',
      'Chambre 7 : encombré, kiné',
      'Chambre 7, M. Moreau. Sous lunettes à 2 litres, sat 94. Encombré ce matin, kiné respiratoire faite à 10h. Après la kiné, il crache facilement et respire mieux.',
    ),
    cr(
      '13:15',
      'martine',
      '14',
      'Chambre 14 : désorienté',
      "Chambre 14, M. Garnier. Désorienté ce matin, il a essayé de se lever seul. J'ai remonté les barrières et prévenu son fils. Plus calme à 13h après le repas.",
    ),
    cr(
      '15:30',
      'martine',
      '21',
      'Chambre 21 : SNG, ionogramme',
      'Chambre 21, Mme Perrin. Sonde nasogastrique en place, 300 ml de liquide gastrique. Pas de transit. Douleur à 3 sur 10. Ionogramme prélevé à 15h, résultat à récupérer.',
    ),
    cr(
      '15:20',
      'sophie',
      '15',
      'Chambre 15 : fièvre, hémocultures',
      'Chambre 15, Mme Laurent. Température 38,2 avec frissons. Hémocultures prélevées, médecin prévenu. Frissons calmés à 16h, température 38,0.',
    ),
    cr(
      '11:30',
      'sophie',
      '19',
      'Chambre 19 : bonne journée, sortie demain',
      'Chambre 19, M. Petit. Bonne journée, il mange normalement, douleur à 1 sur 10. Sortie prévue demain, ordonnance à préparer.',
    ),
    cr(
      '09:40',
      'sophie',
      '9',
      'Chambre 9 : ambulatoire, sortie à 17h',
      "Chambre 9, Mme Benali. Ambulatoire, elle a uriné et mangé une compote. Douleur à 2 sur 10. Sortie prévue à 17h si l'interne valide.",
    ),
    cr(
      '16:00',
      'karim',
      '3',
      'Chambre 3 : lever reporté, 38,1',
      'Chambre 3, Mme Keller. Premier lever au fauteuil reporté, elle était fatiguée. Température 38,1. Lever à prévoir demain matin.',
    ),
    cr(
      '12:30',
      'karim',
      '16',
      'Chambre 16 : Redon, a pleuré',
      'Chambre 16, Mme Fontaine. Pansement propre, drain de Redon 40 ml. Douleur à 2 sur 10. Elle a pleuré en voyant la cicatrice, je suis resté avec elle.',
    ),
    cr(
      '14:40',
      'karim',
      '18',
      'Chambre 18 : fièvre, interne prévenu',
      "Chambre 18, M. Lambert. Température 38,4, pouls 104. J'ai prévenu l'interne, hémocultures prélevées. À recontrôler à 18h.",
    ),
    {
      type: 'narration',
      at: at('17:45'),
      text: 'Fin d’après-midi : constantes de M. Dupond relevées à 17h40 (NEWS2 7). Ouvre Transmissions › Tous pour préparer la relève de 19h45.',
    },
  ],
  samples: [
    {
      label: 'M. Dupond se dégrade',
      patientId: 'chir-12',
      text: "Chambre 12, M. Dupond. Il est plus essoufflé qu'à 14h, FR 24, sat 94 en air ambiant, tension 98 sur 62, pouls 108, température 38,2. Conscient, il se plaint du ventre à 6 sur 10. J'ai appelé l'interne, il passe dans un quart d'heure. J'ai donné le paracétamol à 17h. Pansement du drain refait, propre.",
    },
    {
      label: 'Mme Berger, journée calme',
      patientId: 'chir-10',
      text: "Chambre 10, Mme Berger. Journée calme, elle a bien mangé, premier lever avec aide ce matin, bien toléré. Douleur à 5 sur 10 à 11h, j'ai donné le tramadol prescrit, réévaluée à 1 sur 10 à midi. Le cathéter a 4 jours. Tension 112 sur 70, pouls 84, sat 97, température 36,9.",
    },
  ],
});
