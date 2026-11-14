import { LIVE_AUDIO_FORMAT } from '@infirmier/domain';
import { useEffect, useState } from 'react';
import { createPcmPipeline, toArrayBuffer } from '@/lib/pcm';
import { CaptureError, type PcmCapture, type PcmCaptureHandlers } from './capture.types';

/**
 * Micro en PCM dans le navigateur : `getUserMedia` + Web Audio. Un AudioWorklet copie le son
 * (repli : ScriptProcessor, ex. page non sécurisée), puis il est rééchantillonné en 24 kHz
 * et converti en 16 bits (`lib/pcm.ts`). Version native : `usePcmCapture.ts`.
 */

/** Processeur audio : envoie des blocs de 1 024 échantillons (~21 ms à 48 kHz). */
const WORKLET_SOURCE = `
class PcmTap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) {
          this.port.postMessage(this.buf, [this.buf.buffer]);
          this.buf = new Float32Array(1024);
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-tap', PcmTap);
`;

let workletUrl: string | null = null;
function getWorkletUrl(): string {
  workletUrl ??= URL.createObjectURL(
    new Blob([WORKLET_SOURCE], { type: 'application/javascript' }),
  );
  return workletUrl;
}

interface Session {
  ctx: AudioContext | null;
  media: MediaStream | null;
  nodes: AudioNode[];
  handlers: PcmCaptureHandlers;
  pipeline: ReturnType<typeof createPcmPipeline>;
  cancelled: boolean;
}

function teardown(s: Session): void {
  s.cancelled = true;
  for (const node of s.nodes) {
    try {
      node.disconnect();
    } catch {
      // Déjà déconnecté.
    }
    if (node instanceof AudioWorkletNode) node.port.onmessage = null;
    if (node instanceof ScriptProcessorNode) node.onaudioprocess = null;
  }
  s.nodes = [];
  if (s.media) stopTracks(s.media);
  if (s.ctx && s.ctx.state !== 'closed') void s.ctx.close().catch(() => {});
}

function stopTracks(media: MediaStream): void {
  for (const track of media.getTracks()) track.stop();
}

/** Après le prochain affichage (le changement d'état est peint avant le travail lourd). */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else setTimeout(resolve, 0);
  });
}

function refusal(e: unknown): CaptureError {
  const name = e instanceof Error || e instanceof DOMException ? e.name : '';
  return new CaptureError(
    name === 'NotAllowedError' || name === 'SecurityError' ? 'refused' : 'unavailable',
  );
}

function createWebCapture(): PcmCapture {
  let active: Session | null = null;

  const wire = (s: Session, ctx: AudioContext, media: MediaStream, useWorklet: boolean) => {
    const onSamples = (samples: Float32Array) => {
      if (s.cancelled) return;
      const { chunks, level } = s.pipeline.push(samples, ctx.sampleRate);
      s.handlers.onLevel(level);
      for (const chunk of chunks) s.handlers.onChunk(toArrayBuffer(chunk));
    };
    const source = ctx.createMediaStreamSource(media);
    if (useWorklet) {
      const node = new AudioWorkletNode(ctx, 'pcm-tap');
      node.port.onmessage = (e: MessageEvent<Float32Array>) => onSamples(e.data);
      source.connect(node);
      // Sortie muette (le processeur n'écrit rien) : nécessaire pour que le graphe tourne.
      node.connect(ctx.destination);
      s.nodes = [source, node];
    } else {
      const node = ctx.createScriptProcessor(2048, 1, 1);
      node.onaudioprocess = (e) => onSamples(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node);
      node.connect(ctx.destination);
      s.nodes = [source, node];
    }
  };

  return {
    async start(handlers) {
      const devices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
      if (!devices?.getUserMedia || typeof AudioContext === 'undefined') {
        throw new CaptureError('unavailable');
      }
      const s: Session = {
        ctx: null,
        media: null,
        nodes: [],
        handlers,
        pipeline: createPcmPipeline(LIVE_AUDIO_FORMAT.sampleRate),
        cancelled: false,
      };
      active = s;
      // Le micro s'ouvre tout de suite (côté navigateur, en parallèle de la suite).
      const pendingMedia = devices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      // Créer le premier AudioContext bloque la page (~200 ms) : d'abord afficher l'état
      // « enregistrement », ensuite seulement préparer le traitement du son.
      await afterPaint();
      if (s.cancelled) {
        void pendingMedia.then(stopTracks, () => {});
        return;
      }
      const ctx = new AudioContext();
      s.ctx = ctx;
      void ctx.resume().catch(() => {});
      const worklet =
        typeof AudioWorkletNode !== 'undefined' && ctx.audioWorklet
          ? ctx.audioWorklet.addModule(getWorkletUrl()).then(
              () => true,
              () => false,
            )
          : Promise.resolve(false);
      let media: MediaStream;
      try {
        media = await pendingMedia;
      } catch (e) {
        teardown(s);
        if (active === s) active = null;
        throw refusal(e);
      }
      s.media = media;
      // Page en train de capter : le navigateur autorise le son même hors du toucher.
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      const useWorklet = await worklet;
      if (s.cancelled) {
        teardown(s);
        return;
      }
      try {
        wire(s, ctx, media, useWorklet);
      } catch {
        teardown(s);
        if (active === s) active = null;
        throw new CaptureError('unavailable');
      }
    },
    stop() {
      const s = active;
      if (!s) return;
      active = null;
      teardown(s);
      const rest = s.pipeline.flush();
      if (rest) s.handlers.onChunk(toArrayBuffer(rest));
    },
  };
}

export function usePcmCapture(): PcmCapture {
  const [capture] = useState(createWebCapture);
  useEffect(() => () => capture.stop(), [capture]);
  return capture;
}
