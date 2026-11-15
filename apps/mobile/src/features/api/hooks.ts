import type {
  CreateTransmissionBody,
  PatientDetail,
  PriorityLevel,
  UnitSummaries,
  VitalSigns,
} from '@infirmier/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRequiredSession } from '@/features/session/store';
import { api } from './client';

/** Rafraîchissement : les comptes rendus des collègues arrivent des autres téléphones. */
const LIVE = 5_000;

export const keys = {
  config: ['config'] as const,
  session: ['session'] as const,
  board: (unitId: string) => ['board', unitId] as const,
  patient: (id: string) => ['patient', id] as const,
  samples: (unitId: string) => ['samples', unitId] as const,
  reports: (nurseId: string) => ['reports', nurseId] as const,
  summaries: (unitId: string) => ['summaries', unitId] as const,
  scenarios: ['scenarios'] as const,
  simulation: ['simulation'] as const,
};

export const useConfig = () =>
  useQuery({ queryKey: keys.config, queryFn: () => api.config(), retry: 1 });

export const useSessionInfo = () =>
  useQuery({ queryKey: keys.session, queryFn: () => api.session(), retry: 0 });

export const useBoard = (unitId: string) =>
  useQuery({
    queryKey: keys.board(unitId),
    queryFn: () => api.unitBoard({ params: { unitId } }),
    refetchInterval: LIVE,
    enabled: unitId.length > 0,
  });

export const usePatient = (patientId: string) =>
  useQuery({
    queryKey: keys.patient(patientId),
    queryFn: () => api.patientDetail({ params: { patientId } }),
    refetchInterval: LIVE,
    enabled: patientId.length > 0,
  });

export const useSamples = (unitId: string) =>
  useQuery({
    queryKey: keys.samples(unitId),
    queryFn: () => api.samples({ query: { unitId } }),
    enabled: unitId.length > 0,
  });

export const useNurseReports = (nurseId: string) =>
  useQuery({
    queryKey: keys.reports(nurseId),
    queryFn: () => api.nurseReports({ params: { nurseId } }),
    refetchInterval: LIVE,
    enabled: nurseId.length > 0,
  });

export const useUnitSummaries = (unitId: string) =>
  useQuery({
    queryKey: keys.summaries(unitId),
    queryFn: () => api.unitSummaries({ params: { unitId } }),
    refetchInterval: LIVE,
    enabled: unitId.length > 0,
  });

export const useScenarios = () =>
  useQuery({ queryKey: keys.scenarios, queryFn: () => api.scenarios() });

export const useSimulationStatus = () =>
  useQuery({
    queryKey: keys.simulation,
    queryFn: () => api.simulationStatus(),
    refetchInterval: LIVE,
  });

// ─── Écritures ───────────────────────────────────────────────────────────────

/** Après toute écriture : on rafraîchit les vues qui en dépendent. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries();
}

/**
 * « Valider » = enregistrer le compte rendu (signé, horodaté). La structuration IA reste
 * à relire (`draft`) : jamais de validation automatique (décision de portage n° 1).
 */
export function useCreateReport() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateTransmissionBody) => api.createTransmission({ body }),
    onSuccess: invalidate,
  });
}

export function useUpdateVitals(patientId: string) {
  const { nurse } = useRequiredSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vitals: VitalSigns) =>
      api.updateVitals({ params: { patientId }, body: { nurseId: nurse.id, vitals } }),
    onSuccess: (detail: PatientDetail) => {
      qc.setQueryData(keys.patient(patientId), detail);
      void qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] !== 'patient' || q.queryKey[1] !== patientId,
      });
    },
  });
}

/** Choix manuel de la priorité (prime toujours sur la suggestion). */
export function useSetPriority(unitId: string) {
  const { nurse } = useRequiredSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { patientId: string; level: PriorityLevel }) =>
      api.updatePriority({
        params: { patientId: input.patientId },
        body: { nurseId: nurse.id, manualLevel: input.level },
      }),
    onSuccess: (item) => {
      // Re-tri immédiat avec la priorité renvoyée, puis rafraîchissement complet.
      qc.setQueryData<UnitSummaries>(keys.summaries(unitId), (prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) =>
                r.patient.id === item.patient.id ? { ...r, priority: item.priority } : r,
              ),
            }
          : prev,
      );
      void qc.invalidateQueries();
    },
  });
}

export function useSimulationActions() {
  const invalidate = useInvalidateAll();
  return {
    load: useMutation({
      mutationFn: (input: { scenarioId: string; until: string }) =>
        api.loadScenario({ body: input }),
      onSuccess: invalidate,
    }),
    step: useMutation({
      mutationFn: (count: number) => api.stepScenario({ body: { count } }),
      onSuccess: invalidate,
    }),
  };
}
