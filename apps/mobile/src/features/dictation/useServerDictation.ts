import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { currentApiUrl } from '@/features/api/client';

export const MIC_REFUSED = 'Micro refusé : tu peux taper le texte.';
export const DICTATION_UNAVAILABLE = 'Dictée indisponible ici : utilise le micro du clavier.';

/** Résultat d'une transcription : le texte, ou un message lisible pour l'IDE. */
export type SttOutcome = { ok: true; text: string } | { ok: false; error: string };

async function upload(uri: string): Promise<string> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('audio', blob, 'dictee.webm');
  } else {
    // React Native accepte un objet { uri, name, type } dans FormData.
    form.append('audio', { uri, name: 'dictee.m4a', type: 'audio/m4a' } as unknown as Blob);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(`${currentApiUrl()}/transcriptions`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
  } catch {
    throw new Error(
      controller.signal.aborted
        ? 'La transcription prend trop de temps. Réessaie l’envoi.'
        : 'Serveur injoignable pour la transcription. Réessaie l’envoi.',
    );
  } finally {
    clearTimeout(timer);
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Réponse non JSON (proxy, page d'erreur) : message lisible plutôt qu'une erreur technique.
  }
  if (!res.ok || !json || typeof json !== 'object' || !('text' in json)) {
    const message =
      json && typeof json === 'object' && 'error' in json
        ? (json as { error: { message: string } }).error.message
        : `Transcription impossible (erreur ${res.status}).`;
    throw new Error(message);
  }
  const { text } = json as { text: unknown };
  return typeof text === 'string' ? text : '';
}

/**
 * Enregistrement audio + transcription par le serveur (STT configuré côté API :
 * Whisper, Groq, serveur auto-hébergé…). Le texte arrive à la fin de l'enregistrement.
 */
export function useServerDictation() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [transcribing, setTranscribing] = useState(false);
  /** Dernier enregistrement non transcrit : on peut réessayer sans redicter. */
  const [pendingUri, setPendingUri] = useState<string | null>(null);

  /** Démarre l'enregistrement ; renvoie un message d'erreur, ou null si tout va bien. */
  const start = useCallback(async (): Promise<string | null> => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return MIC_REFUSED;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      return null;
    } catch {
      return DICTATION_UNAVAILABLE;
    }
  }, [recorder]);

  const send = useCallback(async (uri: string): Promise<SttOutcome> => {
    setTranscribing(true);
    try {
      const text = await upload(uri);
      setPendingUri(null);
      return { ok: true, text };
    } catch (e) {
      setPendingUri(uri);
      return { ok: false, error: e instanceof Error ? e.message : 'Transcription impossible.' };
    } finally {
      setTranscribing(false);
    }
  }, []);

  const stop = useCallback(async (): Promise<SttOutcome> => {
    await recorder.stop();
    const uri = recorder.uri;
    return uri ? send(uri) : { ok: false, error: 'Enregistrement vide.' };
  }, [recorder, send]);

  const retry = useCallback(
    async (): Promise<SttOutcome> =>
      pendingUri ? send(pendingUri) : { ok: false, error: 'Rien à renvoyer.' },
    [pendingUri, send],
  );

  return {
    recording: state.isRecording,
    transcribing,
    canRetry: pendingUri !== null,
    start,
    stop,
    retry,
  };
}
