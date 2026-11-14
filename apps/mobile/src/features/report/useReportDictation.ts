import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useConfig } from '@/features/api/hooks';
import {
  DICTATION_UNAVAILABLE,
  MIC_REFUSED,
  type SttOutcome,
  useServerDictation,
} from '@/features/dictation/useServerDictation';
import { useWebSpeech, webSpeechSupported } from '@/features/dictation/useWebSpeech';
import { chooseDictationEngine } from '@/lib/dictation-engine';
import { appendDictation } from '@/lib/report';
import { useToast } from '@/ui/toast';
import { useDrafts } from './drafts';

const haptic = () => {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

/**
 * Micro de la fiche « Nouveau compte rendu ». Moteur choisi par `chooseDictationEngine` :
 * transcription serveur en priorité, sinon navigateur, sinon clavier. Le texte reconnu est
 * toujours AJOUTÉ À LA FIN du brouillon du patient (jamais à la place).
 */
export function useReportDictation(patientId: string, focusInput: () => void) {
  const toast = useToast();
  const config = useConfig();
  const web = useWebSpeech();
  const server = useServerDictation();
  const update = useDrafts((s) => s.update);
  const engine = chooseDictationEngine({
    serverSttReady: config.data?.stt.ready === true,
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

  /** Arrête la dictée ; avec la transcription serveur, attend le texte avant de rendre la main. */
  const finish = async () => {
    if (web.listening) web.stop();
    if (server.recording) report(await server.stop());
  };

  const toggle = async () => {
    haptic();
    if (web.listening || server.recording) return finish();
    if (engine === 'web-speech') {
      web.start({
        onFinal: (text) => append(text, 'voice-device'),
        onError: (kind) => toast.show(kind === 'not-allowed' ? MIC_REFUSED : DICTATION_UNAVAILABLE),
      });
    } else if (engine === 'server') {
      const error = await server.start();
      if (error) toast.show(error);
    } else {
      focusInput();
      toast.show(DICTATION_UNAVAILABLE);
    }
  };

  return {
    listening: web.listening || server.recording,
    transcribing: server.transcribing,
    interim: web.interim,
    canRetry: server.canRetry && !server.recording,
    toggle,
    finish,
    retry: async () => report(await server.retry()),
  };
}
