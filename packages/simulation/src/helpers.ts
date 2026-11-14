import {
  defaultPriority,
  emptyTransverse,
  fromLocal,
  type Patient,
  type SourcedItem,
  type TransverseInfo,
  toLocalIso,
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

/** Donnée issue du dossier patient (DPI simulé), avec sa source. */
export function record(field: string, text: string): SourcedItem {
  recordSeq++;
  return {
    id: `rec_${field}_${recordSeq}`,
    text,
    sources: [{ kind: 'record', field, label: 'Dossier patient (DPI simulé)' }],
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
    assignedNurseId: seed.assignedNurseId ?? null,
    priority: defaultPriority(),
    status: 'present',
  };
}
