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
  const res = await fetch(`${currentApiUrl()}/transcriptions`, { method: 'POST', body: form });
  const json = (await res.json()) as TranscriptionResponse | { error: { message: string } };
  if (!res.ok || 'error' in json) {
    throw new Error(
      'error' in json ? json.error.message : `Transcription impossible (${res.status}).`,
    );
  }
  return json;
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

  const stop = useCallback(async (): Promise<TranscriptionResponse | null> => {
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setError('Enregistrement vide.');
      return null;
    }
    setTranscribing(true);
    try {
      return await upload(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription impossible.');
      return null;
    } finally {
      setTranscribing(false);
    }
  }, [recorder]);

  return {
    recording: state.isRecording,
    durationMs: state.durationMillis,
    transcribing,
    error,
    start,
    stop,
  };
}
