import type { AiServices, IdFactory } from '@infirmier/ai';
import {
  ageAt,
  applyTransverseUpdates,
  buildFhirBundle,
  buildHandoverSheet,
  buildPatientListItem,
  buildRecap,
  buildUnitBoard,
  type CareUnit,
  type CreateTransmissionBody,
  completenessFlags,
  type DpiExport,
  displayName,
  effectivePriority,
  type Flag,
  type HandoverSheet,
  handoverWindow,
  mentionsSeveralPatients,
  mergeFlags,
  type NewPatientInput,
  type Nurse,
  type Patient,
  type PatientDetail,
  type PatientListItem,
  type PriorityLevel,
  patientSummary,
  type RecapLine,
  roomLabel,
  type SearchHit,
  type SessionInfo,
  type SourcedItem,
  searchTransmissions,
  suggestPriority,
  type Transmission,
  type TransmissionContent,
  toLocalIso,
  transmissionsInShift,
  type UnitBoard,
} from '@infirmier/domain';
import { AppError, notFound } from '../http/errors';
import type { HospitalStore } from '../store/store';
import { clockNow } from './clock';

export interface HospitalServiceDeps {
  store: HospitalStore;
  ai: AiServices;
  ids: IdFactory;
  realNow?: () => Date;
}

/**
 * CAS D'USAGE MÉTIER. Les routes HTTP, le simulateur et la CLI passent tous par ici :
 * une seule implémentation des règles, quelle que soit l'entrée.
 */
export class HospitalService {
  constructor(private readonly deps: HospitalServiceDeps) {}

  private get state() {
    return this.deps.store.snapshot;
  }

  now(): Date {
    return clockNow(this.state.clock, this.deps.realNow?.() ?? new Date());
  }

  // ─── Lectures ────────────────────────────────────────────────────────────

  unit(unitId: string): CareUnit {
    const unit = this.state.units.find((u) => u.id === unitId);
    if (!unit) throw notFound('Service', unitId);
    return unit;
  }

  nurse(nurseId: string): Nurse {
    const nurse = this.state.nurses.find((n) => n.id === nurseId);
    if (!nurse) throw notFound('Soignant', nurseId);
    return nurse;
  }

  patient(patientId: string): Patient {
    const p = this.state.patients.find((x) => x.id === patientId);
    if (!p) throw notFound('Patient', patientId);
    return p;
  }

  transmission(transmissionId: string): Transmission {
    const t = this.state.transmissions.find((x) => x.id === transmissionId);
    if (!t) throw notFound('Transmission', transmissionId);
    return t;
  }

  session(): SessionInfo {
    return { units: [...this.state.units], nurses: [...this.state.nurses] };
  }

  unitBoard(unitId: string): UnitBoard {
    return buildUnitBoard({
      unit: this.unit(unitId),
      patients: this.state.patients,
      transmissions: this.state.transmissions,
      now: this.now(),
    });
  }

  unitPatients(unitId: string): PatientListItem[] {
    return this.unitBoard(unitId).rows;
  }

  unitRecap(unitId: string): RecapLine[] {
    return buildRecap(this.unitBoard(unitId));
  }

  search(unitId: string, q: string): SearchHit[] {
    const unit = this.unit(unitId);
    const label = (patientId: string | null) => {
      const p = patientId ? this.state.patients.find((x) => x.id === patientId) : undefined;
      return p ? `${roomLabel(unit, p.room)} · ${displayName(p)}` : 'Patient non rattaché';
    };
    return searchTransmissions(
      this.state.transmissions.filter((t) => t.unitId === unitId),
      q,
      label,
    );
  }

