import { ApiError, createApiClient } from '@infirmier/domain';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useSession } from '@/features/session/store';
import { resolveApiUrl } from '@/lib/api-url';

export function currentApiUrl(): string {
  return resolveApiUrl({
    override: useSession.getState().apiUrl,
    envUrl: process.env.EXPO_PUBLIC_API_URL,
    webHostname:
      Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : null,
    expoHostUri: Constants.expoConfig?.hostUri ?? null,
  });
}

/** Client typé unique de l'app (généré depuis le contrat partagé). */
export const api = createApiClient({ baseUrl: currentApiUrl, timeoutMs: 90_000 });

/** Message lisible pour l'IDE, quelle que soit l'erreur. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Une erreur est survenue.';
}
