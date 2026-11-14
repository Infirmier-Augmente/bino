import type { Appareil } from '../schemas/common';
import type { Patient } from '../schemas/hospital';
import type { Flag, Transmission, TransmissionContent } from '../schemas/transmission';

/**
 * CONTRÔLE DE COMPLÉTUDE — la forme acceptable du "challenge" :
 * on pose une question, on ne rend pas de verdict, on n'invente rien.
 * Le champ R (Résultats) est "le plus souvent oublié" (kit Foch).
 */

const RESULT_HINTS: Partial<Record<Appareil, string>> = {
  respiratoire: 'saturation, tolérance',
  neuro: 'état après l’épisode',
  hemodynamique: 'PA, FC après la prise en charge',
  douleur: 'douleur réévaluée après l’antalgique',
  digestif: 'tolérance, reprise alimentaire',
  renal: 'diurèse',
  cutane: 'aspect à la réfection',
  general: 'réévaluation',
  psy: 'état après l’échange',
};

export function missingResultQuestion(label: string, appareil: Appareil): string {
  const hint = RESULT_HINTS[appareil];
  return `Résultat non renseigné pour « ${label} » : quelle réévaluation${hint ? ` (${hint})` : ''} ?`;
}

export function completenessFlags(transmissionId: string, content: TransmissionContent): Flag[] {
  const flags: Flag[] = [];
  for (const target of content.targets) {
    if (target.results.length === 0) {
      flags.push({
        id: `${transmissionId}:missing-result:${target.id}`,
        kind: 'missing-result',
        question: missingResultQuestion(target.label, target.appareil),
        targetId: target.id,
        sources: [...target.data, ...target.actions].flatMap((i) => i.sources).slice(0, 3),
        status: 'open',
        answer: null,
      });
    }
  }
  if (content.admission) {
    if (content.admission.motif.length === 0) {
      flags.push({
        id: `${transmissionId}:admission:motif`,
        kind: 'imprecision',
        question: 'Motif d’entrée non dicté : peux-tu le préciser ?',
        targetId: null,
        sources: [],
        status: 'open',
        answer: null,
      });
    }
    const said = new Set(content.transverse.map((t) => t.field));
    if (!said.has('allergies')) {
      flags.push({
        id: `${transmissionId}:admission:allergies`,
        kind: 'missing-transverse',
        question: 'Allergies non mentionnées à l’entrée : à vérifier ?',
        targetId: null,
        sources: [],
        status: 'open',
        answer: null,
      });
    }
  }
  return flags;
}

/**
 * Fusionne les signalements recalculés avec l'existant : une question à laquelle
 * l'IDE a déjà répondu (ou qu'elle a écartée) ne réapparaît pas.
 */
export function mergeFlags(existing: readonly Flag[], computed: readonly Flag[]): Flag[] {
  const byId = new Map(existing.map((f) => [f.id, f]));
  const merged: Flag[] = computed.map((f) => {
    const prev = byId.get(f.id);
    return prev && prev.status !== 'open' ? prev : f;
  });
  // Conserve les signalements non recalculés (ex. venant du LLM : incohérences).
  for (const f of existing) {
    if (!merged.some((m) => m.id === f.id)) merged.push(f);
  }
  return merged;
}

/** Questions au niveau du dossier patient (infos transverses à ne jamais perdre). */
export function patientLevelFlags(patient: Patient): Flag[] {
  const flags: Flag[] = [];
  if (patient.transverse.allergies.status === 'inconnu') {
    flags.push({
      id: `patient:${patient.id}:allergies`,
      kind: 'missing-transverse',
      question: 'Allergies non renseignées : à vérifier avec le patient ou le dossier ?',
      targetId: null,
      sources: [],
      status: 'open',
      answer: null,
    });
  }
  if (patient.transverse.precautions.status === 'inconnu') {
    flags.push({
      id: `patient:${patient.id}:precautions`,
      kind: 'missing-transverse',
      question: 'Précautions complémentaires (BMR, BHRe…) non renseignées : à vérifier ?',
      targetId: null,
      sources: [],
      status: 'open',
      answer: null,
    });
  }
  return flags;
}

export function openFlags(transmissions: readonly Transmission[]): Flag[] {
  return transmissions.flatMap((t) => t.flags.filter((f) => f.status === 'open'));
}

/** Indicateur du kit : taux de transmissions DAR complètes (champ R rempli). */
export function darCompletionRate(transmissions: readonly Transmission[]): number | null {
  const targets = transmissions.flatMap((t) => t.content.targets);
  if (targets.length === 0) return null;
  return targets.filter((t) => t.results.length > 0).length / targets.length;
}
