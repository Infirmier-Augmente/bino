import { LIVE_AUDIO_FORMAT } from '@infirmier/domain';
import { useAudioStream } from 'expo-audio';
import { useRef } from 'react';
import { createPcmPipeline, toArrayBuffer } from '@/lib/pcm';
import { CaptureError, type PcmCapture, type PcmCaptureHandlers } from './capture.types';
import { ensureMicPermission, ensureRecordingMode } from './permissions';

interface Active {
  handlers: PcmCaptureHandlers;
  pipeline: ReturnType<typeof createPcmPipeline>;
  cancelled: boolean;
}

/**
 * Micro en PCM sur iOS / Android (`useAudioStream` d'expo-audio) : 16 bits mono 24 kHz
 * demandés ; si le matériel livre une autre fréquence, on rééchantillonne. Version web :
 * `usePcmCapture.web.ts` (le flux d'expo-audio n'existe pas sur le web).
 */
export function usePcmCapture(): PcmCapture {
  const active = useRef<Active | null>(null);
  const { stream } = useAudioStream({
    sampleRate: LIVE_AUDIO_FORMAT.sampleRate,
    channels: LIVE_AUDIO_FORMAT.channels,
    encoding: 'int16',
    onBuffer: (buffer) => {
      const a = active.current;
      if (!a || a.cancelled) return;
      const samples = new Int16Array(buffer.data, 0, Math.floor(buffer.data.byteLength / 2));
      const { chunks, level } = a.pipeline.push(samples, buffer.sampleRate, buffer.channels);
      a.handlers.onLevel(level);
      for (const chunk of chunks) a.handlers.onChunk(toArrayBuffer(chunk));
    },
  });

  const start = async (handlers: PcmCaptureHandlers): Promise<void> => {
    const a: Active = {
      handlers,
      pipeline: createPcmPipeline(LIVE_AUDIO_FORMAT.sampleRate),
      cancelled: false,
    };
    active.current = a;
    const release = () => {
      if (active.current === a) active.current = null;
    };
    let allowed: boolean;
    try {
      // En parallèle : vérifier l'autorisation et régler le mode audio.
      [allowed] = await Promise.all([ensureMicPermission(), ensureRecordingMode()]);
    } catch {
      release();
      throw new CaptureError('unavailable');
    }
    if (!allowed) {
      release();
      throw new CaptureError('refused');
    }
    if (a.cancelled) return;
    try {
      await stream.start();
    } catch {
      release();
      throw new CaptureError('unavailable');
    }
    // Arrêt demandé pendant le démarrage.
    if (a.cancelled) stopStream();
  };

  const stopStream = () => {
    try {
      stream.stop();
    } catch {
      // Flux déjà arrêté ou libéré (écran fermé) : rien à faire.
    }
  };

  const stop = () => {
    const a = active.current;
    if (!a) return;
    a.cancelled = true;
    active.current = null;
    stopStream();
    const rest = a.pipeline.flush();
    if (rest) a.handlers.onChunk(toArrayBuffer(rest));
  };

  return { start, stop };
}
