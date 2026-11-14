import { patient, record, scenarioDay } from '../helpers';
import { NURSES_REA, UNIT_REA } from '../hospital';
import { defineScenario } from '../scenario';

/**
 * SCÉNARIO DE RÉFÉRENCE — Réanimation, poste de jour du 14/11/2026.
 * Construit sur le kit Foch : exemple A (dictée de 16h30, Box 12) et
 * exemple B (fiche de relève attendue pour l'équipe de nuit).
 * Le Box 11 reprend le compte rendu réel anonymisé ("suivi nuit") et son jargon.
 */
const at = scenarioDay('2026-11-14');

export const reaBox12 = defineScenario({
  id: 'rea-box12',
  title: 'Réa — journée de Martine (exemples A et B du kit)',
  description:
    'Quatre box en réanimation, poste de jour. Martine dicte au fil de l’eau ; à 16h30 elle dicte l’exemple A du kit (Box 12). À 19h45, la fiche du Box 12 doit ressembler à l’exemple B.',
  tags: ['réanimation', 'démo', 'kit Foch'],
  unitId: 'rea',
  startsAt: at('07:50'),
  units: [UNIT_REA],
  nurses: NURSES_REA,
  patients: [
    patient({
      id: 'rea-10',
      unitId: 'rea',
      room: '10',
      lastName: 'Bernard',
      firstName: 'Colette',
      sex: 'F',
      birthDate: '1952-06-18',
      admittedAt: at('22:10', -3),
      admissionReason: 'Choc septique sur pneumopathie',
      history: 'Admise aux urgences pour fièvre et hypotension, intubée à J0.',
      assignedNurseId: 'martine',
      transverse: (t) => {
        t.allergies = {
          status: 'connues',
          items: [record('allergies', 'Allergie à la pénicilline')],
        };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
        t.personneDeConfiance.push(record('personneDeConfiance', 'Son fils, M. Bernard (fils)'));
      },
    }),
    patient({
      id: 'rea-11',
      unitId: 'rea',
      room: '11',
      lastName: 'Nguyen',
      firstName: 'Thierry',
      sex: 'M',
      birthDate: '1968-02-27',
      admittedAt: at('15:30', -2),
      admissionReason: 'Hémorragie méningée sur anévrisme',
      history: 'DLE posée à J0. Embolisation non possible, chirurgie programmée.',
      assignedNurseId: 'karim',
      transverse: (t) => {
        t.allergies = { status: 'aucune', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
        t.examens.push(record('examens', 'Bloc opératoire demain matin (clipping)'));
      },
    }),
    patient({
      id: 'rea-12',
      unitId: 'rea',
      room: '12',
      lastName: 'Durand',
      firstName: 'Michel',
      sex: 'M',
      birthDate: '1959-03-02',
      admittedAt: at('14:00', -5),
      admissionReason: 'Pneumopathie hypoxémique',
      history: 'Intubé à J0 pour détresse respiratoire. Noradrénaline jusqu’à J4.',
      assignedNurseId: 'martine',
      transverse: (t) => {
        t.allergies = { status: 'aucune', items: [] };
        t.precautions = {
          status: 'complementaires',
          items: [record('precautions', 'Contact (BMR)')],
        };
        t.engagement = { status: 'pas-de-limitation', items: [] };
      },
    }),
    patient({
      id: 'rea-14',
      unitId: 'rea',
      room: '14',
      lastName: 'Lefèvre',
      firstName: 'Jeanne',
      sex: 'F',
      birthDate: '1945-09-09',
      admittedAt: at('03:20', -1),
      admissionReason: 'Insuffisance cardiaque décompensée',
      history: 'OAP à domicile, VNI aux urgences.',
      assignedNurseId: 'martine',
      transverse: (t) => {
        t.allergies = { status: 'inconnu', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = {
          status: 'lata',
          items: [record('engagement', 'LATA : pas de réintubation (décision collégiale J1)')],
        };
      },
    }),
  ],
  events: [
    {
      type: 'narration',
      at: at('07:55'),
      text: 'Relève du matin terminée. Martine prend les box 10, 12 et 14 ; Karim le box 11.',
    },
    {
      type: 'dictation',
      at: at('09:10'),
      label: 'Box 10 : fièvre, hémocultures',
      nurseId: 'martine',
      text: 'Box 10, madame Bernard. Toujours intubée ventilée, FiO2 à 40, PEP à 8. Noradré à 0,3 gamma, tension stable. Elle a fait 38,9 à 8h, j’ai prélevé deux paires d’hémocultures et l’interne est prévenu. Diurèse correcte sur la sonde. J’ai refait le pansement de l’escarre du talon droit.',
      review: 'validate',
      expect: {
        patientId: 'rea-10',
        targets: [
          { labelAnyOf: ['hyperthermie', 'fièvre', 'fievre', 'température'], missingResult: true },
        ],
        forbidden: ['37,', 'antibio'],
      },
    },
    {
      type: 'dictation',
      at: at('11:40'),
      label: 'Box 11 : suivi neuro (compte rendu réel, jargon)',
      nurseId: 'karim',
      text: 'Box 11, monsieur Nguyen. Neuro GCS 15, non algique. DLE clampée, drainée 20 cc sur 4 heures, liquide citrin. Tour neuro toutes les 2 heures. Ventil eupnéique en air ambiant. Hémodyn normocarde, normotendu, objectif PAS inférieure à 180. Anti-agrégant plaquettaire IVSE jusqu’au bloc. Dig pas de transit, HGT une fois par jour. Élim SV en place, diurèse OK. Cutané VVP bras droit fonctionnelle. Toilette préop prévue demain à 7h.',
      review: 'validate',
      expect: {
        patientId: 'rea-11',
        todosAnyOf: ['toilette'],
        forbidden: ['scanner'],
      },
    },
    {
      type: 'dictation',
      at: at('13:30'),
      label: 'Box 14 : confusion, VNI',
      nurseId: 'martine',
      text: 'Box 14, madame Lefèvre. Elle a eu une heure de VNI ce matin, bien tolérée. Cet après-midi elle est confuse, désorientée dans le temps. Pas de douleur. Elle mange peu, la moitié du plateau. Je rappelle qu’elle est en limitation des thérapeutiques, pas de réintubation.',
      review: 'defer',
      expect: {
        patientId: 'rea-14',
        targets: [
          { labelAnyOf: ['confusion', 'désorientation', 'desorientation'], missingResult: true },
        ],
      },
    },
    {
      type: 'priority',
      at: at('14:00'),
      label: '★ sur le Box 10 (fièvre)',
      patientId: 'rea-10',
      nurseId: 'martine',
      starred: true,
    },
    {
      type: 'dictation',
      at: at('15:10'),
      label: 'Box 12 : famille, bilan',
      nurseId: 'martine',
      text: 'Box 12, la famille est passée vers 15h, je les ai informés de l’extubation prévue. Bilan sanguin prévu à 6h demain matin.',
      review: 'validate',
      expect: { patientId: 'rea-12', todosAnyOf: ['bilan'] },
    },
    {
      type: 'dictation',
      at: at('16:30'),
      label: 'Box 12 : exemple A du kit Foch',
      nurseId: 'martine',
      text: 'Alors monsieur du box 12. Neuro, Glasgow 15, plus de sédation depuis ce matin. Respi, il a été extubé vers 10h, là il est sous lunettes à 3 litres, sécrétions sèches, la kiné est passée. Hémodynamique stable, la noradré a été arrêtée hier soir. J’ai refait le pansement du KT central, c’est propre. Par contre vers 16h il était agité, il a arraché sa SNG, j’ai appelé l’interne, on l’a reposée et la radio de contrôle est OK.',
      review: 'none',
      expect: {
        patientId: 'rea-12',
        targets: [
          {
            labelAnyOf: ['sevrage', 'extubation', 'ventilatoire'],
            appareil: 'respiratoire',
            missingResult: true,
          },
          { labelAnyOf: ['agitation', 'agité', 'agite'] },
        ],
        routineAnyOf: ['pansement'],
        forbidden: ['saturation à', 'SpO2', '%'],
      },
    },
    {
      type: 'dictation',
      at: at('17:45'),
      label: 'Box 10 : température redescendue',
      nurseId: 'martine',
      text: 'Box 10, la température est redescendue à 37,8 après le paracétamol de 14h. Noradré diminuée à 0,2 gamma, tension correcte.',
      review: 'validate',
      expect: { patientId: 'rea-10', forbidden: ['38,9'] },
    },
    {
      type: 'narration',
      at: at('19:40'),
      text: 'Relève de 19h45 : ouvre la vue Relève. Le Box 12 a une transmission non relue et un résultat à préciser.',
    },
  ],
});
