import { describe, expect, it } from 'vitest';
import { EXAMPLE_A, makePatient } from '../__fixtures__/hospital';
import {
  findRoomMentions,
  matchPatients,
  mentionsSeveralPatients,
  resolveFromCandidates,
} from './patient-matching';

const patients = [
  makePatient(),
  makePatient({ id: 'p14', room: '14', lastName: 'Lefèvre', firstName: 'Jeanne', sex: 'F' }),
  makePatient({ id: 'p8', room: '8', lastName: 'Martin', firstName: 'Paul', sex: 'M' }),
  makePatient({ id: 'p9', room: '9', lastName: 'Martins', firstName: 'Lucie', sex: 'F' }),
];

describe('findRoomMentions', () => {
  it('trouve "box 12", "chambre douze", "la 8"', () => {
    expect(findRoomMentions('monsieur du box 12').map((r) => r.room)).toEqual(['12']);
    expect(findRoomMentions('chambre douze, rien à signaler').map((r) => r.room)).toEqual(['12']);
    expect(findRoomMentions('la 8 a bien mangé').map((r) => r.room)).toEqual(['8']);
  });
  it('ignore heures, volumes et dates', () => {
    expect(findRoomMentions('vers le 16 h il était agité')).toEqual([]);
    expect(findRoomMentions('sous la 3 litres')).toEqual([]);
    expect(findRoomMentions('vu le 12 novembre')).toEqual([]);
  });
});

describe('matchPatients + resolveFromCandidates', () => {
  it('rattache l’exemple A au patient du box 12', () => {
    const r = resolveFromCandidates(matchPatients(EXAMPLE_A, patients));
    expect(r.status).toBe('resolved');
    expect(r.patientId).toBe('p12');
    expect(r.mention).toBe('box 12');
  });

  it('rattache par le nom de famille, même mal transcrit', () => {
    const r = resolveFromCandidates(matchPatients('Madame Lefevre a bien dormi', patients));
    expect(r.patientId).toBe('p14');
  });

  it('demande quand le doute existe (noms proches, sans chambre)', () => {
    const r = resolveFromCandidates(matchPatients('Martin a vomi ce midi', patients));
    expect(r.status).toBe('ambiguous');
    expect(r.candidates.map((c) => c.patientId)).toEqual(expect.arrayContaining(['p8', 'p9']));
  });

  it('ne devine pas quand rien n’est cité', () => {
    const r = resolveFromCandidates(matchPatients('il a bien mangé', patients));
    expect(r.status).toBe('unresolved');
    expect(r.patientId).toBeNull();
  });

  it('un nom approchant ne compte pas comme un second patient', () => {
    const m = matchPatients('Chambre 9, madame Martins a bien mangé', patients);
    expect(resolveFromCandidates(m).patientId).toBe('p9');
    expect(mentionsSeveralPatients(m)).toBe(false);
  });

  it('détecte une dictée qui parle de deux patients', () => {
    const m = matchPatients('Box 12 RAS. Box 14 a vomi.', patients);
    expect(mentionsSeveralPatients(m)).toBe(true);
  });
});
