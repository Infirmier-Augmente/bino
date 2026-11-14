import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './primitives';
import { colors, radius, space } from './theme';

interface ToastApi {
  show(message: string): void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

/** Durée d'affichage d'un toast (un nouveau remplace le précédent). */
export const TOAST_MS = 4_000;

/** Message bref en bas de l'écran, fond navy (« Priorité 2 enregistrée. »). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext value={{ show }}>
      {children}
      <View
        pointerEvents="none"
        style={[styles.wrap, { bottom: insets.bottom + 86 }]}
        role="status"
        accessibilityLiveRegion="polite"
      >
        {message ? (
          <View style={styles.toast} testID="toast">
            <Text variant="toast" tone="white">
              {message}
            </Text>
          </View>
        ) : null}
      </View>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  return use(ToastContext);
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: space[4],
    zIndex: 60,
  },
  toast: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
  },
});
