import { z } from 'zod';
import { Id, IsoDateTime } from '../schemas/common';
import { Matricule, Patient, PriorityLevel, VitalSigns } from '../schemas/hospital';
import { NewPatientInput, ScenarioSummary, SimulationStatus } from '../schemas/simulation';
import { InputMethod, Transmission, TransmissionMode } from '../schemas/transmission';
import {
  DpiExport,
  HandoverSheet,
  LoginResult,
  NurseReport,
  PatientDetail,
  PatientListItem,
  RecapLine,
  SearchHit,
  SessionInfo,
  UnitBoard,
  UnitSummaries,
} from '../schemas/views';

/**
 * CONTRAT D'API — source unique de vérité entre le mobile et le serveur.
 *
 * Ajouter un endpoint :
 *   1. le déclarer ici (méthode, chemin, schémas zod) ;
 *   2. l'implémenter dans apps/api/src/http/routes.ts (TypeScript refuse de compiler sinon) ;
 *   3. l'appeler côté mobile via `api.<nom>(...)` : entrées ET sorties sont typées
 *      et la réponse est validée à l'exécution (une dérive serveur/mobile casse tout de suite).
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface EndpointDef {
  method: HttpMethod;
  path: string;
  summary: string;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  response: z.ZodType;
}

function endpoint<const E extends EndpointDef>(e: E): E {
  return e;
}

const unitParams = z.object({ unitId: Id });
const patientParams = z.object({ patientId: Id });
const transmissionParams = z.object({ transmissionId: Id });
const nurseParams = z.object({ nurseId: Id });

export const AiStatus = z.object({
  version: z.string(),
  llm: z.object({
    provider: z.string(),
    model: z.string().nullable(),
    ready: z.boolean(),
    fallback: z.string().nullable(),
  }),
  stt: z.object({ provider: z.string(), model: z.string().nullable(), ready: z.boolean() }),
  classifier: z.object({ provider: z.string(), ready: z.boolean() }),
});
export type AiStatus = z.infer<typeof AiStatus>;

export const SampleDictation = z.object({
  id: z.string(),
  scenarioId: z.string(),
  label: z.string(),
  text: z.string(),
  mode: TransmissionMode,
  patientId: Id.nullable(),
});
export type SampleDictation = z.infer<typeof SampleDictation>;

export const CreateTransmissionBody = z.object({
  unitId: Id,
  nurseId: Id,
  transcript: z.string().trim().min(3, 'La dictée est vide.'),
  mode: TransmissionMode,
  inputMethod: InputMethod,
  /** Patient présélectionné (dictée lancée depuis sa fiche). */
  patientId: Id.nullable().optional(),
  durationSec: z.number().nonnegative().nullable().optional(),
});
export type CreateTransmissionBody = z.infer<typeof CreateTransmissionBody>;

