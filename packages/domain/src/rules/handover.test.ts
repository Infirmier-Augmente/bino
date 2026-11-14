import { describe, expect, it } from 'vitest';
import { item, MEDECINE, makePatient, makeTransmission, REA } from '../__fixtures__/hospital';
import type { DarTarget } from '../schemas/transmission';
import { completenessFlags, mergeFlags } from './completeness';
import { buildHandoverSheet, buildRecap, buildUnitBoard } from './handover';
import { comparePriority, effectivePriority, suggestPriority } from './priority';
import { currentShift, dayOfStay } from './time';

const NOW = new Date('2026-11-14T19:30:00+01:00');

const agitation: DarTarget = {
  id: 'c-agit',
  label: 'Agitation',
  appareil: 'neuro',
  data: [item('d1', 'Agitation vers 16h, arrachage de la SNG.')],
  actions: [item('a1', 'Appel de l’interne. Repose de la SNG.')],
  results: [],
  severity: null,
};

describe('currentShift (heure de Paris)', () => {
  it('poste de jour entre 7h45 et 19h45', () => {
    const s = currentShift(NOW, REA);
    expect(s.kind).toBe('jour');
    expect(s.start).toBe('2026-11-14T07:45:00+01:00');
    expect(s.end).toBe('2026-11-14T19:45:00+01:00');
  });
  it('poste de nuit à cheval sur minuit', () => {
    const s = currentShift(new Date('2026-11-15T02:00:00+01:00'), REA);
    expect(s.kind).toBe('nuit');
    expect(s.start).toBe('2026-11-14T19:45:00+01:00');
    expect(s.end).toBe('2026-11-15T07:45:00+01:00');
  });
  it('gère l’heure d’été', () => {
    const s = currentShift(new Date('2026-07-01T10:00:00+02:00'), REA);
    expect(s.start).toBe('2026-07-01T07:45:00+02:00');
  });
  it('jour d’hospitalisation', () => {
    expect(dayOfStay('2026-11-09T14:00:00+01:00', NOW, 'Europe/Paris')).toBe('J5');
  });
});

describe('completeness', () => {
  it('pose une question quand le R manque, jamais une réponse', () => {
    const flags = completenessFlags('t1', { ...makeTransmission().content, targets: [agitation] });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.kind).toBe('missing-result');
    expect(flags[0]?.question).toMatch(/Résultat non renseigné pour « Agitation ».*\?$/);
  });
  it('ne fait pas réapparaître une question déjà traitée', () => {
    const computed = completenessFlags('t1', {
      ...makeTransmission().content,
      targets: [agitation],
    });
    const answered = computed.map((f) => ({ ...f, status: 'answered' as const, answer: 'calme' }));
    expect(mergeFlags(answered, computed)[0]?.status).toBe('answered');
  });
});

describe('priority', () => {
  it('vert sans événement, orange pour une agitation', () => {
    const patient = makePatient({ admittedAt: '2026-11-01T10:00:00+01:00' });
    patient.transverse.allergies.status = 'aucune';
    expect(suggestPriority({ patient, shiftTransmissions: [], now: NOW }).level).toBe('vert');
    const t = makeTransmission({
      content: { targets: [agitation] },
      review: { status: 'validated', by: 'martine', at: null },
    });
    const s = suggestPriority({ patient, shiftTransmissions: [t], now: NOW });
    expect(s.level).toBe('orange');
    expect(s.reasons.map((r) => r.label)).toContain('Agitation');
    expect(s.reasons.map((r) => r.label)).toContain('Résultat non réévalué : Agitation');
  });

  it('la couleur manuelle prime, l’étoile remonte en tête', () => {
    const p = makePatient({
      priority: { starred: false, manualLevel: 'rouge', updatedAt: null, updatedBy: null },
    });
    const sug = suggestPriority({ patient: p, shiftTransmissions: [], now: NOW });
    const eff = effectivePriority(p, sug);
    expect(eff.level).toBe('rouge');
    expect(eff.origin).toBe('manuelle');

    const starredGreen = {
      priority: { ...eff, level: 'vert' as const, starred: true },
      room: '20',
    };
    const red = { priority: { ...eff, starred: false }, room: '1' };
    expect(comparePriority(starredGreen, red)).toBeLessThan(0);
  });
});

