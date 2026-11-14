import type {
  EffectivePriority,
  PatientDetail,
  SampleDictation,
  SourcedItem,
} from '@infirmier/domain';
import { describe, expect, it } from 'vitest';
import { dossierLines } from './dossier';
import { dateFr, nurseFullName, patientFullName, patientSubline, roomChipLabel } from './format';
import { levelOfNumber, priorityButtonLabel, priorityNumber, priorityReason } from './priority';
import {
  appendDictation,
  bulletText,
  contributorsLine,
  isReportEmpty,
  moreBulletsLabel,
  nextInputMethod,
  sampleFor,
  splitBullets,
} from './report';

const item = (text: string): SourcedItem => ({
  id: text,
  text,
  edited: false,
  sources: [{ kind: 'record', field: 'x', label: 'Dossier' }],
});

describe('format', () => {
  it('date du serveur dans le fuseau du service', () => {
    expect(dateFr('2026-11-14T18:12:00+01:00', 'Europe/Paris')).toBe('14/11/2026');
    // 23h30 UTC le 14 = 0h30 le 15 à Paris.
    expect(dateFr('2026-11-14T23:30:00Z', 'Europe/Paris')).toBe('15/11/2026');
  });

  it('noms, sous-ligne et pastille chambre', () => {
    expect(patientFullName({ sex: 'M', firstName: 'Jean', lastName: 'Dupond' })).toBe(
      'M. Jean Dupond',
    );
    expect(patientFullName({ sex: 'F', firstName: 'Claire', lastName: 'Laurent' })).toBe(
      'Mme Claire Laurent',
    );
    expect(patientSubline({ age: 59, admissionReason: 'Cure de hernie', dayOfStay: 'J1' })).toBe(
      '59 ans · Cure de hernie, J1',
    );
    expect(patientSubline({ age: 59, admissionReason: ' ', dayOfStay: 'J1' })).toBe('59 ans · J1');
    expect(roomChipLabel('12')).toBe('CHAMB 12');
    expect(nurseFullName({ firstName: 'Martine', lastName: 'Dubois', role: 'IDE' })).toBe(
      'Martine Dubois · IDE',
    );
  });
});

describe('priorité', () => {
  const base: EffectivePriority = {
    level: 'rouge',
    origin: 'suggeree',
    starred: false,
    suggestion: {
      level: 'rouge',
      score: 7,
      reasons: [{ label: 'NEWS2 7 · FR 24, TA 98/62', weight: 7, sources: [] }],
    },
  };

  it('numéros 1 à 4', () => {
    expect(priorityNumber('rouge')).toBe(1);
    expect(priorityNumber('vert')).toBe(4);
    expect(levelOfNumber(3)).toBe('jaune');
  });

  it('raison : choix manuel, sinon suggestion, sinon NEWS2', () => {
    expect(priorityReason({ ...base, origin: 'manuelle' }, null)).toBe('choisie par un soignant');
    expect(priorityReason(base, null)).toBe('NEWS2 7 · FR 24, TA 98/62');
    const noReason = { ...base, suggestion: { ...base.suggestion, reasons: [] } };
    expect(
      priorityReason(noReason, {
        points: {
          respiratoryRate: 0,
          spo2: 0,
          oxygen: 0,
          systolic: 0,
          heartRate: 0,
          temperature: 0,
          consciousness: 3,
        },
        total: 3,
        level: 'jaune',
        reason: 'NEWS2 3 · conscience altérée',
      }),
    ).toBe('NEWS2 3 · conscience altérée');
    expect(priorityButtonLabel('M. Jean Dupond', 1, 'NEWS2 7')).toBe(
      'M. Jean Dupond : Priorité 1 (NEWS2 7). Changer la priorité',
    );
  });
});

