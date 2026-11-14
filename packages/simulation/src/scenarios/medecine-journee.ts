import { patient, record, scenarioDay } from '../helpers';
import { NURSES_MEDECINE, UNIT_MEDECINE } from '../hospital';
import { defineScenario } from '../scenario';

/**
 * Médecine interne, poste de jour du 14/11/2026 (trame « sommaire »).
 * Douze chambres : Claire a les chambres 1 à 6, Yanis les chambres 7 à 12.
 * Dictées de couloir : DAR complète (douleur, hypoglycémie), R manquant
 * (vomissements, fièvre, confusion), chute, routine seule, appel de la famille,
 * « à faire » pour la nuit. Mme Martin (ch. 3) et Mme Martins (ch. 9) testent
 * le rattachement patient : une dictée ne cite que « madame Martin ».
 * Tout est fictif.
 */
const at = scenarioDay('2026-11-14');

export const medecineJournee = defineScenario({
  id: 'medecine-journee',
  title: 'Médecine — journée de Claire et Yanis (12 chambres)',
  description:
    'Douze chambres en médecine interne, poste de jour. Claire et Yanis dictent dans le couloir : douleur réévaluée, vomissements sans résultat, chute, fièvre avec hémocultures, confusion, appel de la famille, glycémie à faire pour la nuit. Mme Martin (chambre 3) et Mme Martins (chambre 9) testent le rattachement patient.',
  tags: ['médecine', 'trame sommaire', 'homonymes'],
  unitId: 'medecine',
  startsAt: at('07:50'),
  units: [UNIT_MEDECINE],
  nurses: NURSES_MEDECINE,
  patients: [
    patient({
      id: 'med-1',
      unitId: 'medecine',
      room: '1',
      lastName: 'Lemaire',
      firstName: 'Huguette',
      sex: 'F',
      birthDate: '1941-03-08',
      admittedAt: at('16:40', -2),
      admissionReason: 'Pyélonéphrite aiguë droite',
      history: 'Fièvre et douleurs lombaires depuis 48 h. ECBU : E. coli BLSE. Antibiothérapie IV.',
      assignedNurseId: 'claire',
      transverse: (t) => {
        t.allergies = {
          status: 'connues',
          items: [record('allergies', 'Allergie aux sulfamides')],
        };
        t.precautions = {
          status: 'complementaires',
          items: [record('precautions', 'Contact (BMR : E. coli BLSE)')],
        };
        t.engagement = { status: 'pas-de-limitation', items: [] };
        t.examens.push(record('examens', 'Échographie rénale lundi matin'));
      },
    }),
    patient({
      id: 'med-2',
      unitId: 'medecine',
      room: '2',
      lastName: 'Giraudeau',
      firstName: 'René',
      sex: 'M',
      birthDate: '1961-07-22',
      admittedAt: at('11:20', -3),
      admissionReason: 'Dermohypodermite de la jambe gauche',
      history: 'Diabétique de type 2. Limites de l’érythème tracées au feutre à l’entrée.',
      assignedNurseId: 'claire',
      transverse: (t) => {
        t.allergies = { status: 'aucune', items: [] };
        t.precautions = {
          status: 'complementaires',
          items: [record('precautions', 'Contact (BMR : SARM)')],
        };
        t.engagement = { status: 'pas-de-limitation', items: [] };
      },
    }),
    patient({
      id: 'med-3',
      unitId: 'medecine',
      room: '3',
      lastName: 'Martin',
      firstName: 'Odette',
      sex: 'F',
      birthDate: '1940-11-02',
      admittedAt: at('09:00', -9),
      admissionReason: 'AVC ischémique sylvien gauche, en attente de place en SSR',
      history: 'Hémiparésie droite et aphasie partielle à l’entrée. Dossier SSR envoyé le 10/11.',
      assignedNurseId: 'claire',
      transverse: (t) => {
        t.allergies = { status: 'aucune', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
        t.famille.push(record('famille', 'Son mari passe tous les après-midi'));
        t.personneDeConfiance.push(record('personneDeConfiance', 'Son mari, M. Martin'));
      },
    }),
    patient({
      id: 'med-4',
      unitId: 'medecine',
      room: '4',
      lastName: 'Vasseur',
      firstName: 'Germaine',
      sex: 'F',
      birthDate: '1932-05-17',
      admittedAt: at('20:15', -1),
      admissionReason: 'Chute à domicile, bilan de chute',
      history: 'Retrouvée au sol par son aide à domicile. Fibrillation atriale sous anticoagulant.',
      assignedNurseId: 'claire',
      transverse: (t) => {
        t.allergies = { status: 'inconnu', items: [] };
        t.precautions = { status: 'standard', items: [] };
      },
    }),
    patient({
      id: 'med-5',
      unitId: 'medecine',
      room: '5',
      lastName: 'Delorme',
      firstName: 'Gérard',
      sex: 'M',
      birthDate: '1949-01-30',
      admittedAt: at('14:30', -1),
      admissionReason: 'Hyponatrémie sévère (121 mmol/L)',
      history: 'Diurétique thiazidique suspendu à l’entrée. Restriction hydrique.',
      assignedNurseId: 'claire',
      transverse: (t) => {
        t.allergies = {
          status: 'connues',
          items: [record('allergies', 'Allergie aux AINS')],
        };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
      },
    }),
    patient({
      id: 'med-6',
      unitId: 'medecine',
      room: '6',
      lastName: 'Aubert',
      firstName: 'Simone',
      sex: 'F',
      birthDate: '1945-08-14',
      admittedAt: at('18:00', -4),
      admissionReason: 'Décompensation cardiaque globale',
      history: 'Insuffisance cardiaque connue, prise de 6 kg en 10 jours. Pesée quotidienne.',
      assignedNurseId: 'claire',
      transverse: (t) => {
        t.allergies = { status: 'aucune', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
        t.examens.push(record('examens', 'Échographie cardiaque lundi'));
      },
    }),
    patient({
      id: 'med-7',
      unitId: 'medecine',
      room: '7',
      lastName: 'Tessier',
      firstName: 'Alain',
      sex: 'M',
      birthDate: '1958-09-05',
      admittedAt: at('15:00', -2),
      admissionReason: 'Amaigrissement de 8 kg et altération de l’état général, bilan étiologique',
      history: 'Perte d’appétit depuis 3 mois. Compléments nutritionnels oraux.',
      assignedNurseId: 'yanis',
      transverse: (t) => {
        t.allergies = { status: 'inconnu', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
        t.examens.push(record('examens', 'Scanner thoraco-abdomino-pelvien injecté lundi 10h'));
      },
    }),
    patient({
      id: 'med-8',
      unitId: 'medecine',
      room: '8',
      lastName: 'Rolland',
      firstName: 'Kévin',
      sex: 'M',
      birthDate: '1981-02-11',
      admittedAt: at('03:40', -3),
      admissionReason: 'Diabète de type 1 déséquilibré (acidocétose résolue)',
      history: 'Schéma basal-bolus en cours d’adaptation. Hypoglycémies nocturnes à domicile.',
      assignedNurseId: 'yanis',
      transverse: (t) => {
        t.allergies = { status: 'aucune', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
      },
    }),
    patient({
      id: 'med-9',
      unitId: 'medecine',
      room: '9',
      lastName: 'Martins',
      firstName: 'Lucinda',
      sex: 'F',
      birthDate: '1955-06-21',
      admittedAt: at('22:30', -2),
      admissionReason: 'Pneumopathie communautaire droite',
      history: 'BPCO. Oxygène 2 L/min aux lunettes.',
      assignedNurseId: 'yanis',
      transverse: (t) => {
        t.allergies = {
          status: 'connues',
          items: [record('allergies', 'Allergie à la pénicilline (urticaire)')],
        };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
        t.famille.push(record('famille', 'Sa fille appelle chaque soir'));
      },
    }),
    patient({
      id: 'med-10',
      unitId: 'medecine',
      room: '10',
      lastName: 'Renaud',
      firstName: 'Gilbert',
      sex: 'M',
      birthDate: '1950-12-03',
      admittedAt: at('19:10', -1),
      admissionReason: 'Anémie à 7,2 g/dL, suspicion de saignement digestif haut',
      history: 'Sous antiagrégant plaquettaire. Transfusion de 2 culots prescrite.',
      assignedNurseId: 'yanis',
      transverse: (t) => {
        t.allergies = { status: 'aucune', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
        t.examens.push(
          record('examens', 'Fibroscopie œso-gastro-duodénale demain 9h, à jeun dès minuit'),
        );
      },
    }),
    patient({
      id: 'med-11',
      unitId: 'medecine',
      room: '11',
      lastName: 'Navarro',
      firstName: 'Sandrine',
      sex: 'F',
      birthDate: '1979-04-26',
      admittedAt: at('10:45', -1),
      admissionReason: 'Insuffisance rénale aiguë sur déshydratation (gastro-entérite)',
      history: 'Vomissements et diarrhées depuis 4 jours, créatinine à 210 µmol/L à l’entrée.',
      assignedNurseId: 'yanis',
      transverse: (t) => {
        t.allergies = { status: 'inconnu', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
      },
    }),
    patient({
      id: 'med-12',
      unitId: 'medecine',
      room: '12',
      lastName: 'Poulain',
      firstName: 'Marguerite',
      sex: 'F',
      birthDate: '1934-01-19',
      admittedAt: at('17:20', -5),
      admissionReason: 'Altération de l’état général, démence évoluée (venue d’EHPAD)',
      history: 'Troubles de la déglutition, alimentation mixée. Perte d’autonomie progressive.',
      assignedNurseId: 'yanis',
      transverse: (t) => {
        t.allergies = { status: 'aucune', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = {
          status: 'lata',
          items: [
            record(
              'engagement',
              'LATA : pas de transfert en réanimation, pas de massage cardiaque (collégiale du 12/11)',
            ),
          ],
        };
        t.famille.push(record('famille', 'Le fils et la fille passent en fin de journée'));
        t.personneDeConfiance.push(record('personneDeConfiance', 'Son fils, M. Poulain'));
      },
    }),
  ],
  events: [
    {
      type: 'narration',
      at: at('07:55'),
      text: 'Relève de 7h45 terminée. Claire prend les chambres 1 à 6, Yanis les chambres 7 à 12, Nadia (AS) tourne sur tout le secteur. Attention aux noms proches : Mme Martin (chambre 3) et Mme Martins (chambre 9).',
    },
    {
      type: 'dictation',
      at: at('09:20'),
      label: 'Ch. 1 : douleur lombaire, antalgique réévalué',
      nurseId: 'claire',
      text: 'Alors chambre 1, madame Lemaire. Vers 8h30 elle a eu une douleur lombaire droite à 6 sur 10, j’ai donné le paracétamol 1 g per os à 8h45. Réévaluée à 9h15, EVA à 2, elle est soulagée. Elle a uriné, les urines sont encore un peu troubles.',
      review: 'validate',
      expect: {
        patientId: 'med-1',
        targets: [{ labelAnyOf: ['douleur', 'antalgi'], missingResult: false }],
        forbidden: ['morphine', 'tramadol', 'fièvre'],
      },
    },
    {
      type: 'dictation',
      at: at('09:40'),
      label: 'Ch. 7 : poids, scanner de lundi',
      nurseId: 'yanis',
      text: 'Chambre 7, monsieur Tessier. Pesé ce matin à 54,2 kilos. Il a pris la moitié de son petit-déj et un complément, il dit qu’il a pas d’appétit. Le scanner est prévu lundi à 10h, faudra penser à vérifier la créat avant l’injection.',
      review: 'defer',
      expect: {
        patientId: 'med-7',
        todosAnyOf: ['créat', 'creat', 'scanner'],
        forbidden: ['à jeun', 'iode'],
      },
    },
    {
      type: 'dictation',
      at: at('10:05'),
      label: 'Ch. 10 : transfusion, méléna, à jeun',
      nurseId: 'yanis',
      text: 'Chambre 10, monsieur Renaud. Le premier culot est passé de 8h30 à 10h, bien toléré, constantes stables. Je pose le deuxième vers 10h30. Par contre il a fait un méléna ce matin, selles bien noires, j’ai prévenu l’interne. Et il est à jeun à partir de minuit pour la fibro de demain 9h.',
      review: 'validate',
      expect: {
        patientId: 'med-10',
        targets: [{ labelAnyOf: ['méléna', 'melena', 'saignement', 'selle', 'hémorragie'] }],
        todosAnyOf: ['jeun', 'fibro'],
        forbidden: ['7,2', 'frissons', 'hémoglobine'],
      },
    },
    {
      type: 'dictation',
      at: at('10:40'),
      label: 'Ch. 5 : confusion, natrémie',
      nurseId: 'claire',
      text: 'Chambre 5, monsieur Delorme. Il est confus ce matin, désorienté dans le temps, il cherche sa femme et il a essayé deux fois d’enlever sa perf. La natrémie est à 124 sur le bilan de 6h. J’ai prévenu l’interne, il passe le voir avant midi. On maintient la restriction hydrique à 750 ml.',
      review: 'defer',
      expect: {
        patientId: 'med-5',
        targets: [
          {
            labelAnyOf: ['confusion', 'confus', 'désorientation', 'desorientation'],
            missingResult: true,
          },
        ],
        forbidden: ['contention', 'Haldol', 'chute', '121'],
      },
    },
    {
      type: 'dictation',
      at: at('11:30'),
      label: 'Ch. 11 : vomissements (résultat non dit)',
      nurseId: 'yanis',
      text: 'Chambre 11, madame Navarro. Elle a encore vomi deux fois depuis 10h, c’était bilieux, pas de sang. J’ai passé le Primpéran IV prescrit vers 11h15. La perf de réhydratation coule bien, elle en est à 2 litres sur 24 heures.',
      review: 'none',
      expect: {
        patientId: 'med-11',
        targets: [{ labelAnyOf: ['vomi', 'nausée', 'nausee'], missingResult: true }],
        forbidden: ['diarrhée', 'Zophren', 'soulagée'],
      },
    },
    {
      type: 'dictation',
      at: at('12:15'),
      label: 'Ch. 6 : routine seule',
      nurseId: 'claire',
      text: 'Chambre 6, madame Aubert, RAS. Toilette faite au lavabo avec un peu d’aide. Pesée ce matin à 71,4 kilos. Pansement de la VVP refait, c’est propre.',
      review: 'none',
      expect: {
        patientId: 'med-6',
        routineAnyOf: ['toilette', 'pansement'],
        forbidden: ['dyspnée', 'Lasix'],
      },
    },
    {
      type: 'dictation',
      at: at('13:20'),
      label: 'Ch. 4 : retrouvée au sol',
      nurseId: 'claire',
      text: 'Chambre 4, madame Vasseur. Elle a été retrouvée au sol vers 13h au pied du lit, elle voulait aller aux toilettes toute seule. Pas de perte de connaissance, pas de plaie, elle dit qu’elle a mal nulle part. L’interne est passé l’examiner, on l’a recouchée, lit en position basse et sonnette à portée de main. Elle est sous anticoagulant, donc surveillance neuro toutes les 2 heures cette nuit.',
      review: 'validate',
      expect: {
        patientId: 'med-4',
        targets: [{ labelAnyOf: ['chute', 'au sol'] }],
        todosAnyOf: ['neuro', 'surveillance'],
        forbidden: ['fracture', 'scanner', 'hématome'],
      },
    },
    {
      type: 'priority',
      at: at('13:25'),
      label: '★ sur la chambre 4 (chute sous anticoagulant)',
      patientId: 'med-4',
      nurseId: 'claire',
      starred: true,
    },
    {
      type: 'dictation',
      at: at('14:20'),
      label: 'Ch. 9 : fièvre, hémocultures',
      nurseId: 'yanis',
      text: 'Chambre 9, madame Martins. Elle a fait un pic à 38,8 vers 14h avec des frissons. J’ai fait deux paires d’hémocultures et j’ai prévenu l’interne. Paracétamol 1 g donné à 14h15. Sinon elle sature à 93 sous 2 litres, comme ce matin.',
      review: 'validate',
      expect: {
        patientId: 'med-9',
        targets: [
          {
            labelAnyOf: ['hyperthermie', 'fièvre', 'fievre', 'température', 'temperature'],
            missingResult: true,
          },
        ],
        forbidden: ['37,', 'ECBU', 'amoxicilline'],
      },
    },
    {
      type: 'dictation',
      at: at('15:10'),
      label: '« Madame Martin » sans chambre (ambiguë)',
      nurseId: 'claire',
      text: 'Euh, madame Martin, elle a quasiment rien mangé ce midi, juste le laitage. Elle dit qu’elle a pas faim. J’ai noté sur la feuille de surveillance alimentaire. Faudra la peser demain matin.',
      review: 'none',
      expect: {
        ambiguous: true,
        todosAnyOf: ['peser', 'pesée', 'pesee', 'poids'],
        forbidden: ['chambre 3', 'chambre 9', 'Odette', 'Lucinda'],
      },
    },
    {
      type: 'dictation',
      at: at('15:40'),
      label: 'Ch. 12 : appel du fils',
      nurseId: 'yanis',
      text: 'Chambre 12, madame Poulain. Son fils a appelé vers 15h, je lui ai expliqué qu’elle est plus somnolente depuis hier et qu’elle boit peu. Il passe ce soir avec sa sœur, faudrait prévoir que le médecin les voie. Pour rappel elle est en LATA, pas de transfert en réa.',
      review: 'validate',
      expect: {
        patientId: 'med-12',
        todosAnyOf: ['médecin', 'medecin'],
        forbidden: ['palliatif', 'décès', 'morphine'],
      },
    },
    {
      type: 'dictation',
      at: at('16:00'),
      label: 'Ch. 3 : kiné, attente SSR',
      nurseId: 'claire',
      text: 'Chambre 3, madame Martin. La kiné est passée, elle a fait quelques pas dans le couloir avec le déambulateur. Elle trouve un peu mieux ses mots qu’hier. Toujours pas de place en SSR, l’assistante sociale relance lundi.',
      review: 'defer',
      expect: {
        patientId: 'med-3',
        routineAnyOf: ['kiné', 'kine'],
        forbidden: ['Martins', 'chute', 'transfert prévu'],
      },
    },
    {
      type: 'dictation',
      at: at('16:30'),
      label: 'Ch. 2 : RAS, pansement',
      nurseId: 'claire',
      text: 'Chambre 2, monsieur Giraudeau, RAS. Pansement de la jambe refait, c’est propre. Il s’est levé au fauteuil cet aprem, il a bien mangé.',
      review: 'validate',
      expect: {
        patientId: 'med-2',
        routineAnyOf: ['pansement'],
        forbidden: ['fièvre', 'rougeur', 'érythème'],
      },
    },
    {
      type: 'dictation',
      at: at('17:30'),
      label: 'Ch. 8 : hypoglycémie resucrée, glycémie à 22h',
      nurseId: 'yanis',
      text: 'Chambre 8, monsieur Rolland. Il a fait une hypoglycémie à 0,54 vers 17h, il était tout en sueur. Je lui ai donné un jus d’orange et deux sucres, contrôle à 17h20 à 1,18, c’est OK, il va mieux. L’interne a baissé la Lantus du soir à 16 unités. Glycémie à 22h à faire, et à 3h si elle est sous 1,20.',
      review: 'validate',
      expect: {
        patientId: 'med-8',
        targets: [
          {
            labelAnyOf: ['hypoglycémie', 'hypoglycemie', 'glycémi', 'glycemi'],
            missingResult: false,
          },
        ],
        todosAnyOf: ['glycémie', 'glycemie', '22h'],
        forbidden: ['glucagon', 'G30', '0,45'],
      },
    },
    {
      type: 'narration',
      at: at('19:40'),
      text: 'Relève de 19h45 : ouvre la vue Relève. La chambre 4 est étoilée (chute sous anticoagulant), la dictée « madame Martin » attend qu’on choisisse la bonne patiente, la chambre 11 attend un résultat et la chambre 8 a une glycémie à faire à 22h.',
    },
  ],
});
