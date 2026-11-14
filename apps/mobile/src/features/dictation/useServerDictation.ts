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

interface TranscriptionResponse {
  text: string;
  durationSec: number | null;
  engine: string;
}

async function upload(uri: string): Promise<TranscriptionResponse> {
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
  return json as TranscriptionResponse;
}

/**
 * Enregistrement audio + transcription par le serveur (STT configuré côté API :
 * Whisper, Groq, serveur auto-hébergé…). Utilisé quand le navigateur ne sait pas
 * transcrire lui-même (application native notamment).
 */
export function useServerDictation() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Dernier enregistrement non transcrit : on peut réessayer sans redicter. */
  const [pendingUri, setPendingUri] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError('Micro refusé : autorise-le dans les réglages du téléphone.');
      return false;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  }, [recorder]);

  const send = useCallback(async (uri: string): Promise<TranscriptionResponse | null> => {
    setTranscribing(true);
    setError(null);
    try {
      const r = await upload(uri);
      setPendingUri(null);
      return r;
    } catch (e) {
      setPendingUri(uri);
      setError(e instanceof Error ? e.message : 'Transcription impossible.');
      return null;
    } finally {
      setTranscribing(false);
    }
  }, []);

  const stop = useCallback(async (): Promise<TranscriptionResponse | null> => {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setError('Enregistrement vide.');
      return null;
    }
    return send(uri);
  }, [recorder, send]);

  const retry = useCallback(async () => (pendingUri ? send(pendingUri) : null), [pendingUri, send]);

  return {
    canRetry: pendingUri !== null,
    retry,
    recording: state.isRecording,
    durationMs: state.durationMillis,
    transcribing,
    error,
    start,
    stop,
  };
}