/** Connexion de démo : matricule + mot de passe partagé (pas une authentification réelle). */
export const LoginBody = z.object({
  matricule: z.string().trim().pipe(Matricule),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const api = {
  health: endpoint({
    method: 'GET',
    path: '/health',
    summary: 'Vérifie que le serveur répond.',
    response: z.object({ ok: z.literal(true) }),
  }),
  config: endpoint({
    method: 'GET',
    path: '/config',
    summary: 'Fournisseurs IA configurés (LLM, speech-to-text, classifieur).',
    response: AiStatus,
  }),
  session: endpoint({
    method: 'GET',
    path: '/session',
    summary: 'Services et soignants disponibles (écran de connexion).',
    response: SessionInfo,
  }),
  login: endpoint({
    method: 'POST',
    path: '/session/login',
    summary: 'Connexion de démo par matricule et mot de passe (401 si incorrect).',
    body: LoginBody,
    response: LoginResult,
  }),

  // ─── Service ───────────────────────────────────────────────────────────────
  unitPatients: endpoint({
    method: 'GET',
    path: '/units/:unitId/patients',
    summary: 'Patients du service, triés par priorité.',
    params: unitParams,
    response: z.array(PatientListItem),
  }),
  unitBoard: endpoint({
    method: 'GET',
    path: '/units/:unitId/board',
    summary: 'Vue service de la relève (tri ★ puis Rouge → Vert).',
    params: unitParams,
    response: UnitBoard,
  }),
  unitRecap: endpoint({
    method: 'GET',
    path: '/units/:unitId/recap',
    summary: 'Récap "taille SMS", une ligne par patient.',
    params: unitParams,
    response: z.array(RecapLine),
  }),
  unitSearch: endpoint({
    method: 'GET',
    path: '/units/:unitId/search',
    summary: 'Recherche plein texte dans les dictées : renvoie des extraits sourcés.',
    params: unitParams,
    query: z.object({ q: z.string().min(1) }),
    response: z.array(SearchHit),
  }),
  unitSummaries: endpoint({
    method: 'GET',
    path: '/units/:unitId/summaries',
    summary:
      "Transmissions de toute l'équipe (onglet « Tous ») : une carte par patient, puces sourcées par thème, priorité et NEWS2.",
    params: unitParams,
    response: UnitSummaries,
  }),

  // ─── Soignant ──────────────────────────────────────────────────────────────
  nurseReports: endpoint({
    method: 'GET',
    path: '/nurses/:nurseId/reports',
    summary: 'Comptes rendus du soignant sur le poste (« Mes CR »), du plus récent au plus ancien.',
    params: nurseParams,
    response: z.array(NurseReport),
  }),

  // ─── Patient ───────────────────────────────────────────────────────────────
  patientDetail: endpoint({
    method: 'GET',
    path: '/patients/:patientId',
    summary: 'Dossier patient + transmissions.',
    params: patientParams,
    response: PatientDetail,
  }),
  patientHandover: endpoint({
    method: 'GET',
    path: '/patients/:patientId/handover',
    summary: 'Fiche de relève du poste en cours.',
    params: patientParams,
    response: HandoverSheet,
  }),
  updateVitals: endpoint({
    method: 'PUT',
    path: '/patients/:patientId/vitals',
    summary:
      'Saisie manuelle des constantes (horodatées, source = soignant) ; renvoie le dossier recalculé.',
    params: patientParams,
    body: z.object({ nurseId: Id, vitals: VitalSigns }),
    response: PatientDetail,
  }),
  updatePriority: endpoint({
    method: 'PATCH',
    path: '/patients/:patientId/priority',
    summary: 'Étoile ★ et/ou couleur manuelle (null = revenir à la suggestion).',
    params: patientParams,
    body: z.object({
      nurseId: Id,
      starred: z.boolean().optional(),
      manualLevel: PriorityLevel.nullable().optional(),
    }),
    response: PatientListItem,
  }),
  admitPatient: endpoint({
    method: 'POST',
    path: '/patients',
    summary: 'Entrée d’un nouveau patient (avant la dictée d’admission).',
    body: NewPatientInput,
    response: Patient,
  }),
  patientFhir: endpoint({
    method: 'GET',
    path: '/patients/:patientId/fhir',
    summary: 'Aperçu de l’export FHIR R4 des transmissions du poste.',
    params: patientParams,
    response: z.record(z.string(), z.unknown()),
  }),
  exportToDpi: endpoint({
    method: 'POST',
    path: '/patients/:patientId/export',
    summary: 'Envoie les transmissions du poste au DPI simulé.',
    params: patientParams,
    body: z.object({ nurseId: Id }),
    response: DpiExport,
  }),

  // ─── Transmissions ─────────────────────────────────────────────────────────
  createTransmission: endpoint({
    method: 'POST',
    path: '/transmissions',
    summary: 'Dictée → patient identifié → transmissions DAR sourcées (à relire).',
    body: CreateTransmissionBody,
    response: Transmission,
  }),
  getTransmission: endpoint({
    method: 'GET',
    path: '/transmissions/:transmissionId',
    summary: 'Une transmission.',
    params: transmissionParams,
    response: Transmission,
  }),
  assignPatient: endpoint({
    method: 'PATCH',
    path: '/transmissions/:transmissionId/patient',
    summary: 'Rattache (ou corrige) le patient d’une dictée.',
    params: transmissionParams,
    body: z.object({ nurseId: Id, patientId: Id }),
    response: Transmission,
  }),
  editTransmission: endpoint({
    method: 'PATCH',
    path: '/transmissions/:transmissionId',
    summary: 'Corrige la formulation d’éléments ou en retire.',
    params: transmissionParams,
    body: z.object({
      nurseId: Id,
      edits: z.array(z.object({ itemId: Id, text: z.string().trim().min(1) })).default([]),
      removals: z.array(Id).default([]),
    }),
    response: Transmission,
  }),
  reviewTransmission: endpoint({
    method: 'POST',
    path: '/transmissions/:transmissionId/review',
    summary: 'Valider (1 clic) ou marquer "non relue".',
    params: transmissionParams,
    body: z.object({ nurseId: Id, decision: z.enum(['validate', 'defer']) }),
    response: Transmission,
  }),
  answerFlag: endpoint({
    method: 'POST',
    path: '/transmissions/:transmissionId/flags/:flagId',
    summary: 'Répondre à une question (ex. compléter le R) ou l’écarter.',
    params: z.object({ transmissionId: Id, flagId: Id }),
    body: z.object({
      nurseId: Id,
      answer: z.string().trim().min(1).optional(),
      dismiss: z.boolean().optional(),
    }),
    response: Transmission,
  }),
  deleteTransmission: endpoint({
    method: 'DELETE',
    path: '/transmissions/:transmissionId',
    summary: 'Supprime une dictée (avant validation).',
    params: transmissionParams,
    response: z.object({ ok: z.literal(true) }),
  }),

  // ─── DPI simulé ────────────────────────────────────────────────────────────
  dpiInbox: endpoint({
    method: 'GET',
    path: '/dpi/inbox',
    summary: 'Ce que le DPI simulé a reçu.',
    response: z.array(DpiExport),
  }),

  // ─── Simulation ────────────────────────────────────────────────────────────
  scenarios: endpoint({
    method: 'GET',
    path: '/simulation/scenarios',
    summary: 'Scénarios disponibles.',
    response: z.array(ScenarioSummary),
  }),
  samples: endpoint({
    method: 'GET',
    path: '/simulation/samples',
    summary: 'Dictées d’exemple (mode démo, sans micro).',
    query: z.object({ unitId: Id.optional() }),
    response: z.array(SampleDictation),
  }),
  simulationStatus: endpoint({
    method: 'GET',
    path: '/simulation/status',
    summary: 'État du simulateur (scénario, horloge, prochain événement).',
    response: SimulationStatus,
  }),
  loadScenario: endpoint({
    method: 'POST',
    path: '/simulation/load',
    summary: 'Réinitialise l’hôpital sur un scénario (au début ou rejoué jusqu’à la fin).',
    body: z.object({
      scenarioId: z.string(),
      /** 'start', 'end', ou une heure : rejoue les événements antérieurs puis cale l'horloge dessus. */
      until: z.union([z.enum(['start', 'end']), IsoDateTime]).default('start'),
    }),
    response: SimulationStatus,
  }),
  stepScenario: endpoint({
    method: 'POST',
    path: '/simulation/step',
    summary: 'Joue les N prochains événements du scénario.',
    body: z.object({ count: z.number().int().min(1).max(100).default(1) }),
    response: SimulationStatus,
  }),
  setClock: endpoint({
    method: 'POST',
    path: '/simulation/clock',
    summary: 'Horloge réelle ou simulée.',
    body: z.object({ mode: z.enum(['real', 'simulated']), now: IsoDateTime.optional() }),
    response: SimulationStatus,
  }),
} as const;

export type ApiContract = typeof api;
export type EndpointName = keyof ApiContract;

type ParamsOf<E> = E extends { params: infer P extends z.ZodType }
  ? { params: z.input<P> }
  : unknown;
type QueryOf<E> = E extends { query: infer Q extends z.ZodType } ? { query: z.input<Q> } : unknown;
type BodyOf<E> = E extends { body: infer B extends z.ZodType } ? { body: z.input<B> } : unknown;

/** Ce que le client envoie. */
export type ApiInput<K extends EndpointName> = ParamsOf<ApiContract[K]> &
  QueryOf<ApiContract[K]> &
  BodyOf<ApiContract[K]>;

/** Ce que le serveur reçoit après validation. */
type ParsedParams<E> = E extends { params: infer P extends z.ZodType } ? z.output<P> : undefined;
type ParsedQuery<E> = E extends { query: infer Q extends z.ZodType } ? z.output<Q> : undefined;
type ParsedBody<E> = E extends { body: infer B extends z.ZodType } ? z.output<B> : undefined;

export interface ApiParsedInput<K extends EndpointName> {
  params: ParsedParams<ApiContract[K]>;
  query: ParsedQuery<ApiContract[K]>;
  body: ParsedBody<ApiContract[K]>;
}

export type ApiOutput<K extends EndpointName> = z.output<ApiContract[K]['response']>;

/** Corps d'erreur standard renvoyé par l'API. */
export const ApiErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

/** Remplace les ":param" du chemin. */
export function buildPath(path: string, params: Record<string, string> | undefined): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => {
    const v = params?.[name];
    if (v === undefined) throw new Error(`Paramètre manquant : ${name}`);
    return encodeURIComponent(v);
  });
}
