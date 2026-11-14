import type { PatientDigest, PatientSummary, PriorityLevel } from '@infirmier/domain';
import { describe, expect, it } from 'vitest';
import { comparePriority, sortDigests, sortPatients } from './sort';

function summary(room: string, firstName: string, lastName: string): PatientSummary {
  return {
    id: `p${room}`,
    unitId: 'chir',
    room,
    roomLabel: `Chambre ${room}`,
    displayName: `M. ${lastName}`,
    lastName,
    firstName,
    sex: 'M',
    age: 60,
    admissionReason: 'Appendicectomie',
    admittedAt: '2026-11-13T10:00:00+01:00',
    dayOfStay: 'J1',
    assignedNurseId: null,
  };
}

function digest(
  room: string,
  lastName: string,
  level: PriorityLevel,
  score: number,
  news2: number | null,
  origin: 'manuelle' | 'suggeree' = 'suggeree',
): PatientDigest {
  return {
    patient: summary(room, 'Jean', lastName),
    priority: {
      level,
      origin,
      starred: false,
      suggestion: { level, score, reasons: [] },
    },
    news2:
      news2 === null
        ? null
        : {
            points: {
              respiratoryRate: 0,
              spo2: 0,
              oxygen: 0,
              systolic: 0,
              heartRate: 0,
              temperature: 0,
              consciousness: 0,
            },
            total: news2,
            level,
            reason: `NEWS2 ${news2}`,
          },
    bullets: [],
    reportCount: 0,
  };
}

const rooms = (rows: { patient: { room: string } }[]) => rows.map((r) => r.patient.room);

describe('sortPatients', () => {
  const rows = [
    { patient: summary('12', 'Jean', 'Dupond') },
    { patient: summary('3', 'Jeanne', 'Keller') },
    { patient: summary('21', 'Odile', 'Perrin') },
    { patient: summary('9', 'Nadia', 'Benali') },
    { patient: summary('10', 'Lucie', 'Berger') },
    { patient: summary('14', 'Émile', 'Éluard') },
  ];

  it('trie les chambres dans l’ordre numérique', () => {
    expect(rooms(sortPatients(rows, 'chambre'))).toEqual(['3', '9', '10', '12', '14', '21']);
  });

  it('trie par nom de famille, accents compris', () => {
    expect(sortPatients(rows, 'nom').map((r) => r.patient.lastName)).toEqual([
      'Benali',
      'Berger',
      'Dupond',
      'Éluard',
      'Keller',
      'Perrin',
    ]);
  });

  it('ne modifie pas la liste reçue', () => {
    const copy = [...rows];
    sortPatients(rows, 'nom');
    expect(rows).toEqual(copy);
  });
});

describe('tri « Priorité » de Transmissions › Tous', () => {
  it('niveau, puis score de la suggestion, puis NEWS2, puis chambre', () => {
    const rows = [
      digest('19', 'Petit', 'vert', 0, 0),
      digest('7', 'Moreau', 'orange', 6, 6),
      digest('12', 'Dupond', 'rouge', 7, 7),
      digest('15', 'Laurent', 'orange', 6, 5),
      digest('9', 'Benali', 'vert', 0, 0),
      digest('14', 'Garnier', 'jaune', 3, 3),
    ];
    expect(rooms(sortDigests(rows, 'prio'))).toEqual(['12', '7', '15', '14', '9', '19']);
  });

  it('un choix manuel compte comme son niveau (déjà appliqué par le serveur)', () => {
    const garnier = digest('14', 'Garnier', 'rouge', 3, 3, 'manuelle');
    const dupond = digest('12', 'Dupond', 'rouge', 7, 7);
    expect(comparePriority(garnier, dupond)).toBeGreaterThan(0);
    expect(rooms(sortDigests([digest('7', 'Moreau', 'orange', 6, 6), garnier], 'prio'))).toEqual([
      '14',
      '7',
    ]);
  });

  it('sans NEWS2, passe après un patient au même score qui en a un', () => {
    const rows = [digest('3', 'Keller', 'vert', 0, null), digest('16', 'Fontaine', 'vert', 0, 0)];
    expect(rooms(sortDigests(rows, 'prio'))).toEqual(['16', '3']);
  });

  it('les tris Chambre et Nom s’appliquent aussi aux cartes', () => {
    const rows = [digest('12', 'Dupond', 'rouge', 7, 7), digest('3', 'Keller', 'vert', 0, 1)];
    expect(rooms(sortDigests(rows, 'chambre'))).toEqual(['3', '12']);
    expect(rooms(sortDigests(rows, 'nom'))).toEqual(['12', '3']);
  });
});
