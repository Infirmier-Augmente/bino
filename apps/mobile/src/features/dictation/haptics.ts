import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Vibration du navigateur quand elle existe (Android ; absente sur iOS Safari). */
function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

/** Retour haptique au début de la dictée (un coup net). */
export function hapticStart(): void {
  if (Platform.OS === 'web') vibrate(20);
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Retour haptique à l'arrêt (plus léger, double sur le web : on sent la différence). */
export function hapticStop(): void {
  if (Platform.OS === 'web') vibrate([12, 60, 12]);
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
