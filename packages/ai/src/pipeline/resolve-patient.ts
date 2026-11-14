import {
  matchPatients,
  type Patient,
  type PatientResolution,
  resolveFromCandidates,
} from '@infirmier/domain';
import type { ClassifierPort } from '../classifier/port';

const MIN_CONFIDENCE = 0.6;
const CLASSIFIER_TIMEOUT_MS = 8_000;

/**
 * Rattachement patient : règles déterministes d'abord ; si doute et qu'un
 * classifieur sémantique est disponible (Jev, LLM), il départage.
 * S'il hésite encore : on DEMANDE à l'infirmière.
 */
export async function resolvePatient(
  transcript: string,
  patients: readonly Patient[],
  opts: {
    classifier: ClassifierPort;
    preferredPatientIds?: readonly string[];
    ageOf: (p: Patient) => number;
  },
): Promise<PatientResolution> {
  const match = matchPatients(transcript, patients, {
    preferredPatientIds: opts.preferredPatientIds,
  });
  const base = resolveFromCandidates(match);
  if (base.status === 'resolved' || !opts.classifier.semantic) return base;

  // Candidats à départager : ceux trouvés par les règles, sinon les patients de l'IDE.
  const pool =
    base.candidates.length > 0
      ? patients.filter((p) => base.candidates.some((c) => c.patientId === p.id))
      : patients.filter((p) => opts.preferredPatientIds?.includes(p.id));
  if (pool.length === 0 || pool.length > 30) return base;

  try {
    const options: Record<string, string> = Object.fromEntries(
      pool.map((p) => [
        p.id,
        `chambre ${p.room}, ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.lastName} ${p.firstName}, ${opts.ageOf(p)} ans, hospitalisé(e) pour ${p.admissionReason}`,
      ]),
    );
    options.aucun = 'La dictée ne permet pas de savoir de quel patient il s’agit';
    const { patient } = await opts.classifier.ask(
      { dictee: transcript.slice(0, 600) },
      {
        patient: {
          type: 'choice',
          instructions:
            'De quel patient parle l’infirmière dans `dictee` ? Elle le désigne en général au début, par sa chambre, son nom ou son genre.',
          options,
        },
      },
      AbortSignal.timeout(CLASSIFIER_TIMEOUT_MS),
    );
    const inPool = pool.some((p) => p.id === patient.choice);
    if (inPool && patient.confidence >= MIN_CONFIDENCE) {
      return {
        ...base,
        status: 'resolved',
        patientId: patient.choice,
        confidence: patient.confidence,
        method: `regles+${opts.classifier.id}`,
      };
    }
  } catch {
    // Classifieur indisponible : on garde le résultat des règles (et on demandera à l'IDE).
  }
  return base;
}
