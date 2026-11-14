import { ageAt, dayOfStay, deviceDay, HospitalState, ScenarioEvent } from '@infirmier/domain';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENARIO_ID,
  getScenario,
  initialState,
  SCENARIOS,
  sampleDictations,
  scenarioSummary,
} from './index';

describe.each(SCENARIOS.map((s) => [s.id, s] as const))('scénario %s', (_id, s) => {
  it('produit un état initial valide', () => {
    expect(() => HospitalState.parse(initialState(s))).not.toThrow();
  });

  it('a des événements valides, triés, après le début', () => {
    for (const e of s.events) {
      expect(() => ScenarioEvent.parse(e)).not.toThrow();
      expect(Date.parse(e.at)).toBeGreaterThanOrEqual(Date.parse(s.startsAt));
    }
    const times = s.events.map((e) => Date.parse(e.at));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('ne référence que des soignants et patients existants', () => {
    const nurseIds = new Set(s.nurses.map((n) => n.id));
    const patientIds = new Set(s.patients.map((p) => p.id));
    for (const e of s.events) {
      if (e.type === 'admit') patientIds.add(e.patientId);
      if ('nurseId' in e) expect(nurseIds.has(e.nurseId)).toBe(true);
      if (e.type === 'dictation' && e.expect?.patientId)
        expect(patientIds.has(e.expect.patientId)).toBe(true);
      if (e.type === 'priority') expect(patientIds.has(e.patientId)).toBe(true);
      if (e.type === 'dictation' && e.patientId) expect(patientIds.has(e.patientId)).toBe(true);
    }
    for (const sample of s.samples ?? []) {
      if (sample.patientId) expect(patientIds.has(sample.patientId)).toBe(true);
    }
  });

  it('a des identifiants de patients et des chambres uniques par service', () => {
    const ids = s.patients.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rooms = s.patients.map((p) => `${p.unitId}:${p.room}`);
    expect(new Set(rooms).size).toBe(rooms.length);
  });

  it('se résume pour le simulateur', () => {
    expect(scenarioSummary(s).eventCount).toBe(s.events.length);
  });
});

describe('scénario chir-bino (front Bino, par défaut)', () => {
  const s = getScenario('chir-bino');

  it('est le scénario par défaut', () => {
    expect(DEFAULT_SCENARIO_ID).toBe('chir-bino');
    expect(s?.unitId).toBe('chir');
  });

  it('reprend les 11 patients et les 3 IDE du prototype', () => {
    expect(s?.patients).toHaveLength(11);
    expect(s?.nurses.map((n) => `${n.matricule} ${n.firstName} ${n.lastName}`)).toEqual([
      '10482 Martine Dubois',
      '10401 Sophie Lemoine',
      '10415 Karim Haddad',
    ]);
    const rooms = s?.patients.map((p) => p.room) ?? [];
    expect(new Set(rooms).size).toBe(11);
    for (const p of s?.patients ?? []) {
      expect(p.vitals?.source.kind).toBe('record');
      for (const d of p.devices) expect(d.source.kind).toBe('record');
    }
  });

  it('âge, jour d’hospitalisation et jour des dispositifs comme dans le prototype', () => {
    const now = new Date('2026-11-14T17:45:00+01:00');
    const dupond = s?.patients.find((p) => p.room === '12');
    expect(dupond && ageAt(dupond.birthDate, now)).toBe(68);
    expect(dupond && dayOfStay(dupond.admittedAt, now, 'Europe/Paris')).toBe('J2');
    expect(dupond?.devices.map((d) => deviceDay(d.insertedAt, now, 'Europe/Paris'))).toEqual([
      'J2',
      'J2',
    ]);
    const berger = s?.patients.find((p) => p.room === '10');
    expect(berger?.devices.map((d) => deviceDay(d.insertedAt, now, 'Europe/Paris'))).toEqual([
      'J4',
    ]);
    const days = s?.patients.map(
      (p) => `${p.room}:${dayOfStay(p.admittedAt, now, 'Europe/Paris')}`,
    );
    expect(days).toEqual([
      '12:J2',
      '10:J1',
      '15:J1',
      '7:J4',
      '21:J1',
      '14:J2',
      '18:J1',
      '3:J3',
      '9:J0',
      '16:J1',
      '19:J2',
    ]);
  });

  it('11 comptes rendus tapés au clavier, patient présélectionné, laissés à relire', () => {
    const crs = s?.events.filter((e) => e.type === 'dictation') ?? [];
    expect(crs).toHaveLength(11);
    for (const e of crs) {
      expect(e).toMatchObject({ inputMethod: 'keyboard', review: 'none' });
      expect(e.patientId).toMatch(/^chir-/);
    }
    expect(s?.events.at(-1)).toMatchObject({ type: 'narration', at: '2026-11-14T17:45:00+01:00' });
  });

  it('propose les 2 dictées d’exemple du prototype, et seulement elles', () => {
    expect(sampleDictations('chir').map((d) => [d.label, d.patientId])).toEqual([
      ['M. Dupond se dégrade', 'chir-12'],
      ['Mme Berger, journée calme', 'chir-10'],
    ]);
  });
});

describe('registre', () => {
  it('a des identifiants uniques', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('donne à chaque soignant un matricule unique (tous scénarios confondus)', () => {
    const owner = new Map<string, string>();
    for (const n of SCENARIOS.flatMap((s) => s.nurses)) {
      const who = `${n.unitId}:${n.id}`;
      expect(owner.get(n.matricule) ?? who).toBe(who);
      owner.set(n.matricule, who);
    }
    expect(owner.size).toBe(11);
  });
  it('expose des dictées d’exemple', () => {
    expect(sampleDictations().length).toBeGreaterThan(0);
    expect(sampleDictations('rea').every((d) => d.scenarioId.length > 0)).toBe(true);
  });
});
