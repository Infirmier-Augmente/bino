import type { CareUnit, Device, Nurse, Patient } from '../schemas/hospital';
import type { Transmission } from '../schemas/transmission';
import type { DeviceLine, NurseReport, PatientDigest, UnitSummaries } from '../schemas/views';
import { patientSummary, transmissionsInShift } from './handover';
import { patientNews2 } from './news2';
import { comparePriority, effectivePriority, suggestPriority } from './priority';
import { buildSummaryBullets } from './summary';
import { deviceDay, formatClock, handoverWindow, isWithin, toLocalIso } from './time';

/**
 * VUES DE L'ÉQUIPE (front Bino) : onglet « Tous » (une carte par patient), « Mes CR »,
 * dispositifs du dossier. Calculées à la lecture, jamais stockées, sans IA.
 */

/** Dispositifs avec leur jour de pose (« J2 »), dans l'ordre du dossier. */
export function deviceLines(devices: readonly Device[], now: Date, timeZone: string): DeviceLine[] {
  return devices.map((d) => ({
    id: d.id,
    label: d.label,
    day: deviceDay(d.insertedAt, now, timeZone),
  }));
}

export interface DigestInput {
  unit: CareUnit;
  patient: Patient;
  transmissions: readonly Transmission[];
  nurses: readonly Pick<Nurse, 'id' | 'firstName'>[];
  now: Date;
}

/** Carte d'un patient : priorité (plancher NEWS2 compris), NEWS2, puces sourcées du poste. */
export function buildPatientDigest({
  unit,
  patient,
  transmissions,
  nurses,
  now,
}: DigestInput): PatientDigest {
  const inShift = transmissionsInShift(transmissions, patient.id, handoverWindow(now, unit));
  const suggestion = suggestPriority({ patient, shiftTransmissions: inShift, now });
  return {
    patient: patientSummary(patient, unit, now),
    priority: effectivePriority(patient, suggestion),
    news2: patientNews2(patient),
    bullets: buildSummaryBullets({
      patientId: patient.id,
      transmissions: inShift,
      nurses,
      timeZone: unit.timeZone,
    }),
    reportCount: inShift.length,
  };
}

export interface UnitSummariesInput {
  unit: CareUnit;
  patients: readonly Patient[];
  transmissions: readonly Transmission[];
  nurses: readonly Pick<Nurse, 'id' | 'firstName'>[];
  now: Date;
}

/** Onglet « Tous » : patients présents du service, triés comme la vue service (★, couleur, score). */
export function buildUnitSummaries({
  unit,
  patients,
  transmissions,
  nurses,
  now,
}: UnitSummariesInput): UnitSummaries {
  const rows = patients
    .filter((p) => p.unitId === unit.id && p.status === 'present')
    .map((patient) => buildPatientDigest({ unit, patient, transmissions, nurses, now }))
    .sort((a, b) =>
      comparePriority(
        { priority: a.priority, room: a.patient.room },
        { priority: b.priority, room: b.patient.room },
      ),
    );
  return {
    unit,
    shift: handoverWindow(now, unit),
    now: toLocalIso(now, unit.timeZone),
    rows,
  };
}

export interface NurseReportsInput {
  /** Service du soignant : fenêtre de relève et fuseau horaire. */
  unit: CareUnit;
  nurseId: string;
  patients: readonly Patient[];
  transmissions: readonly Transmission[];
  now: Date;
}

/** « Mes CR » : comptes rendus du soignant sur la fenêtre de relève, du plus récent au plus ancien. */
export function buildNurseReports({
  unit,
  nurseId,
  patients,
  transmissions,
  now,
}: NurseReportsInput): NurseReport[] {
  const shift = handoverWindow(now, unit);
  return transmissions
    .filter((t) => t.nurseId === nurseId && isWithin(t.createdAt, shift.start, shift.end))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((t) => {
      const patient = t.patientId ? patients.find((p) => p.id === t.patientId) : undefined;
      return {
        transmissionId: t.id,
        patient: patient ? patientSummary(patient, unit, now) : null,
        createdAt: t.createdAt,
        time: formatClock(t.createdAt, unit.timeZone),
        transcript: t.dictation.transcript,
        status: t.review.status,
      };
    });
}
