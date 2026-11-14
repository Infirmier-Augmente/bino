import {
  buildNurseReports,
  buildUnitSummaries,
  type LoginBody,
  type LoginResult,
  type NurseReport,
  type PatientDetail,
  toLocalIso,
  type UnitSummaries,
  type VitalSigns,
} from '@infirmier/domain';
import { AppError, notFound } from '../http/errors';
import type { HospitalStore } from '../store/store';
import type { HospitalService } from './hospital-service';

export interface TeamServiceDeps {
  store: HospitalStore;
  hospital: HospitalService;
  /** Mot de passe de démo partagé (`DEMO_PASSWORD`). */
  demoPassword: string;
}

/** Casse et espaces autour ignorés (saisie au clavier du téléphone). */
const normalizePassword = (p: string) => p.trim().toLowerCase();

/**
 * CAS D'USAGE DU FRONT BINO : connexion de démo, « Mes CR », onglet « Tous », saisie des
 * constantes. Les vues sont calculées par les règles pures de @infirmier/domain.
 */
export class TeamService {
  constructor(private readonly deps: TeamServiceDeps) {}

  private get state() {
    return this.deps.store.snapshot;
  }

  /**
   * Connexion de DÉMO : matricule d'un soignant du scénario chargé + mot de passe partagé.
   * Pas une authentification réelle (CPS / e-CPS en V2) : aucun jeton n'est émis.
   */
  login({ matricule, password }: LoginBody): LoginResult {
    const nurse = this.state.nurses.find((n) => n.matricule === matricule.trim());
    const ok = normalizePassword(password) === normalizePassword(this.deps.demoPassword);
    if (!nurse || !ok) {
      throw new AppError(401, 'invalid-credentials', 'Matricule ou mot de passe incorrect.');
    }
    return { nurse, unit: this.deps.hospital.unit(nurse.unitId) };
  }

  /** « Mes CR » : comptes rendus du soignant sur la fenêtre de relève, du plus récent au plus ancien. */
  nurseReports(nurseId: string): NurseReport[] {
    const nurse = this.deps.hospital.nurse(nurseId);
    return buildNurseReports({
      unit: this.deps.hospital.unit(nurse.unitId),
      nurseId,
      patients: this.state.patients,
      transmissions: this.state.transmissions,
      now: this.deps.hospital.now(),
    });
  }

  /** Onglet « Tous » : une carte par patient présent, puces sourcées, priorité et NEWS2. */
  unitSummaries(unitId: string): UnitSummaries {
    return buildUnitSummaries({
      unit: this.deps.hospital.unit(unitId),
      patients: this.state.patients,
      transmissions: this.state.transmissions,
      nurses: this.state.nurses,
      now: this.deps.hospital.now(),
    });
  }

  /** Saisie manuelle des constantes : horodatées et sourcées par le soignant, NEWS2 recalculé. */
  updateVitals(patientId: string, nurseId: string, vitals: VitalSigns): PatientDetail {
    this.deps.hospital.nurse(nurseId);
    const patient = this.deps.hospital.patient(patientId);
    const unit = this.deps.hospital.unit(patient.unitId);
    const at = toLocalIso(this.deps.hospital.now(), unit.timeZone);
    this.deps.store.update((s) => {
      const p = s.patients.find((x) => x.id === patientId);
      if (!p) throw notFound('Patient', patientId);
      p.vitals = { ...vitals, measuredAt: at, source: { kind: 'nurse', nurseId, at } };
    });
    return this.deps.hospital.patientDetail(patientId);
  }
}
