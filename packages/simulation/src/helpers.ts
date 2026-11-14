import {
  type Device,
  defaultPriority,
  emptyTransverse,
  fromLocal,
  type Patient,
  type SourcedItem,
  type SourceRef,
  type TransverseInfo,
  toLocalIso,
  type Vitals,
} from '@infirmier/domain';

const TZ = 'Europe/Paris';

/** Horloge d'une journée de scénario : `at('16:05')` → ISO avec le bon décalage. */
export function scenarioDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return (hhmm: string, dayOffset = 0): string => {
    const [hh, mm] = hhmm.split(':').map(Number);
    const local = fromLocal(
      { year: y ?? 2026, month: m ?? 1, day: (d ?? 1) + dayOffset, hour: hh ?? 0, minute: mm ?? 0 },
      TZ,
    );
    return toLocalIso(local, TZ);
  };
}

let recordSeq = 0;

/** Source « dossier patient » (DPI simulé). */
export function recordSource(field: string, label = 'Dossier patient (DPI simulé)'): SourceRef {
  return { kind: 'record', field, label };
}

/** Donnée issue du dossier patient (DPI simulé), avec sa source. */
export function record(field: string, text: string, label?: string): SourcedItem {
  recordSeq++;
  return {
    id: `rec_${field}_${recordSeq}`,
    text,
    sources: [recordSource(field, label)],
    edited: false,
  };
}

export interface PatientSeed {
  id: string;
  unitId: string;
  room: string;
  lastName: string;
  firstName: string;
  sex: 'F' | 'M';
  birthDate: string;
  admittedAt: string;
  admissionReason: string;
  history?: string;
  assignedNurseId?: string | null;
  transverse?: (t: TransverseInfo) => void;
  /** Dernières constantes du dossier (null par défaut : pas de relevé). */
  vitals?: Vitals | null;
  devices?: Device[];
}

/** Crée un patient FICTIF. L'IPP est dérivé de l'id (stable entre deux chargements). */
export function patient(seed: PatientSeed): Patient {
  const transverse = emptyTransverse();
  seed.transverse?.(transverse);
  return {
    id: seed.id,
    unitId: seed.unitId,
    ipp: `IPP-${seed.id.toUpperCase()}`,
    room: seed.room,
    lastName: seed.lastName,
    firstName: seed.firstName,
    sex: seed.sex,
    birthDate: seed.birthDate,
    admittedAt: seed.admittedAt,
    admissionReason: seed.admissionReason,
    history: seed.history ?? null,
    transverse,
    vitals: seed.vitals ?? null,
    devices: seed.devices ?? [],
    assignedNurseId: seed.assignedNurseId ?? null,
    priority: defaultPriority(),
    status: 'present',
  };
}
