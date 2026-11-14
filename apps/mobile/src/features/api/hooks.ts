import type { CreateTransmissionBody, PriorityLevel, Transmission } from '@infirmier/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRequiredSession } from '@/features/session/store';
import { api } from './client';

/** Rafraîchissement de la vue relève : les dictées arrivent des téléphones. */
const LIVE = 5_000;

export const keys = {
  config: ['config'] as const,
  session: ['session'] as const,
  board: (unitId: string) => ['board', unitId] as const,
  recap: (unitId: string) => ['recap', unitId] as const,
  patient: (id: string) => ['patient', id] as const,
  handover: (id: string) => ['handover', id] as const,
  transmission: (id: string) => ['transmission', id] as const,
  search: (unitId: string, q: string) => ['search', unitId, q] as const,
  samples: (unitId: string) => ['samples', unitId] as const,
  scenarios: ['scenarios'] as const,
  simulation: ['simulation'] as const,
  dpi: ['dpi'] as const,
  fhir: (id: string) => ['fhir', id] as const,
};

export const useConfig = () =>
  useQuery({ queryKey: keys.config, queryFn: () => api.config(), retry: 1 });
export const useSessionInfo = () =>
  useQuery({ queryKey: keys.session, queryFn: () => api.session() });

export function useBoard(unitId: string) {
  return useQuery({
    queryKey: keys.board(unitId),
    queryFn: () => api.unitBoard({ params: { unitId } }),
    refetchInterval: LIVE,
    enabled: unitId.length > 0,
  });
}

export const useRecap = (unitId: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.recap(unitId),
    queryFn: () => api.unitRecap({ params: { unitId } }),
    enabled,
  });

export function usePatient(patientId: string) {
  return useQuery({
    queryKey: keys.patient(patientId),
    queryFn: () => api.patientDetail({ params: { patientId } }),
    refetchInterval: LIVE,
  });
}

export function useHandover(patientId: string | null) {
  return useQuery({
    queryKey: keys.handover(patientId ?? ''),
    queryFn: () => api.patientHandover({ params: { patientId: patientId ?? '' } }),
    enabled: !!patientId,
    refetchInterval: LIVE,
  });
}

export const useTransmission = (id: string) =>
  useQuery({
    queryKey: keys.transmission(id),
    queryFn: () => api.getTransmission({ params: { transmissionId: id } }),
  });

export const useSearch = (unitId: string, q: string) =>
  useQuery({
    queryKey: keys.search(unitId, q),
    queryFn: () => api.unitSearch({ params: { unitId }, query: { q } }),
    enabled: q.trim().length >= 2,
  });

export const useSamples = (unitId: string, enabled: boolean) =>
  useQuery({
    queryKey: keys.samples(unitId),
    queryFn: () => api.samples({ query: { unitId } }),
    enabled,
  });

export const useScenarios = () =>
  useQuery({ queryKey: keys.scenarios, queryFn: () => api.scenarios() });
export const useSimulationStatus = () =>
  useQuery({
    queryKey: keys.simulation,
    queryFn: () => api.simulationStatus(),
    refetchInterval: LIVE,
  });
export const useDpiInbox = () => useQuery({ queryKey: keys.dpi, queryFn: () => api.dpiInbox() });

/** Après toute écriture : on rafraîchit les vues qui en dépendent. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return (t?: Transmission) => {
    if (t) qc.setQueryData(keys.transmission(t.id), t);
    void qc.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== 'transmission' || q.queryKey[1] !== t?.id,
    });
  };
}

export function useCreateTransmission() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateTransmissionBody) => api.createTransmission({ body }),
    onSuccess: (t) => invalidate(t),
  });
}

export function useTransmissionActions(transmissionId: string) {
  const { nurseId } = useRequiredSession();
  const invalidate = useInvalidateAll();
  const params = { transmissionId };
  return {
    review: useMutation({
      mutationFn: (decision: 'validate' | 'defer') =>
        api.reviewTransmission({ params, body: { nurseId, decision } }),
      onSuccess: invalidate,
    }),
    assign: useMutation({
      mutationFn: (patientId: string) =>
        api.assignPatient({ params, body: { nurseId, patientId } }),
      onSuccess: invalidate,
    }),
    edit: useMutation({
      mutationFn: (input: { edits?: { itemId: string; text: string }[]; removals?: string[] }) =>
        api.editTransmission({
          params,
          body: { nurseId, edits: input.edits ?? [], removals: input.removals ?? [] },
        }),
      onSuccess: invalidate,
    }),
    answer: useMutation({
      mutationFn: (input: { flagId: string; answer?: string; dismiss?: boolean }) =>
        api.answerFlag({
          params: { transmissionId, flagId: input.flagId },
          body: { nurseId, answer: input.answer, dismiss: input.dismiss },
        }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: () => api.deleteTransmission({ params }),
      onSuccess: () => invalidate(),
    }),
  };
}

export function usePriorityActions(patientId: string) {
  const { nurseId } = useRequiredSession();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: { starred?: boolean; manualLevel?: PriorityLevel | null }) =>
      api.updatePriority({ params: { patientId }, body: { nurseId, ...input } }),
    onSuccess: () => invalidate(),
  });
}

export function useExportToDpi(patientId: string) {
  const { nurseId } = useRequiredSession();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: () => api.exportToDpi({ params: { patientId }, body: { nurseId } }),
    onSuccess: () => invalidate(),
  });
}

export function useSimulationActions() {
  const invalidate = useInvalidateAll();
  return {
    load: useMutation({
      mutationFn: (input: { scenarioId: string; until: string }) =>
        api.loadScenario({ body: input }),
      onSuccess: () => invalidate(),
    }),
    step: useMutation({
      mutationFn: (count: number) => api.stepScenario({ body: { count } }),
      onSuccess: () => invalidate(),
    }),
    clock: useMutation({
      mutationFn: (input: { mode: 'real' | 'simulated'; now?: string }) =>
        api.setClock({ body: input }),
      onSuccess: () => invalidate(),
    }),
  };
}
