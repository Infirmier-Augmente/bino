import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './primitives';
import { useTheme } from './ThemeProvider';
import { radius, space } from './theme';

interface ToastApi {
  show(message: string, tone?: 'neutral' | 'success' | 'error'): void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

/** Confirmation brève (« Validée · Box 12 »), sans rebond ni effet. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{
    message: string;
    tone: 'neutral' | 'success' | 'error';
  } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, tone: 'neutral' | 'success' | 'error' = 'neutral') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
          setToast(null),
        );
      }, 2600);
    },
    [opacity],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const bg =
    toast?.tone === 'error'
      ? colors.record
      : toast?.tone === 'success'
        ? colors.success
        : colors.ink;
  return (
    <ToastContext value={{ show }}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
          <Animated.View
            style={[styles.toast, { backgroundColor: bg, opacity }]}
            accessibilityLiveRegion="polite"
          >
            <Text variant="bodyStrong" style={{ color: colors.bg }}>
              {toast.message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
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
    paddingHorizontal: space.lg,
  },
  toast: {
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    maxWidth: 520,
  },
});