  patientDetail(patientId: string): PatientDetail {
    const patient = this.patient(patientId);
    const unit = this.unit(patient.unitId);
    const now = this.now();
    const transmissions = this.state.transmissions
      .filter((t) => t.patientId === patientId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const inShift = transmissionsInShift(transmissions, patientId, handoverWindow(now, unit));
    return {
      patient,
      summary: patientSummary(patient, unit, now),
      priority: effectivePriority(
        patient,
        suggestPriority({ patient, shiftTransmissions: inShift, now }),
      ),
      transmissions,
    };
  }

  handover(patientId: string): HandoverSheet {
    const patient = this.patient(patientId);
    return buildHandoverSheet({
      unit: this.unit(patient.unitId),
      patient,
      transmissions: this.state.transmissions,
      now: this.now(),
    });
  }

  private listItem(patientId: string): PatientListItem {
    const patient = this.patient(patientId);
    return buildPatientListItem({
      unit: this.unit(patient.unitId),
      patient,
      transmissions: this.state.transmissions,
      now: this.now(),
    });
  }

  // ─── Patients ────────────────────────────────────────────────────────────

  updatePriority(
    patientId: string,
    input: { nurseId: string; starred?: boolean; manualLevel?: PriorityLevel | null },
  ): PatientListItem {
    this.nurse(input.nurseId);
    const unit = this.unit(this.patient(patientId).unitId);
    this.deps.store.update((s) => {
      const p = s.patients.find((x) => x.id === patientId);
      if (!p) throw notFound('Patient', patientId);
      if (input.starred !== undefined) p.priority.starred = input.starred;
      if (input.manualLevel !== undefined) p.priority.manualLevel = input.manualLevel;
      p.priority.updatedAt = toLocalIso(this.now(), unit.timeZone);
      p.priority.updatedBy = input.nurseId;
    });
    return this.listItem(patientId);
  }

  admitPatient(input: NewPatientInput, id?: string): Patient {
    const unit = this.unit(input.unitId);
    if (
      this.state.patients.some(
        (p) => p.unitId === unit.id && p.room === input.room && p.status === 'present',
      )
    ) {
      throw new AppError(
        409,
        'room-occupied',
        `${roomLabel(unit, input.room)} est déjà occupé(e).`,
      );
    }
    const patientId = id ?? this.deps.ids('pat');
    const patient: Patient = {
      id: patientId,
      unitId: unit.id,
      ipp: `IPP-${patientId.toUpperCase()}`,
      room: input.room,
      lastName: input.lastName,
      firstName: input.firstName,
      sex: input.sex,
      birthDate: input.birthDate,
      admittedAt: toLocalIso(this.now(), unit.timeZone),
      admissionReason: input.admissionReason,
      history: null,
      transverse: {
        allergies: { status: 'inconnu', items: [] },
        precautions: { status: 'inconnu', items: [] },
        engagement: { status: 'inconnu', items: [] },
        examens: [],
        prescriptions: [],
        famille: [],
        personneDeConfiance: [],
      },
      assignedNurseId: input.assignedNurseId ?? null,
      priority: { starred: false, manualLevel: null, updatedAt: null, updatedBy: null },
      status: 'present',
    };
    this.deps.store.update((s) => {
      s.patients.push(patient);
    });
    return patient;
  }

  fhir(patientId: string): Record<string, unknown> {
    return this.buildBundle(patientId, this.deps.ids('bundle')) as unknown as Record<
      string,
      unknown
    >;
  }

  private buildBundle(patientId: string, bundleId: string) {
    const patient = this.patient(patientId);
    const unit = this.unit(patient.unitId);
    const now = this.now();
    return buildFhirBundle({
      unit,
      patient,
      nurses: this.state.nurses,
      transmissions: transmissionsInShift(
        this.state.transmissions,
        patientId,
        handoverWindow(now, unit),
      ),
      now,
      bundleId,
    });
  }

  exportToDpi(patientId: string, nurseId: string): DpiExport {
    this.nurse(nurseId);
    const patient = this.patient(patientId);
    const unit = this.unit(patient.unitId);
    const id = this.deps.ids('dpi');
    const bundle = this.buildBundle(patientId, id);
    const transmissionIds = transmissionsInShift(
      this.state.transmissions,
      patientId,
      handoverWindow(this.now(), unit),
    ).map((t) => t.id);
    if (transmissionIds.length === 0) {
      throw new AppError(
        422,
        'nothing-to-export',
        'Aucune transmission sur ce poste pour ce patient.',
      );
    }
    const record: DpiExport = {
      id,
      patientId,
      exportedAt: toLocalIso(this.now(), unit.timeZone),
      exportedBy: nurseId,
      format: 'fhir-r4-bundle',
      transmissionIds,
      bundle: bundle as unknown as Record<string, unknown>,
    };
    this.deps.store.update((s) => {
      s.dpiExports.unshift(record);
      s.dpiExports = s.dpiExports.slice(0, 100);
    });
    return record;
  }

  dpiInbox(): DpiExport[] {
    return [...this.state.dpiExports];
  }

  // ─── Transmissions ───────────────────────────────────────────────────────

  async createTransmission(body: CreateTransmissionBody): Promise<Transmission> {
    const unit = this.unit(body.unitId);
    this.nurse(body.nurseId);
    const now = this.now();
    const id = this.deps.ids('tr');
    const patients = this.state.patients.filter(
      (p) => p.unitId === unit.id && p.status === 'present',
    );

    const resolution = body.patientId
      ? {
          status: 'manual' as const,
          patientId: this.patient(body.patientId).id,
          confidence: 1,
          mention: null,
          candidates: [],
          method: 'preselection',
        }
      : await this.deps.ai.resolvePatient(body.transcript, patients, {
          preferredPatientIds: patients
            .filter((p) => p.assignedNurseId === body.nurseId)
            .map((p) => p.id),
          ageOf: (p) => ageAt(p.birthDate, now),
        });

    const patient = resolution.patientId
      ? (patients.find((p) => p.id === resolution.patientId) ?? null)
      : null;

    const outcome = await this.deps.ai.structure(id, {
      transcript: body.transcript,
      mode: body.mode,
      patient: patient
        ? {
            sex: patient.sex,
            age: ageAt(patient.birthDate, now),
            admissionReason: patient.admissionReason,
            unitKind: unit.kind,
          }
        : null,
    });

    const flags: Flag[] = [...outcome.flags];
    if (!resolution.patientId) {
      flags.unshift({
        id: `${id}:patient`,
        kind: 'patient-ambiguous',
        question:
          resolution.status === 'ambiguous'
            ? 'Plusieurs patients possibles : de qui s’agit-il ?'
            : 'Patient non reconnu dans la dictée : de qui s’agit-il ?',
        targetId: null,
        sources: [],
        status: 'open',
        answer: null,
      });
    }
    if (!body.patientId && mentionsSeveralPatients(resolution)) {
      flags.push({
        id: `${id}:multiple`,
        kind: 'multiple-patients',
        question:
          'Cette dictée semble parler de plusieurs patients : faut-il la séparer en plusieurs notes ?',
        targetId: null,
        sources: [],
        status: 'open',
        answer: null,
      });
    }

    const transmission: Transmission = {
      id,
      unitId: unit.id,
      nurseId: body.nurseId,
      patientId: resolution.patientId,
      mode: body.mode,
      createdAt: toLocalIso(this.now(), unit.timeZone),
      dictation: {
        transcript: body.transcript,
        inputMethod: body.inputMethod,
        durationSec: body.durationSec ?? null,
      },
      resolution,
      content: outcome.content,
      flags,
      review: { status: 'draft', by: null, at: null },
      engine: {
        structuring: outcome.engine,
        degraded: outcome.degraded,
        durationMs: outcome.durationMs,
        rejected: outcome.rejected,
      },
    };
    this.deps.store.update((s) => {
      s.transmissions.push(transmission);
    });
    return transmission;
  }

  private mutateTransmission(
    transmissionId: string,
    mutate: (t: Transmission, s: { patients: Patient[] }) => void,
  ): Transmission {
    return this.deps.store.update((s) => {
      const t = s.transmissions.find((x) => x.id === transmissionId);
      if (!t) throw notFound('Transmission', transmissionId);
      mutate(t, s);
      return structuredClone(t);
    });
  }

  assignPatient(transmissionId: string, patientId: string, nurseId: string): Transmission {
    this.nurse(nurseId);
    const target = this.patient(patientId);
    return this.mutateTransmission(transmissionId, (t) => {
      if (target.unitId !== t.unitId)
        throw new AppError(422, 'wrong-unit', 'Ce patient est dans un autre service.');
      if (t.review.status === 'validated') {
        throw new AppError(
          409,
          'already-validated',
          'Transmission déjà validée : impossible de changer le patient.',
        );
      }
      t.patientId = patientId;
      t.resolution = { ...t.resolution, status: 'manual', patientId, confidence: 1, method: 'ide' };
      for (const f of t.flags) {
        if (f.kind === 'patient-ambiguous' && f.status === 'open') {
          f.status = 'answered';
          f.answer = displayName(target);
        }
      }
    });
  }

  editTransmission(
    transmissionId: string,
    input: { nurseId: string; edits: { itemId: string; text: string }[]; removals: string[] },
  ): Transmission {
    this.nurse(input.nurseId);
    const at = toLocalIso(this.now(), this.unit(this.transmission(transmissionId).unitId).timeZone);
    return this.mutateTransmission(transmissionId, (t) => {
      if (t.review.status === 'validated') {
        throw new AppError(
          409,
          'already-validated',
          'Transmission validée : elle ne peut plus être modifiée.',
        );
      }
      const lists = itemLists(t.content);
      for (const edit of input.edits) {
        const found = lists.flat().find((i) => i.id === edit.itemId);
        if (!found) throw notFound('Élément', edit.itemId);
        if (found.text !== edit.text) {
          found.text = edit.text;
          found.edited = true;
          found.sources.push({ kind: 'nurse', nurseId: input.nurseId, at });
        }
      }
      if (input.removals.length > 0) {
        const remove = new Set(input.removals);
        for (const list of lists) {
          for (let i = list.length - 1; i >= 0; i--)
            if (remove.has(list[i]?.id ?? '')) list.splice(i, 1);
        }
        t.content.targets = t.content.targets.filter(
          (x) => !remove.has(x.id) && x.data.length + x.actions.length + x.results.length > 0,
        );
      }
      t.flags = mergeFlags(t.flags, completenessFlags(t.id, t.content));
    });
  }

  review(transmissionId: string, decision: 'validate' | 'defer', nurseId: string): Transmission {
    this.nurse(nurseId);
    const tz = this.unit(this.transmission(transmissionId).unitId).timeZone;
    return this.mutateTransmission(transmissionId, (t, s) => {
      if (decision === 'validate') {
        if (!t.patientId) {
          throw new AppError(422, 'patient-required', 'Rattache d’abord la dictée à un patient.');
        }
        if (t.review.status !== 'validated') {
          const idx = s.patients.findIndex((p) => p.id === t.patientId);
          const p = s.patients[idx];
          if (p) s.patients[idx] = applyTransverseUpdates(p, t.content.transverse);
        }
        t.review = { status: 'validated', by: nurseId, at: toLocalIso(this.now(), tz) };
      } else {
        if (t.review.status === 'validated') {
          throw new AppError(409, 'already-validated', 'Transmission déjà validée.');
        }
        t.review = { status: 'unreviewed', by: nurseId, at: toLocalIso(this.now(), tz) };
      }
    });
  }

  answerFlag(
    transmissionId: string,
    flagId: string,
    input: { nurseId: string; answer?: string; dismiss?: boolean },
  ): Transmission {
    this.nurse(input.nurseId);
    const tz = this.unit(this.transmission(transmissionId).unitId).timeZone;
    if (!input.answer && !input.dismiss) {
      throw new AppError(400, 'answer-required', 'Donne une réponse ou écarte la question.');
    }
    return this.mutateTransmission(transmissionId, (t) => {
      const flag = t.flags.find((f) => f.id === flagId);
      if (!flag) throw notFound('Question', flagId);
      if (input.dismiss) {
        flag.status = 'dismissed';
        return;
      }
      const answer = input.answer ?? '';
      flag.status = 'answered';
      flag.answer = answer;
      if (flag.kind === 'missing-result' && flag.targetId) {
        const target = t.content.targets.find((x) => x.id === flag.targetId);
        if (target) {
          const item: SourcedItem = {
            id: this.deps.ids('it'),
            text: answer,
            sources: [{ kind: 'nurse', nurseId: input.nurseId, at: toLocalIso(this.now(), tz) }],
            edited: false,
          };
          target.results.push(item);
        }
      }
    });
  }

  deleteTransmission(transmissionId: string): void {
    const t = this.transmission(transmissionId);
    if (t.review.status === 'validated') {
      throw new AppError(
        409,
        'already-validated',
        'Une transmission validée ne peut pas être supprimée.',
      );
    }
    this.deps.store.update((s) => {
      s.transmissions = s.transmissions.filter((x) => x.id !== transmissionId);
    });
  }
}

/** Toutes les listes d'éléments éditables d'un contenu (références mutables). */
function itemLists(c: TransmissionContent): SourcedItem[][] {
  const lists: SourcedItem[][] = [c.observations, c.routine, c.todos, c.transverse];
  for (const t of c.targets) lists.push(t.data, t.actions, t.results);
  if (c.admission) {
    const a = c.admission;
    lists.push(a.motif, a.antecedents, a.histoire, a.autonomie, a.contexte);
  }
  return lists;
}
