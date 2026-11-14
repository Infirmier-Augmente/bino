import type { InputMethod } from '@infirmier/domain';
import { create } from 'zustand';
import { type DraftEvent, nextInputMethod } from '@/lib/report';

export interface Draft {
  text: string;
  inputMethod: InputMethod;
}

export const EMPTY_DRAFT: Draft = { text: '', inputMethod: 'keyboard' };

interface DraftsState {
  drafts: Record<string, Draft>;
  update(patientId: string, text: string, event: DraftEvent): void;
  clear(patientId: string): void;
  clearAll(): void;
}

/**
 * Brouillons des comptes rendus, par patient, EN MÉMOIRE seulement (jamais écrits sur
 * l'appareil : ce sont des données de santé). Fermer la fiche ne perd pas le texte.
 */
export const useDrafts = create<DraftsState>()((set) => ({
  drafts: {},
  update: (patientId, text, event) =>
    set((s) => {
      const prev = s.drafts[patientId] ?? EMPTY_DRAFT;
      return {
        drafts: {
          ...s.drafts,
          [patientId]: { text, inputMethod: nextInputMethod(prev.inputMethod, event) },
        },
      };
    }),
  clear: (patientId) =>
    set((s) => ({
      drafts: Object.fromEntries(Object.entries(s.drafts).filter(([id]) => id !== patientId)),
    })),
  clearAll: () => set({ drafts: {} }),
}));
