import { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useConfig } from '@/features/api/hooks';
import { hapticStart, hapticStop } from '@/features/dictation/haptics';
import { DICTATION_UNAVAILABLE, MIC_REFUSED } from '@/features/dictation/messages';
import { useLiveDictation } from '@/features/dictation/useLiveDictation';
import { type SttOutcome, useServerDictation } from '@/features/dictation/useServerDictation';
import { useWebSpeech, webSpeechSupported } from '@/features/dictation/useWebSpeech';
import { chooseDictationEngine } from '@/lib/dictation-engine';
import type { LiveSegments } from '@/lib/live-segments';
import { appendDictation } from '@/lib/report';
import { useToast } from '@/ui/toast';
import { useDrafts } from './drafts';

/** Où en est la dictée : la fiche s'affiche en conséquence (micro, texte, statut). */
export type DictationStatus = 'idle' | 'recording' | 'finalizing' | 'transcribing';

const NATIVE_DRIVER = Platform.OS !== 'web';
const LEVEL_EVERY_MS = 80;
const NO_SEGMENTS: LiveSegments = [];

/**
 * Micro de la fiche « Nouveau compte rendu ». Moteur choisi par `chooseDictationEngine` :
 * dictée en direct, sinon transcription serveur à la fin, sinon navigateur, sinon clavier.
 * L'état « enregistrement » s'affiche DÈS le toucher. Le texte reconnu est toujours AJOUTÉ À
 * LA FIN du brouillon du patient (jamais à la place).
 */
export function useReportDictation(patientId: string, focusInput: () => void) {
  const toast = useToast();
  const config = useConfig();
  /** Niveau du micro (0 à 1) : anime le halo sans re-rendre l'écran. */
  const [level] = useState(() => new Animated.Value(0));
  const lastLevelAt = useRef(0);
  const setLevel = useCallback(
    (value: number) => {
      // Le micro rend un niveau toutes les ~20 ms : une animation toutes les 80 ms suffit.
      const now = Date.now();
      if (value > 0 && now - lastLevelAt.current < LEVEL_EVERY_MS) return;
      lastLevelAt.current = now;
      Animated.timing(level, {
        toValue: value,
        duration: LEVEL_EVERY_MS,
        easing: Easing.linear,
        useNativeDriver: NATIVE_DRIVER,
      }).start();
    },
    [level],
  );
  const web = useWebSpeech();
  const server = useServerDictation(setLevel);
  const live = useLiveDictation(setLevel);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const update = useDrafts((s) => s.update);
  const serverSttReady = config.data?.stt.ready === true;
  const engine = chooseDictationEngine({
    liveSttReady: config.data?.sttLive.ready === true,
    serverSttReady,
    webSpeechAvailable: webSpeechSupported(),
  });

  const append = useCallback(
    (text: string, event: 'voice-device' | 'voice-server') => {
      const current = useDrafts.getState().drafts[patientId]?.text ?? '';
      update(patientId, appendDictation(current, text), event);
    },
    [patientId, update],
  );

  const report = (outcome: SttOutcome) => {
    if (outcome.ok) {
      if (outcome.text.trim()) append(outcome.text, 'voice-server');
    } else toast.show(outcome.error);
  };

  const recording = live.phase === 'recording' || server.recording || web.listening;
  const status: DictationStatus = recording
    ? 'recording'
    : live.phase === 'finalizing'
      ? 'finalizing'
      : server.transcribing
        ? 'transcribing'
        : 'idle';

  // Dictée du navigateur : sa transcription partielle = un seul segment provisoire.
  const segments: LiveSegments =
    live.phase !== 'idle'
      ? live.segments
      : web.interim
        ? [{ index: 0, provisional: web.interim, final: null }]
        : NO_SEGMENTS;

  const startServer = async () => {
    const error = await server.start();
    if (error) toast.show(error);
  };

  /** Arrête la dictée ; attend le texte (définitif ou transcrit) avant de rendre la main. */
  const finish = async () => {
    if (web.listening) web.stop();
    await live.stop();
    if (server.recording) report(await server.stop());
  };

  const toggle = async () => {
    if (status === 'finalizing' || status === 'transcribing') return;
    if (recording) {
      hapticStop();
      return finish();
    }
    if (engine === 'keyboard') {
      focusInput();
      toast.show(DICTATION_UNAVAILABLE);
      return;
    }
    hapticStart();
    setStartedAt(Date.now());
    if (engine === 'live') {
      live.start({
        onText: (text) => append(text, 'voice-server'),
        onError: toast.show,
        // La dictée en direct n'a pas démarré (API ancienne, serveur injoignable…).
        onFallback: () => {
          if (serverSttReady) void startServer();
          else toast.show(DICTATION_UNAVAILABLE);
        },
      });
    } else if (engine === 'server') {
      await startServer();
    } else {
      web.start({
        onFinal: (text) => append(text, 'voice-device'),
        onError: (kind) => toast.show(kind === 'not-allowed' ? MIC_REFUSED : DICTATION_UNAVAILABLE),
      });
    }
  };

  return {
    status,
    /** Le micro capte (affiché dès le toucher). */
    recording,
    /** Arrêté, le texte est en route : micro et « Valider » en attente. */
    busy: status === 'finalizing' || status === 'transcribing',
    /** Texte en cours de dictée, par segment (direct, ou navigateur), affiché après le brouillon. */
    segments,
    /** Le texte s'affiche pendant la dictée (sinon : à l'arrêt). */
    textWhileSpeaking: live.phase !== 'idle' || web.listening,
    startedAt,
    level,
    canRetry: server.canRetry && status === 'idle',
    toggle,
    finish,
    retry: async () => report(await server.retry()),
  };
}

export type ReportDictation = ReturnType<typeof useReportDictation>;
