import { patient, record, scenarioDay } from '../helpers';
import { NURSES_REA, UNIT_REA } from '../hospital';
import { defineScenario } from '../scenario';

/**
 * Réanimation, poste de nuit du 14 au 15/11/2026.
 * Sophie (Box 15 + entrée au Box 16) et Julien (Box 13 et 17).
 * Une entrée des urgences au Box 16 : la dictée d'admission ne dit rien des
 * allergies (l'app doit les demander). Puis désaturation, douleur post-op,
 * agitation à 3h et une dictée qui cite deux box à la fois.
 * Heures après minuit : `at('02:10', 1)`. Tout est fictif.
 */
const at = scenarioDay('2026-11-14');

export const admissionNuit = defineScenario({
  id: 'admission-nuit',
  title: 'Réa — nuit de Sophie et Julien, avec une entrée',
  description:
    'Poste de nuit en réanimation. Une entrée arrive des urgences au Box 16 : Sophie dicte l’admission sans parler des allergies, l’app doit les demander. Désaturation gérée et réévaluée, douleur post-op, agitation à 3h, et une dictée qui cite deux box à la fois.',
  tags: ['réanimation', 'nuit', 'admission'],
  unitId: 'rea',
  startsAt: at('19:50'),
  units: [UNIT_REA],
  nurses: NURSES_REA,
  patients: [
    patient({
      id: 'nuit-13',
      unitId: 'rea',
      room: '13',
      lastName: 'Leclerc',
      firstName: 'Pascal',
      sex: 'M',
      birthDate: '1957-10-08',
      admittedAt: at('09:30', -3),
      admissionReason: 'SDRA sur pneumopathie grippale',
      history:
        'Grippe A compliquée. Intubé à J0, décubitus ventral par séances de 16 h. Sédation propofol-sufentanil.',
      assignedNurseId: 'julien',
      transverse: (t) => {
        t.allergies = { status: 'aucune', items: [] };
        t.precautions = {
          status: 'complementaires',
          items: [record('precautions', 'Gouttelettes (grippe A)')],
        };
        t.engagement = { status: 'pas-de-limitation', items: [] };
        t.personneDeConfiance.push(record('personneDeConfiance', 'Son épouse, Mme Leclerc'));
      },
    }),
    patient({
      id: 'nuit-15',
      unitId: 'rea',
      room: '15',
      lastName: 'Brunet',
      firstName: 'Joël',
      sex: 'M',
      birthDate: '1964-03-15',
      admittedAt: at('23:50', -1),
      admissionReason: 'Péritonite sigmoïdienne opérée (intervention de Hartmann)',
      history: 'Opéré hier soir, extubé au bloc. Noradrénaline sevrée ce matin. Redon et stomie.',
      assignedNurseId: 'sophie',
      transverse: (t) => {
        t.allergies = {
          status: 'connues',
          items: [record('allergies', 'Allergie au latex')],
        };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = { status: 'pas-de-limitation', items: [] };
      },
    }),
    patient({
      id: 'nuit-17',
      unitId: 'rea',
      room: '17',
      lastName: 'Costa',
      firstName: 'Maria',
      sex: 'F',
      birthDate: '1948-12-02',
      admittedAt: at('16:00', -1),
      admissionReason: 'Exacerbation de BPCO hypercapnique',
      history:
        'BPCO stade 3, oxygène à domicile. VNI la nuit et 4 h par jour. Objectif SpO2 88-92 %.',
      assignedNurseId: 'julien',
      transverse: (t) => {
        t.allergies = { status: 'inconnu', items: [] };
        t.precautions = { status: 'standard', items: [] };
        t.engagement = {
          status: 'lata',
          items: [
            record('engagement', 'LATA : pas d’intubation, VNI maximum (décision collégiale J1)'),
          ],
        };
        t.famille.push(record('famille', 'Son fils passe le matin avant le travail'));
      },
    }),
  ],
  events: [
    {
      type: 'narration',
      at: at('19:55'),
      text: 'Relève de 19h45. Sophie prend le Box 15 et le Box 16, vide, prêt pour une entrée annoncée par les urgences. Julien prend les box 13 et 17.',
    },
    {
      type: 'dictation',
      at: at('20:40'),
      label: 'Box 13 : tour du soir (jargon)',
      nurseId: 'julien',
      text: 'Box 13, monsieur Leclerc. Toujours IOT ventilé, FiO2 60, PEP 12, il sature à 93. Noradré à 0,15 gamma IVSE, PAM à 72. Sédaté, RASS moins 4, en décubitus ventral depuis 16h. SV en place, diurèse OK, HGT à 1,45.',
      review: 'validate',
      expect: {
        patientId: 'nuit-13',
        forbidden: ['curare', 'extub', 'désaturation'],
      },
    },
    {
      type: 'admit',
      at: at('21:40'),
      label: 'Entrée au Box 16 (urgences)',
      patientId: 'nuit-16',
      patient: {
        unitId: 'rea',
        room: '16',
        lastName: 'Royer',
        firstName: 'Lucienne',
        sex: 'F',
        birthDate: '1946-07-29',
        admissionReason: 'Choc septique d’origine urinaire',
        assignedNurseId: 'sophie',
      },
    },
    {
      type: 'dictation',
      at: at('22:15'),
      label: 'Box 16 : dictée d’entrée (allergies non dites)',
      nurseId: 'sophie',
      mode: 'admission',
      patientId: 'nuit-16',
      text: 'Entrée Box 16, madame Royer, 80 ans, admise pour un choc septique d’origine urinaire. Dans ses antécédents elle est hypertendue, diabétique de type 2 sous comprimés, et elle a une prothèse de hanche droite. Ça a commencé il y a trois jours avec de la fièvre et des brûlures urinaires, c’est sa voisine qui l’a trouvée confuse ce soir et qui a appelé le SAMU, aux urgences elle était à 75 de systolique malgré deux litres de remplissage, donc noradré. À la maison elle est autonome avec une canne, elle vit seule au deuxième sans ascenseur, sa fille habite loin mais l’appelle tous les jours, je l’ai prévenue de l’entrée. Ici à l’entrée GCS 14, un peu confuse, 38,9, TA 98 sur 55 sous noradré 0,4 gamma IVSE, FC 112, SpO2 95 sous 3 litres, SV posée avec 30 ml la première heure, deux VVP. KT central à prévoir cette nuit avec l’interne, ECBU et hémocs faits aux urgences.',
      review: 'validate',
      expect: {
        patientId: 'nuit-16',
        todosAnyOf: ['central', 'KT'],
        forbidden: ['aucune allergie', 'pas d’allergie', 'pénicilline', 'EHPAD'],
      },
    },
    {
      type: 'dictation',
      at: at('00:20', 1),
      label: 'Box 17 : désaturation, O2 augmenté, réévaluée',
      nurseId: 'julien',
      text: 'Box 17, madame Costa. Vers 23h30 elle a désaturé à 82 sous ses 2 litres, polypnéique à 32, un peu encombrée. J’ai monté l’O2 à 4 litres, je l’ai aspirée et j’ai remis la VNI, gaz du sang fait, l’interne est prévenu. Réévaluée à minuit, SpO2 à 90, FR à 22, elle est plus calme sous VNI.',
      review: 'validate',
      expect: {
        patientId: 'nuit-17',
        targets: [
          {
            labelAnyOf: ['désaturation', 'desaturation', 'détresse', 'detresse', 'hypoxémie'],
            appareil: 'respiratoire',
            missingResult: false,
          },
        ],
        forbidden: ['intub', 'PaCO2', 'pH à'],
      },
    },
    {
      type: 'dictation',
      at: at('01:15', 1),
      label: 'Box 15 : douleur post-op réévaluée',
      nurseId: 'sophie',
      text: 'Box 15, monsieur Brunet. Il s’est réveillé vers minuit trente avec une douleur abdominale à 7 sur 10, j’ai donné le paracétamol avec le néfopam en si besoin. Réévalué à 1h, EVA à 3, il est soulagé et il s’est rendormi. Pansement de laparo propre et sec, stomie rosée, le redon a ramené 50 cc.',
      review: 'validate',
      expect: {
        patientId: 'nuit-15',
        targets: [{ labelAnyOf: ['douleur', 'antalgi'], missingResult: false }],
        routineAnyOf: ['pansement', 'stomie'],
        forbidden: ['morphine', 'PCA', 'fièvre'],
      },
    },
    {
      type: 'dictation',
      at: at('03:15', 1),
      label: 'Box 16 : KT central posé, agitation à 3h',
      nurseId: 'sophie',
      text: 'Box 16, madame Royer. Le KT central jugulaire droit a été posé vers minuit, radio OK, la noradré passe dessus à 0,3 gamma. Par contre vers 3h elle était agitée, elle voulait se lever pour rentrer chez elle, elle a arraché sa VVP du bras gauche. J’ai reposé une VVP au bras droit et j’ai prévenu l’interne. HGT à 1,62.',
      review: 'defer',
      expect: {
        patientId: 'nuit-16',
        targets: [
          { labelAnyOf: ['agitation', 'agité', 'agite', 'confusion'], missingResult: true },
        ],
        forbidden: ['contention', 'Haldol', 'Loxapac', 'chute'],
      },
    },
    {
      type: 'priority',
      at: at('03:20', 1),
      label: 'Box 16 passé en Rouge (choc septique, agitation)',
      patientId: 'nuit-16',
      nurseId: 'sophie',
      level: 'rouge',
    },
    {
      type: 'dictation',
      at: at('05:40', 1),
      label: 'Box 15 et 16 dans la même dictée',
      nurseId: 'sophie',
      text: 'Alors Box 15 RAS, et le 16 a bien dormi depuis 4h, noradré baissée à 0,2 gamma, PAM à 72, diurèse à 60 ml sur la dernière heure.',
      review: 'none',
      expect: {
        ambiguous: true,
        forbidden: ['douleur', 'agitée'],
      },
    },
    {
      type: 'dictation',
      at: at('06:20', 1),
      label: 'Box 13 : fin de nuit, retournement à 8h',
      nurseId: 'julien',
      text: 'Box 13, monsieur Leclerc. Nuit calme, toujours en ventral, FiO2 descendue à 50, il sature à 95. Noradré stable à 0,15. HGT à 2,1 à 4h, insuline IVSE augmentée selon le protocole, HGT /2h. Bilan et gaz de 6h faits, retournement en dorsal prévu à 8h avec l’équipe de jour.',
      review: 'validate',
      expect: {
        patientId: 'nuit-13',
        todosAnyOf: ['dorsal', 'retournement'],
        forbidden: ['curare', 'extub'],
      },
    },
    {
      type: 'narration',
      at: at('07:40', 1),
      text: 'Relève de 7h45 : le Box 16 (entrée de la nuit) est en Rouge et sa fiche demande encore les allergies. La dictée « Box 15 RAS, et le 16… » cite deux patients : l’app propose de la séparer.',
    },
  ],
});
