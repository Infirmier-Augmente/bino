import type { SourcedItem } from '../schemas/common';
import { type CareUnit, defaultPriority, emptyTransverse, type Patient } from '../schemas/hospital';
import { emptyContent, type Transmission, type TransmissionContent } from '../schemas/transmission';

// Fixtures de test minimalistes. Les vrais jeux de données vivent dans @infirmier/simulation.

export const REA: CareUnit = {
  id: 'rea',
  name: 'Réanimation polyvalente',
  kind: 'reanimation',
  template: 'par-appareil',
  roomPrefix: 'Box',
  timeZone: 'Europe/Paris',
  shifts: { dayStart: '07:45', nightStart: '19:45' },
};

export const MEDECINE: CareUnit = {
  ...REA,
  id: 'med',
  name: 'Médecine interne',
  kind: 'medecine',
  template: 'sommaire',
  roomPrefix: 'Chambre',
};

export function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 'p12',
    unitId: 'rea',
    ipp: 'IPP-0012',
    room: '12',
    lastName: 'Durand',
    firstName: 'Michel',
    sex: 'M',
    birthDate: '1959-03-02',
    admittedAt: '2026-11-09T14:00:00+01:00',
    admissionReason: 'Pneumopathie hypoxémique',
    history: null,
    transverse: emptyTransverse(),
    vitals: null,
    devices: [],
    assignedNurseId: 'martine',
    priority: defaultPriority(),
    status: 'present',
    ...overrides,
  };
}

export function item(id: string, text: string, quote = text, transmissionId = 't1'): SourcedItem {
  return {
    id,
    text,
    sources: [{ kind: 'dictation', transmissionId, quote, start: 0, end: quote.length }],
    edited: false,
  };
}

export function makeTransmission(
  overrides: Partial<Omit<Transmission, 'content'>> & {
    content?: Partial<TransmissionContent>;
  } = {},
): Transmission {
  const { content, ...rest } = overrides;
  return {
    id: 't1',
    unitId: 'rea',
    nurseId: 'martine',
    patientId: 'p12',
    mode: 'transmission',
    createdAt: '2026-11-14T16:30:00+01:00',
    dictation: { transcript: 'Box 12, RAS.', inputMethod: 'keyboard', durationSec: null },
    resolution: {
      status: 'resolved',
      patientId: 'p12',
      confidence: 1,
      mention: 'Box 12',
      candidates: [],
      method: 'test',
    },
    content: { ...emptyContent(), ...content },
    flags: [],
    review: { status: 'draft', by: null, at: null },
    engine: { structuring: 'test', degraded: false, durationMs: 0, rejected: [] },
    ...rest,
  };
}

/** Dictée de l'exemple A du kit Foch. */
export const EXAMPLE_A =
  'Alors monsieur du box 12. Neuro, Glasgow 15, plus de sédation depuis ce matin. Respi, il a été extubé vers 10h, là il est sous lunettes à 3 litres, sécrétions sèches, la kiné est passée. Hémodynamique stable, la noradré a été arrêtée hier soir. J’ai refait le pansement du KT central, c’est propre. Par contre vers 16h il était agité, il a arraché sa SNG, j’ai appelé l’interne, on l’a reposée et la radio de contrôle est OK.';
