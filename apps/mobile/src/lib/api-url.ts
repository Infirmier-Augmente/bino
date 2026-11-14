/**
 * Adresse de l'API, par ordre de priorité :
 * 1. réglage manuel dans l'app ;
 * 2. EXPO_PUBLIC_API_URL ;
 * 3. en web : même machine que la page, port 8787 ;
 * 4. en développement natif : IP de la machine qui sert le bundle Expo (même Wi-Fi) ;
 * 5. localhost.
 */
export const API_PORT = 8787;

export interface ApiUrlInputs {
  override: string | null;
  envUrl: string | undefined;
  /** window.location.hostname en web. */
  webHostname: string | null;
  /** Constants.expoConfig?.hostUri, ex. "192.168.1.20:8081". */
  expoHostUri: string | null | undefined;
}

export function resolveApiUrl({
  override,
  envUrl,
  webHostname,
  expoHostUri,
}: ApiUrlInputs): string {
  const clean = (u: string) => u.trim().replace(/\/+$/, '');
  if (override?.trim()) return clean(override);
  if (envUrl?.trim()) return clean(envUrl);
  if (webHostname) return `http://${webHostname}:${API_PORT}`;
  const host = expoHostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;
  return `http://localhost:${API_PORT}`;
}
