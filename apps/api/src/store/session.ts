import { AsyncLocalStorage } from 'node:async_hooks';
import type { HospitalState } from '@infirmier/domain';
import { HospitalStore } from './store';

/** Store de la requête en cours. Absent : on utilise le store du processus. */
export const requestStore = new AsyncLocalStorage<HospitalStore>();

export function activeStore(fallback: HospitalStore): HospitalStore {
  return requestStore.getStore() ?? fallback;
}

export const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_SESSIONS = 100;

/**
 * Une copie en mémoire du scénario propre par visiteur.
 * Rien n'est écrit sur le disque : un autre navigateur ne voit pas ces notes.
 */
export function openVisitorSessions(seed: HospitalState) {
  const sessions = new Map<string, { store: HospitalStore; seen: number }>();
  return {
    forId(id: string): HospitalStore {
      const found = sessions.get(id);
      if (found) {
        found.seen = Date.now();
        return found.store;
      }
      if (sessions.size >= MAX_SESSIONS) {
        let oldestId = '';
        let oldest = Infinity;
        for (const [key, value] of sessions) {
          if (value.seen < oldest) {
            oldest = value.seen;
            oldestId = key;
          }
        }
        if (oldestId) sessions.delete(oldestId);
      }
      const store = HospitalStore.inMemory(structuredClone(seed));
      sessions.set(id, { store, seen: Date.now() });
      return store;
    },
  };
}
