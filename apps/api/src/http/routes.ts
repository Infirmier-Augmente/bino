import { sampleDictations } from '@infirmier/simulation';
import type { HospitalService } from '../services/hospital-service';
import type { SimulationService } from '../services/simulation-service';
import type { TeamService } from '../services/team-service';
import type { Handlers } from './contract-adapter';

export interface RouteDeps {
  hospital: HospitalService;
  team: TeamService;
  simulation: SimulationService;
  status: () => ReturnType<import('@infirmier/ai').AiServices['status']>;
}

/**
 * Implémentation de CHAQUE endpoint du contrat (packages/domain/src/api/contract.ts).
 * Les handlers restent fins : la logique est dans les services.
 */
export function createHandlers({ hospital, team, simulation, status }: RouteDeps): Handlers {
  return {
    health: () => ({ ok: true }),
    config: () => status(),
    session: () => hospital.session(),
    login: ({ body }) => team.login(body),

    unitPatients: ({ params }) => hospital.unitPatients(params.unitId),
    unitBoard: ({ params }) => hospital.unitBoard(params.unitId),
    unitRecap: ({ params }) => hospital.unitRecap(params.unitId),
    unitSearch: ({ params, query }) => hospital.search(params.unitId, query.q),
    unitSummaries: ({ params }) => team.unitSummaries(params.unitId),

    nurseReports: ({ params }) => team.nurseReports(params.nurseId),

    patientDetail: ({ params }) => hospital.patientDetail(params.patientId),
    patientHandover: ({ params }) => hospital.handover(params.patientId),
    updateVitals: ({ params, body }) =>
      team.updateVitals(params.patientId, body.nurseId, body.vitals),
    updatePriority: ({ params, body }) => hospital.updatePriority(params.patientId, body),
    admitPatient: ({ body }) => hospital.admitPatient(body),
    patientFhir: ({ params }) => hospital.fhir(params.patientId),
    exportToDpi: ({ params, body }) => hospital.exportToDpi(params.patientId, body.nurseId),

    createTransmission: ({ body }) => hospital.createTransmission(body),
    getTransmission: ({ params }) => hospital.transmission(params.transmissionId),
    assignPatient: ({ params, body }) =>
      hospital.assignPatient(params.transmissionId, body.patientId, body.nurseId),
    editTransmission: ({ params, body }) => hospital.editTransmission(params.transmissionId, body),
    reviewTransmission: ({ params, body }) =>
      hospital.review(params.transmissionId, body.decision, body.nurseId),
    answerFlag: ({ params, body }) =>
      hospital.answerFlag(params.transmissionId, params.flagId, body),
    deleteTransmission: ({ params }) => {
      hospital.deleteTransmission(params.transmissionId);
      return { ok: true };
    },

    dpiInbox: () => hospital.dpiInbox(),

    scenarios: () => simulation.list(),
    samples: ({ query }) => sampleDictations(query.unitId),
    simulationStatus: () => simulation.status(),
    loadScenario: ({ body }) => simulation.load(body.scenarioId, body.until),
    stepScenario: ({ body }) => simulation.step(body.count),
    setClock: ({ body }) => simulation.setClock(body.mode, body.now),
  };
}
