import { Mic, Square } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useReducedMotion } from '@/ui/a11y';
import { colors } from '@/ui/theme';
import type { DictationStatus } from './useReportDictation';

const SIZE = 72;
/** Place réservée au halo (il ne recouvre jamais le texte voisin). */
const HALO = 112;
const NATIVE_DRIVER = Platform.OS !== 'web';

function micLabel(status: DictationStatus): string {
  if (status === 'recording') return 'Arrêter la dictée';
  if (status === 'idle') return 'Dicter le compte rendu';
  return 'Transcription en cours';
}

/**
 * Micro 72 px. Pendant l'enregistrement (activité réelle), un halo suit le NIVEAU DU MICRO
 * et une onde lente montre qu'il écoute tant que personne ne parle. « Réduire les
 * animations » : halo fixe dont seule l'intensité suit la voix.
 */
export function MicButton({
  status,
  level,
  onPress,
}: {
  status: DictationStatus;
  level: Animated.Value;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const recording = status === 'recording';
  const busy = status === 'finalizing' || status === 'transcribing';
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!recording || reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [recording, reduceMotion, pulse]);

  const voiceRing = reduceMotion
    ? {
        opacity: level.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.42] }),
        transform: [{ scale: 1.4 }],
      }
    : {
        opacity: level.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.28] }),
        transform: [
          {
            scale: level.interpolate({
              inputRange: [0, 1],
              outputRange: [1.04, HALO / SIZE],
              extrapolate: 'clamp',
            }),
          },
        ],
      };
  // L'onde « j'écoute » s'efface dès que la voix est captée.
  const waitRing = {
    opacity: Animated.multiply(
      pulse.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0] }),
      level.interpolate({ inputRange: [0, 0.25], outputRange: [1, 0], extrapolate: 'clamp' }),
    ),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
  };

  return (
    <View style={styles.wrap}>
      {recording ? (
        <>
          {reduceMotion ? null : <Animated.View style={[styles.ring, waitRing]} />}
          <Animated.View style={[styles.ring, voiceRing]} testID="micro-halo" />
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={micLabel(status)}
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={onPress}
        testID="micro"
        style={({ pressed }) => [styles.mic, (recording || pressed) && styles.micActive]}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : recording ? (
          <Square size={28} color={colors.white} strokeWidth={2} />
        ) : (
          <Mic size={28} color={colors.white} strokeWidth={2} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: HALO, height: HALO, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    top: (HALO - SIZE) / 2,
    left: (HALO - SIZE) / 2,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.magenta,
    pointerEvents: 'none',
  },
  mic: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: { backgroundColor: colors.magentaPress },
});
