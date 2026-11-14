import { Redirect } from 'expo-router';
import { useSession } from '@/features/session/store';

/** Point d'entrée : déjà connecté → Patients ; sinon → Connexion. */
export default function Index() {
  const nurse = useSession((s) => s.nurse);
  return <Redirect href={nurse ? '/patients' : '/connexion'} />;
}
