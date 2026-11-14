import { Redirect } from 'expo-router';
import { useSession } from '@/features/session/store';

/** Point d'entrée : sans soignant choisi → écran de prise de poste. */
export default function Index() {
  const nurseId = useSession((s) => s.nurseId);
  return <Redirect href={nurseId ? '/patients' : '/bienvenue'} />;
}
