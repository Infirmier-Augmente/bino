import { z } from 'zod';
import { Id, IsoDate, IsoDateTime, SourcedItem } from './common';

// ─── Service (unité de soins) ────────────────────────────────────────────────

export const CareUnitKind = z.enum(['reanimation', 'medecine', 'chirurgie', 'urgences']);
export type CareUnitKind = z.infer<typeof CareUnitKind>;

/**
 * Trame de relève, déclinée par service ("une trame commune, déclinée par service").
 * - par-appareil : réanimation, relève détaillée (neuro, respi, hémodynamique…)
 * - sommaire     : services de soins, relève courte (motif, événements, à faire)
 */
export const HandoverTemplateId = z.enum(['par-appareil', 'sommaire']);
export type HandoverTemplateId = z.infer<typeof HandoverTemplateId>;

/** "HH:MM" heure locale. */
export const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const CareUnit = z.object({
  id: Id,
  name: z.string().min(1),
  kind: CareUnitKind,
  template: HandoverTemplateId,
  /** Libellé des chambres : "Box" en réa, "Chambre" en service. */
  roomPrefix: z.string().min(1),
  timeZone: z.string().min(1),
  shifts: z.object({
    dayStart: LocalTime,
    nightStart: LocalTime,
  }),
});
export type CareUnit = z.infer<typeof CareUnit>;

// ─── Soignant ────────────────────────────────────────────────────────────────

export const NurseRole = z.enum(['IDE', 'AS', 'cadre']);

export const Nurse = z.object({
  id: Id,
  unitId: Id,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: NurseRole,
});
export type Nurse = z.infer<typeof Nurse>;

// ─── Patient ─────────────────────────────────────────────────────────────────

export const Sex = z.enum(['F', 'M']);
export type Sex = z.infer<typeof Sex>;

export const PriorityLevel = z.enum(['rouge', 'orange', 'jaune', 'vert']);
export type PriorityLevel = z.infer<typeof PriorityLevel>;

export const PRIORITY_RANK: Record<PriorityLevel, number> = {
  rouge: 0,
  orange: 1,
  jaune: 2,
  vert: 3,
};

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  rouge: 'Rouge',
  orange: 'Orange',
  jaune: 'Jaune',
  vert: 'Vert',
};

/** Choix manuels de l'IDE. La suggestion automatique est recalculée, jamais stockée. */
export const PriorityState = z.object({
  starred: z.boolean(),
  manualLevel: PriorityLevel.nullable(),
  updatedAt: IsoDateTime.nullable(),
  updatedBy: Id.nullable(),
});
export type PriorityState = z.infer<typeof PriorityState>;

/**
 * Informations transverses à ne jamais perdre en relève (kit Foch, section 5).
 * "inconnu" = non renseigné → signalé dans la fiche, jamais deviné.
 */
export const TransverseInfo = z.object({
  allergies: z.object({
    status: z.enum(['inconnu', 'aucune', 'connues']),
    items: z.array(SourcedItem),
  }),
  precautions: z.object({
    status: z.enum(['inconnu', 'standard', 'complementaires']),
    items: z.array(SourcedItem),
  }),
  engagement: z.object({
    status: z.enum(['inconnu', 'pas-de-limitation', 'lata']),
    items: z.array(SourcedItem),
  }),
  examens: z.array(SourcedItem),
  prescriptions: z.array(SourcedItem),
  famille: z.array(SourcedItem),
  personneDeConfiance: z.array(SourcedItem),
});
export type TransverseInfo = z.infer<typeof TransverseInfo>;

export const TransverseField = z.enum([
  'allergies',
  'precautions',
  'engagement',
  'examens',
  'prescriptions',
  'famille',
  'personneDeConfiance',
]);
export type TransverseField = z.infer<typeof TransverseField>;

export const TRANSVERSE_LABELS: Record<TransverseField, string> = {
  allergies: 'Allergies',
  precautions: 'Précautions complémentaires',
  engagement: 'Niveau d’engagement thérapeutique',
  examens: 'Examens programmés',
  prescriptions: 'Nouvelles prescriptions',
  famille: 'Famille / proches',
  personneDeConfiance: 'Personne de confiance',
};

export const Patient = z.object({
  id: Id,
  unitId: Id,
  /** Identifiant permanent du patient (fictif). */
  ipp: z.string().min(1),
  /** Numéro de box / chambre, sans préfixe. */
  room: z.string().min(1),
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  sex: Sex,
  birthDate: IsoDate,
  admittedAt: IsoDateTime,
  admissionReason: z.string(),
  history: z.string().nullable(),
  transverse: TransverseInfo,
  assignedNurseId: Id.nullable(),
  priority: PriorityState,
  status: z.enum(['present', 'sorti']),
});
export type Patient = z.infer<typeof Patient>;

export function emptyTransverse(): TransverseInfo {
  return {
    allergies: { status: 'inconnu', items: [] },
    precautions: { status: 'inconnu', items: [] },
    engagement: { status: 'inconnu', items: [] },
    examens: [],
    prescriptions: [],
    famille: [],
    personneDeConfiance: [],
  };
}

export function defaultPriority(): PriorityState {
  return { starred: false, manualLevel: null, updatedAt: null, updatedBy: null };
}
