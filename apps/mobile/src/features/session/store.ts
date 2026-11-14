import type { LoginResult } from '@infirmier/domain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PatientSort, SummarySort } from '@/lib/sort';

/** Identité du soignant connecté (affichage : prénom, « Connexion réussie »). */
export interface SessionNurse {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  role: 'IDE' | 'AS' | 'cadre';
}

/** Service du soignant : le fuseau sert à afficher la date et les heures. */
export interface SessionUnit {
  id: string;
  name: string;
  timeZone: string;
}

interface SessionState {
  nurse: SessionNurse | null;
  unit: SessionUnit | null;
  /** Surcharge manuelle de l'adresse de l'API (écran /serveur). */
  apiUrl: string | null;
  patientSort: PatientSort;
  summarySort: SummarySort;
  hydrated: boolean;
  signIn(result: LoginResult): void;
  signOut(): void;
  setApiUrl(url: string | null): void;
  setPatientSort(sort: PatientSort): void;
  setSummarySort(sort: SummarySort): void;
}

type Persisted = Pick<SessionState, 'nurse' | 'unit' | 'apiUrl' | 'patientSort' | 'summarySort'>;

/** Préférences de l'appareil (persistées localement, aucune donnée patient). */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      nurse: null,
      unit: null,
      apiUrl: null,
      patientSort: 'chambre',
      summarySort: 'prio',
      hydrated: false,
      signIn: ({ nurse, unit }) =>
        set({
          nurse: {
            id: nurse.id,
            matricule: nurse.matricule,
            firstName: nurse.firstName,
            lastName: nurse.lastName,
            role: nurse.role,
          },
          unit: { id: unit.id, name: unit.name, timeZone: unit.timeZone },
        }),
      // Les tris restent (préférence de l'appareil, comme dans le prototype).
      signOut: () => set({ nurse: null, unit: null }),
      setApiUrl: (apiUrl) => set({ apiUrl }),
      setPatientSort: (patientSort) => set({ patientSort }),
      setSummarySort: (summarySort) => set({ summarySort }),
    }),
    {
      name: 'infirmier-augmente/session',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ nurse, unit, apiUrl, patientSort, summarySort }): Persisted => ({
        nurse,
        unit,
        apiUrl,
        patientSort,
        summarySort,
      }),
      // v1 (choix du soignant sans mot de passe) : on garde l'adresse de l'API, on redemande la connexion.
      migrate: (old) => {
        const apiUrl =
          old && typeof old === 'object' && 'apiUrl' in old && typeof old.apiUrl === 'string'
            ? old.apiUrl
            : null;
        return { nurse: null, unit: null, apiUrl, patientSort: 'chambre', summarySort: 'prio' };
      },
      onRehydrateStorage: () => () => {
        useSession.setState({ hydrated: true });
      },
    },
  ),
);

const NO_NURSE: SessionNurse = { id: '', matricule: '', firstName: '', lastName: '', role: 'IDE' };
const NO_UNIT: SessionUnit = { id: '', name: '', timeZone: 'Europe/Paris' };

/** Session obligatoire (écrans derrière la connexion, protégés par le layout `(app)`). */
export function useRequiredSession(): { nurse: SessionNurse; unit: SessionUnit } {
  const nurse = useSession((s) => s.nurse);
  const unit = useSession((s) => s.unit);
  return { nurse: nurse ?? NO_NURSE, unit: unit ?? NO_UNIT };
}
