import { RecordingPresets, useAudioRecorder } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { currentApiUrl } from '@/features/api/client';
import { levelFromDb } from '@/lib/pcm';
import { DICTATION_UNAVAILABLE, MIC_REFUSED } from './messages';
import { ensureMicPermission, ensureRecordingMode } from './permissions';

export { DICTATION_UNAVAILABLE, MIC_REFUSED } from './messages';

/** Résultat d'une transcription : le texte, ou un message lisible pour l'IDE. */
export type SttOutcome = { ok: true; text: string } | { ok: false; error: string };

/** Le niveau du micro (animation) est relevé toutes les 100 ms, sans re-rendre l'écran. */
const METERING_MS = 100;

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
 * L'état « enregistrement » est affiché DÈS le toucher (avant l'accès au micro).
 */
export function useServerDictation(onLevel: (level: number) => void) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  /** Dernier enregistrement non transcrit : on peut réessayer sans redicter. */
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  /** Démarrage en cours (l'arrêt l'attend) et relevé du niveau. */
  const starting = useRef<Promise<string | null> | null>(null);
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMeter = useCallback(() => {
    if (meter.current) clearInterval(meter.current);
    meter.current = null;
    onLevel(0);
  }, [onLevel]);

  useEffect(() => stopMeter, [stopMeter]);

  /** Démarre l'enregistrement ; renvoie un message d'erreur, ou null si tout va bien. */
  const start = useCallback((): Promise<string | null> => {
    setRecording(true);
    const run = async (): Promise<string | null> => {
      try {
        const [allowed] = await Promise.all([ensureMicPermission(), ensureRecordingMode()]);
        if (!allowed) return MIC_REFUSED;
        await recorder.prepareToRecordAsync();
        recorder.record();
        meter.current = setInterval(() => {
          const db = recorder.getStatus().metering;
          onLevel(db === undefined ? 0 : levelFromDb(db));
        }, METERING_MS);
        return null;
      } catch {
        return DICTATION_UNAVAILABLE;
      }
    };
    const p = run().then((error) => {
      if (error) setRecording(false);
      return error;
    });
    starting.current = p;
    return p;
  }, [recorder, onLevel]);

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
    // Pas d'état intermédiaire « inactif » entre l'arrêt et l'envoi.
    setRecording(false);
    setTranscribing(true);
    stopMeter();
    const startError = await starting.current;
    starting.current = null;
    let uri: string | null = null;
    if (!startError) {
      try {
        await recorder.stop();
        uri = recorder.uri;
      } catch {
        uri = null;
      }
    }
    if (!uri) {
      setTranscribing(false);
      return { ok: false, error: startError ?? 'Enregistrement vide.' };
    }
    return send(uri);
  }, [recorder, send, stopMeter]);

  const retry = useCallback(
    async (): Promise<SttOutcome> =>
      pendingUri ? send(pendingUri) : { ok: false, error: 'Rien à renvoyer.' },
    [pendingUri, send],
  );

  return {
    recording,
    transcribing,
    canRetry: pendingUri !== null,
    start,
    stop,
    retry,
  };
}