describe('buildHandoverSheet', () => {
  const patient = makePatient();
  const t = makeTransmission({
    content: {
      targets: [agitation],
      observations: [
        { ...item('o1', 'Glasgow 15, sédation arrêtée.'), appareil: 'neuro' },
        { ...item('o2', 'Lunettes 3 L/min, sécrétions sèches.'), appareil: 'respiratoire' },
      ],
      routine: [{ ...item('r1', 'Pansement KT central refait, propre.'), appareil: 'dispositifs' }],
      todos: [item('td1', 'Bilan sanguin à 6h.')],
    },
  });
  const before = makeTransmission({ id: 't0', createdAt: '2026-11-14T06:00:00+01:00' });

  it('range par appareil, garde les sources, ignore les postes précédents', () => {
    const sheet = buildHandoverSheet({ unit: REA, patient, transmissions: [before, t], now: NOW });
    expect(sheet.transmissionIds).toEqual(['t1']);
    expect(sheet.headline[0]?.text).toMatch(/^Agitation : /);
    expect(sheet.sections.map((s) => s.key)).toEqual([
      'neuro',
      'respiratoire',
      'hemodynamique',
      'dispositifs',
    ]);
    expect(sheet.sections.find((s) => s.key === 'hemodynamique')?.items).toEqual([]);
    expect(sheet.todos[0]?.text).toBe('Bilan sanguin à 6h.');
    for (const s of sheet.sections)
      for (const i of s.items) expect(i.sources.length).toBeGreaterThan(0);
  });

  it('signale les infos transverses non renseignées sans les inventer', () => {
    const sheet = buildHandoverSheet({ unit: REA, patient, transmissions: [t], now: NOW });
    const allergies = sheet.transverse.find((l) => l.field === 'allergies');
    expect(allergies?.status).toBe('non-renseigne');
    expect(allergies?.summary).toBe('Non renseigné');
    expect(sheet.openFlags.some((f) => f.id === 'patient:p12:allergies')).toBe(true);
  });

  it('trame courte en service de soins', () => {
    const sheet = buildHandoverSheet({
      unit: MEDECINE,
      patient: { ...patient, unitId: 'med' },
      transmissions: [{ ...t, unitId: 'med' }],
      now: NOW,
    });
    expect(sheet.sections.map((s) => s.key)).toEqual(['evenements', 'surveillance', 'soins']);
  });
});

describe('buildUnitBoard + recap', () => {
  it('trie ★ puis Rouge → Vert et produit un récap court', () => {
    const calm = makePatient({
      id: 'p1',
      room: '1',
      lastName: 'Calme',
      admittedAt: '2026-11-01T10:00:00+01:00',
    });
    const agite = makePatient({
      id: 'p2',
      room: '2',
      lastName: 'Agite',
      admittedAt: '2026-11-01T10:00:00+01:00',
    });
    const star = makePatient({
      id: 'p3',
      room: '3',
      lastName: 'Etoile',
      admittedAt: '2026-11-01T10:00:00+01:00',
      priority: { starred: true, manualLevel: null, updatedAt: null, updatedBy: null },
    });
    const t = makeTransmission({ patientId: 'p2', content: { targets: [agitation] } });
    const board = buildUnitBoard({
      unit: REA,
      patients: [calm, agite, star],
      transmissions: [t],
      now: NOW,
    });
    expect(board.rows.map((r) => r.patient.id)).toEqual(['p3', 'p2', 'p1']);
    const recap = buildRecap(board);
    expect(recap[1]?.text).toMatch(/^Box 2 M\. Agite · ORANGE · Agitation/);
    for (const line of recap) expect(line.text.length).toBeLessThanOrEqual(200);
  });
});
