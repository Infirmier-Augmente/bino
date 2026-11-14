import type {
  ScenarioEvent,
  ScenarioSummary,
  SimulationStatus,
  Transmission,
} from '@infirmier/domain';
import { toLocalIso } from '@infirmier/domain';
import {
  getScenario,
  initialState,
  SCENARIOS,
  type Scenario,
  scenarioSummary,
} from '@infirmier/simulation';
import { AppError, notFound } from '../http/errors';
import type { HospitalStore } from '../store/store';
import { anchorClock } from './clock';
import type { HospitalService } from './hospital-service';

export interface StepResult {
  event: ScenarioEvent;
  transmission: Transmission | null;
}

/**
 * SIMULATEUR — rejoue un scénario à travers les VRAIS cas d'usage (pipeline IA compris).
 * Chaque événement avance l'horloge simulée à son heure.
 */
export class SimulationService {
  private log: SimulationStatus['log'] = [];
  /** Observateurs (évaluation, CLI) : appelés après chaque événement joué. */
  onStep: ((r: StepResult) => void) | null = null;

  constructor(
    private readonly store: HospitalStore,
    private readonly hospital: HospitalService,
    private readonly scenarios: readonly Scenario[] = SCENARIOS,
    private readonly realNow: () => Date = () => new Date(),
  ) {}

  list(): ScenarioSummary[] {
    return this.scenarios.map(scenarioSummary);
  }

  private current(): Scenario | null {
    const id = this.store.snapshot.simulation.scenarioId;
    return id ? (this.scenarios.find((s) => s.id === id) ?? getScenario(id) ?? null) : null;
  }

  status(): SimulationStatus {
    const scenario = this.current();
    const cursor = this.store.snapshot.simulation.cursor;
    const next = scenario?.events[cursor];
    const unit = this.store.snapshot.units[0];
    const tz = unit?.timeZone ?? 'Europe/Paris';
    return {
      scenarioId: scenario?.id ?? null,
      title: scenario?.title ?? null,
      cursor,
      total: scenario?.events.length ?? 0,
      now: toLocalIso(this.hospital.now(), tz),
      clockMode: this.store.snapshot.clock.mode,
      nextEvent: next ? { at: next.at, type: next.type, label: describe(next) } : null,
      log: [...this.log],
    };
  }

  async load(scenarioId: string, until: 'start' | 'end'): Promise<SimulationStatus> {
    const scenario = this.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) throw notFound('Scénario', scenarioId);
    const state = initialState(scenario);
    state.clock = anchorClock(scenario.startsAt, this.realNow());
    this.store.replace(state);
    this.log = [];
    if (until === 'end') await this.step(scenario.events.length);
    return this.status();
  }

  async step(count: number): Promise<SimulationStatus> {
    const scenario = this.current();
    if (!scenario) throw new AppError(409, 'no-scenario', 'Aucun scénario chargé.');
    for (let i = 0; i < count; i++) {
      const cursor = this.store.snapshot.simulation.cursor;
      const event = scenario.events[cursor];
      if (!event) break;
      this.store.update((s) => {
        s.clock = anchorClock(event.at, this.realNow());
      });
      const transmission = await this.apply(event);
      this.store.update((s) => {
        s.simulation.cursor = cursor + 1;
      });
      this.log.push({
        at: event.at,
        label: describe(event),
        transmissionId: transmission?.id ?? null,
      });
      this.onStep?.({ event, transmission });
    }
    return this.status();
  }

  setClock(mode: 'real' | 'simulated', now?: string): SimulationStatus {
    this.store.update((s) => {
      s.clock =
        mode === 'real'
          ? { mode: 'real', now: null, anchoredAt: null }
          : anchorClock(now ?? toLocalIso(this.hospital.now(), 'Europe/Paris'), this.realNow());
    });
    return this.status();
  }

  private async apply(event: ScenarioEvent): Promise<Transmission | null> {
    switch (event.type) {
      case 'dictation': {
        const unitId =
          this.store.snapshot.nurses.find((n) => n.id === event.nurseId)?.unitId ??
          this.current()?.unitId ??
          '';
        let t = await this.hospital.createTransmission({
          unitId,
          nurseId: event.nurseId,
          transcript: event.text,
          mode: event.mode ?? 'transmission',
          inputMethod: 'simulation',
          patientId: event.patientId ?? null,
        });
        if (event.review === 'validate' && t.patientId) {
          t = this.hospital.review(t.id, 'validate', event.nurseId);
        } else if (event.review === 'defer') {
          t = this.hospital.review(t.id, 'defer', event.nurseId);
        }
        return t;
      }
      case 'admit':
        this.hospital.admitPatient(event.patient, event.patientId);
        return null;
      case 'priority':
        this.hospital.updatePriority(event.patientId, {
          nurseId: event.nurseId,
          starred: event.starred,
          manualLevel: event.level,
        });
        return null;
      case 'narration':
        return null;
    }
  }
}

function describe(e: ScenarioEvent): string {
  switch (e.type) {
    case 'dictation':
      return e.label ?? `Dictée : ${e.text.slice(0, 50)}…`;
    case 'admit':
      return e.label ?? `Entrée : ${e.patient.lastName}`;
    case 'priority':
      return e.label ?? 'Changement de priorité';
    case 'narration':
      return e.label ?? e.text;
  }
}
