import type { SourceRef } from '../schemas/common';
import { type Patient, PRIORITY_RANK, type PriorityLevel } from '../schemas/hospital';
import { SEVERITY_RANK, type SeverityLevel, type Transmission } from '../schemas/transmission';
import type { EffectivePriority, PriorityReason, PrioritySuggestion } from '../schemas/views';
import { lexicalSeverity } from './lexicon';

/**
 * PRIORISATION — suggestion explicable, jamais une décision.
 * Chaque point de score a une raison lisible et, si possible, une source.
 * L'IDE garde la main : couleur manuelle et étoile ★ priment toujours.
 * Les poids sont ici, en clair, pour être ajustés vite par l'équipe.
 */
export const PRIORITY_WEIGHTS = {
  severity: { urgent: 100, preoccupant: 40, surveillance: 15, routine: 0 } satisfies Record<
    SeverityLevel,
    number
  >,
  missingResult: 10,
  unreviewedTransmission: 5,
  recentAdmission: 15,
  scheduledExam: 3,
  unknownTransverse: 2,
} as const;

const LEVEL_FROM_SEVERITY: Record<SeverityLevel, PriorityLevel> = {
  urgent: 'rouge',
  preoccupant: 'orange',
  surveillance: 'jaune',
  routine: 'vert',
};

function maxLevel(a: PriorityLevel, b: PriorityLevel): PriorityLevel {
  return PRIORITY_RANK[a] <= PRIORITY_RANK[b] ? a : b;
}

export interface PriorityInput {
  patient: Patient;
  /** Transmissions du poste en cours pour ce patient. */
  shiftTransmissions: readonly Transmission[];
  now: Date;
}

export function suggestPriority({
  patient,
  shiftTransmissions,
  now,
}: PriorityInput): PrioritySuggestion {
  const reasons: PriorityReason[] = [];
  let level: PriorityLevel = 'vert';
  const live = shiftTransmissions.filter((t) => t.patientId === patient.id);

  for (const t of live) {
    for (const target of t.content.targets) {
      const text = [target.label, ...target.data.map((d) => d.text)].join(' ');
      const sev: SeverityLevel = target.severity?.level ?? lexicalSeverity(text);
      if (SEVERITY_RANK[sev] > 0) {
        const sources: SourceRef[] = target.data.flatMap((d) => d.sources).slice(0, 2);
        reasons.push({ label: target.label, weight: PRIORITY_WEIGHTS.severity[sev], sources });
        level = maxLevel(level, LEVEL_FROM_SEVERITY[sev]);
      }
      if (target.results.length === 0 && SEVERITY_RANK[sev] > 0) {
        reasons.push({
          label: `Résultat non réévalué : ${target.label}`,
          weight: PRIORITY_WEIGHTS.missingResult,
          sources: [],
        });
      }
    }
  }

  const notReviewed = live.filter((t) => t.review.status !== 'validated').length;
  if (notReviewed > 0) {
    reasons.push({
      label:
        notReviewed === 1 ? '1 transmission non relue' : `${notReviewed} transmissions non relues`,
      weight: PRIORITY_WEIGHTS.unreviewedTransmission * notReviewed,
      sources: [],
    });
    level = maxLevel(level, 'jaune');
  }

  const hoursSinceAdmission = (now.getTime() - Date.parse(patient.admittedAt)) / 3_600_000;
  if (hoursSinceAdmission >= 0 && hoursSinceAdmission < 24) {
    reasons.push({
      label: 'Entrée de moins de 24 h',
      weight: PRIORITY_WEIGHTS.recentAdmission,
      sources: [{ kind: 'record', field: 'admittedAt', label: 'Date d’entrée' }],
    });
    level = maxLevel(level, 'jaune');
  }

  for (const exam of patient.transverse.examens) {
    reasons.push({
      label: `Examen programmé : ${exam.text}`,
      weight: PRIORITY_WEIGHTS.scheduledExam,
      sources: exam.sources,
    });
  }
  if (patient.transverse.allergies.status === 'inconnu') {
    reasons.push({
      label: 'Allergies non renseignées',
      weight: PRIORITY_WEIGHTS.unknownTransverse,
      sources: [],
    });
  }

  reasons.sort((a, b) => b.weight - a.weight);
  const score = reasons.reduce((s, r) => s + r.weight, 0);
  return { level, score, reasons };
}

export function effectivePriority(
  patient: Patient,
  suggestion: PrioritySuggestion,
): EffectivePriority {
  return {
    level: patient.priority.manualLevel ?? suggestion.level,
    origin: patient.priority.manualLevel ? 'manuelle' : 'suggeree',
    starred: patient.priority.starred,
    suggestion,
  };
}

/** Tri de la vue service : ★ d'abord, puis Rouge → Vert, puis score, puis chambre. */
export function comparePriority(
  a: { priority: EffectivePriority; room: string },
  b: { priority: EffectivePriority; room: string },
): number {
  if (a.priority.starred !== b.priority.starred) return a.priority.starred ? -1 : 1;
  const rank = PRIORITY_RANK[a.priority.level] - PRIORITY_RANK[b.priority.level];
  if (rank !== 0) return rank;
  const score = b.priority.suggestion.score - a.priority.suggestion.score;
  if (score !== 0) return score;
  return a.room.localeCompare(b.room, 'fr', { numeric: true });
}
