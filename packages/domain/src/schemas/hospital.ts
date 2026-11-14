import { z } from 'zod';
import { Id, IsoDate, IsoDateTime, SourcedItem, SourceRef } from './common';

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

/** Matricule de démo (chiffres). Pas une authentification réelle : CPS / e-CPS en V2. */
export const Matricule = z.string().regex(/^\d{3,10}$/);

export const Nurse = z.object({
  id: Id,
  unitId: Id,
  matricule: Matricule,
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

/** Affichage Bino : « Priorité 1 » (la plus urgente) à « Priorité 4 ». */
export const PRIORITY_NUMBER: Record<PriorityLevel, 1 | 2 | 3 | 4> = {
  rouge: 1,
  orange: 2,
  jaune: 3,
  vert: 4,
};

export const PRIORITY_BY_NUMBER: Record<1 | 2 | 3 | 4, PriorityLevel> = {
  1: 'rouge',
  2: 'orange',
  3: 'jaune',
  4: 'vert',
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

// ─── Constantes et dispositifs (dossier médical) ─────────────────────────────

/** Conscience, échelle ACVPU simplifiée : A = alerte, C = confusion / altérée (V, P, U comptent comme C). */
export const Consciousness = z.enum(['A', 'C']);
export type Consciousness = z.infer<typeof Consciousness>;

/** Valeurs mesurées (saisie manuelle ou dossier). Toutes > 0 ; pas de borne physiologique. */
export const VitalSigns = z.object({
  /** Fréquence respiratoire (/min). */
  respiratoryRate: z.number().positive(),
  /** SpO2 (%), échelle 1 du NEWS2. */
  spo2: z.number().positive(),
  /** Oxygène : true = sous O2, false = air ambiant. */
  onOxygen: z.boolean(),
  /** Pression artérielle systolique (mmHg). */
  systolic: z.number().positive(),
  /** Pression artérielle diastolique (mmHg), affichée, ne compte pas dans le NEWS2. */
  diastolic: z.number().positive(),
  /** Fréquence cardiaque (/min). */
  heartRate: z.number().positive(),
  /** Température (°C). */
  temperature: z.number().positive(),
  consciousness: Consciousness,
});
export type VitalSigns = z.infer<typeof VitalSigns>;

/** Dernier relevé de constantes, horodaté et sourcé (dossier ou soignant). */
export const Vitals = VitalSigns.extend({
  measuredAt: IsoDateTime,
  source: SourceRef,
});
export type Vitals = z.infer<typeof Vitals>;

/** Dispositif en place (drain, voie veineuse…), avec sa date de pose pour afficher « J2 ». */
export const Device = z.object({
  id: Id,
  label: z.string().min(1),
  insertedAt: IsoDateTime,
  source: SourceRef,
});
export type Device = z.infer<typeof Device>;

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
  /** Derniers relevés de constantes (null = pas de relevé). */
  vitals: Vitals.nullable(),
  devices: z.array(Device),
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