describe('compte rendu', () => {
  it('la dictée s’ajoute à la fin', () => {
    expect(appendDictation('', 'Nuit calme.')).toBe('Nuit calme.');
    expect(appendDictation('Douleur 4 sur 10. ', ' Paracétamol donné.')).toBe(
      'Douleur 4 sur 10. Paracétamol donné.',
    );
    expect(isReportEmpty('  ')).toBe(true);
    expect(isReportEmpty('ok')).toBe(true);
    expect(isReportEmpty('RAS.')).toBe(false);
  });

  it('mode de saisie', () => {
    expect(nextInputMethod('keyboard', 'voice-server')).toBe('voice-server');
    expect(nextInputMethod('voice-device', 'typed')).toBe('voice-device');
    expect(nextInputMethod('keyboard', 'sample')).toBe('simulation');
    expect(nextInputMethod('simulation', 'typed')).toBe('keyboard');
  });

  it('exemple proposé tant qu’aucun compte rendu n’a ce texte', () => {
    const samples: SampleDictation[] = [
      {
        id: 's1',
        scenarioId: 'chir-bino',
        label: 'M. Dupond se dégrade',
        text: 'Chambre 12, M. Dupond.',
        mode: 'transmission',
        patientId: 'p12',
      },
    ];
    expect(sampleFor(samples, 'p12', [])?.id).toBe('s1');
    expect(sampleFor(samples, 'p10', [])).toBeNull();
    expect(sampleFor(samples, 'p12', [' Chambre 12, M. Dupond. '])).toBeNull();
  });

  it('puces de « Tous »', () => {
    const bullet = {
      theme: 'Douleur',
      text: 'Douleur à 2 sur 10.',
      contributors: [
        { nurseId: 'n2', firstName: 'Karim', at: '2026-11-14T14:05:00+01:00', time: '14h05' },
        { nurseId: 'n3', firstName: 'Sophie', at: '2026-11-14T08:10:00+01:00', time: '8h10' },
      ],
    };
    expect(bulletText(bullet)).toBe('Douleur : Douleur à 2 sur 10.');
    expect(contributorsLine(bullet)).toBe('Karim 14h05 · Sophie 8h10');
  });

  it('6 puces au plus, les plus récentes ; le reste se déplie', () => {
    const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(splitBullets(eight, false)).toEqual({ shown: eight.slice(0, 6), hidden: 2 });
    expect(splitBullets(eight, true)).toEqual({ shown: eight, hidden: 0 });
    expect(splitBullets(eight.slice(0, 6), false)).toEqual({ shown: eight.slice(0, 6), hidden: 0 });
    expect(moreBulletsLabel(2)).toBe('Voir les 2 autres puces');
    expect(moreBulletsLabel(1)).toBe('Voir l’autre puce');
  });
});

describe('dossier médical', () => {
  type DossierInput = Pick<PatientDetail, 'patient' | 'devices'>;
  const transverse: DossierInput['patient']['transverse'] = {
    allergies: { status: 'connues', items: [item('Pénicilline.')] },
    precautions: { status: 'standard', items: [] },
    engagement: { status: 'inconnu', items: [] },
    examens: [],
    prescriptions: [],
    famille: [item('Fille appelée à 14h, inquiète.')],
    personneDeConfiance: [],
  };
  const input = (patch: Partial<DossierInput['patient']>, devices: DossierInput['devices'] = []) =>
    ({
      patient: { admissionReason: 'Colectomie', history: 'HTA', transverse, ...patch },
      devices,
    }) as DossierInput;

  it('motif, antécédents, allergies, dispositifs (J2) et famille', () => {
    const lines = dossierLines(
      input({}, [
        { id: 'd1', label: 'Drain abdominal', day: 'J2' },
        { id: 'd2', label: 'Voie veineuse périphérique', day: 'J2' },
      ]),
    );
    expect(lines).toEqual([
      { label: 'Motif', value: 'Colectomie' },
      { label: 'Antécédents', value: 'HTA' },
      { label: 'Allergies', value: 'Pénicilline' },
      { label: 'Dispositifs', value: 'Drain abdominal (J2), Voie veineuse périphérique (J2)' },
      { label: 'Famille', value: 'Fille appelée à 14h, inquiète' },
    ]);
  });

  it('une donnée inconnue n’est jamais présentée comme absente', () => {
    const lines = dossierLines(
      input({
        history: null,
        transverse: { ...transverse, allergies: { status: 'inconnu', items: [] }, famille: [] },
      }),
    );
    expect(lines.find((l) => l.label === 'Antécédents')?.value).toBe('Non renseignés');
    expect(lines.find((l) => l.label === 'Allergies')?.value).toBe('Non renseignées');
    const none = dossierLines(
      input({ transverse: { ...transverse, allergies: { status: 'aucune', items: [] } } }),
    );
    expect(none.find((l) => l.label === 'Allergies')?.value).toBe('Aucune connue');
  });

  it('précautions et prescription affichées seulement si renseignées', () => {
    const lines = dossierLines(
      input({
        transverse: {
          ...transverse,
          precautions: { status: 'complementaires', items: [item('Contact · BMR')] },
          prescriptions: [item('Paracétamol 1 g IV toutes les 6 h')],
        },
      }),
    );
    expect(lines.map((l) => l.label)).toEqual([
      'Motif',
      'Antécédents',
      'Allergies',
      'Précautions',
      'Nouvelle prescription',
      'Famille',
    ]);
  });
});
