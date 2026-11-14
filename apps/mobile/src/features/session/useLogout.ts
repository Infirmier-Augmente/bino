import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useDrafts } from '@/features/report/drafts';
import { useSession } from './store';

/**
 * Déconnexion, sans confirmation (comme le prototype) : on oublie le soignant, ses
 * brouillons et le cache des vues ; les tris (préférences de l'appareil) restent.
 */
export function useLogout(): () => void {
  const qc = useQueryClient();
  const signOut = useSession((s) => s.signOut);
  const clearDrafts = useDrafts((s) => s.clearAll);
  return () => {
    router.replace('/connexion');
    signOut();
    clearDrafts();
    qc.clear();
  };
}
