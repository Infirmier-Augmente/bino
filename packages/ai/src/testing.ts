import { defaultPriority, emptyTransverse, type Patient } from '@infirmier/domain';

/** Fabrique de patient fictif pour les tests (évite de dépendre de @infirmier/simulation). */
export function makePatientForTests(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 'p1',
    unitId: 'rea',
    ipp: 'IPP-TEST',
    room: '1',
    lastName: 'Test',
    firstName: 'Camille',
    sex: 'M',
    birthDate: '1960-01-01',
    admittedAt: '2026-11-10T10:00:00+01:00',
    admissionReason: 'Test',
    history: null,
    transverse: emptyTransverse(),
    vitals: null,
    devices: [],
    assignedNurseId: null,
    priority: defaultPriority(),
    status: 'present',
    ...overrides,
  };
}
