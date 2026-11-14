import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

interface SessionState {
  unitId: string | null;
  nurseId: string | null;
  /** Surcharge manuelle de l'adresse de l'API (réglages). */
  apiUrl: string | null;
  theme: ThemePreference;
  /** Affiche les dictées d'exemple (démo sans micro). */
  demoMode: boolean;
  /** Mode réunion : vue relève en grand, sans navigation. */
  meetingMode: boolean;
  hydrated: boolean;
  signIn(unitId: string, nurseId: string): void;
  signOut(): void;
  setApiUrl(url: string | null): void;
  setTheme(theme: ThemePreference): void;
  setDemoMode(on: boolean): void;
  setMeetingMode(on: boolean): void;
}

/** Préférences de l'appareil (persistées localement, aucune donnée patient). */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      unitId: null,
      nurseId: null,
      apiUrl: null,
      theme: 'system',
      demoMode: true,
      meetingMode: false,
      hydrated: false,
      signIn: (unitId, nurseId) => set({ unitId, nurseId }),
      signOut: () => set({ unitId: null, nurseId: null }),
      setApiUrl: (apiUrl) => set({ apiUrl }),
      setTheme: (theme) => set({ theme }),
      setDemoMode: (demoMode) => set({ demoMode }),
      setMeetingMode: (meetingMode) => set({ meetingMode }),
    }),
    {
      name: 'infirmier-augmente/session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ unitId, nurseId, apiUrl, theme, demoMode }) => ({
        unitId,
        nurseId,
        apiUrl,
        theme,
        demoMode,
      }),
      onRehydrateStorage: () => () => {
        useSession.setState({ hydrated: true });
      },
    },
  ),
);

/** Session obligatoire (écrans après connexion). */
export function useRequiredSession(): { unitId: string; nurseId: string } {
  const unitId = useSession((s) => s.unitId);
  const nurseId = useSession((s) => s.nurseId);
  return { unitId: unitId ?? '', nurseId: nurseId ?? '' };
}
