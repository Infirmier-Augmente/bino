import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

let granted = false;
let recordingMode: Promise<void> | null = null;

/**
 * Autorisation du micro sans attente inutile : on VÉRIFIE d'abord (rapide), on ne DEMANDE
 * que si c'est nécessaire, et on s'en souvient pour la dictée suivante (retirer l'accès au
 * micro dans les réglages relance l'app).
 */
export async function ensureMicPermission(): Promise<boolean> {
  if (granted) return true;
  const current = await getRecordingPermissionsAsync();
  if (current.granted) {
    granted = true;
    return true;
  }
  if (!current.canAskAgain) return false;
  granted = (await requestRecordingPermissionsAsync()).granted;
  return granted;
}

/** Mode audio « enregistrement » (iOS : micro actif même en mode silencieux), réglé une fois. */
export function ensureRecordingMode(): Promise<void> {
  recordingMode ??= setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(
    (e: unknown) => {
      recordingMode = null;
      throw e;
    },
  );
  return recordingMode;
}
