import { Check, X } from 'lucide-react-native';
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { headingA11y, useEscapeKey } from './a11y';
import { IconButton, Text } from './primitives';
import { colors, radius, space } from './theme';

/**
 * Feuille du bas (« Constantes ») : fond assombri, coins hauts arrondis, 92 % de la hauteur
 * au plus. Rendue AU-DESSUS de l'écran courant (pas de fenêtre native), pour que les toasts
 * restent visibles par-dessus.
 */
export function BottomSheet({
  label,
  onClose,
  children,
  footer,
  testID,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Action principale, toujours visible sous le contenu qui défile. */
  footer?: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  useEscapeKey(onClose);
  return (
    <View style={styles.layer} accessibilityViewIsModal>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityLabel="Fermer"
        accessibilityRole="button"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetMax}
      >
        <View
          style={[styles.sheet, { paddingBottom: (footer ? space[4] : 32) + insets.bottom }]}
          role="dialog"
          aria-modal
          accessibilityLabel={label}
          testID={testID}
        >
          <View style={styles.closeRow}>
            <IconButton icon={X} label="Fermer" onPress={onClose} />
          </View>
          <ScrollView
            style={styles.sheetScroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: space[3], paddingBottom: space[3] }}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFoot}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Popup « Compte rendu fait » ─────────────────────────────────────────────

interface DoneApi {
  show(title: string): void;
}

const DoneContext = createContext<DoneApi>({ show: () => {} });

/** Durée d'affichage de la popup de confirmation. */
export const DONE_MS = 1_800;

export function DoneProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setTitle(null);
  }, []);

  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setTitle(text);
    timer.current = setTimeout(() => setTitle(null), DONE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEscapeKey(close, title !== null);

  return (
    <DoneContext value={{ show }}>
      {children}
      {title ? (
        <View style={[styles.layer, styles.center, { zIndex: 70 }]}>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={close}
            accessibilityLabel="Fermer"
            accessibilityRole="button"
          />
          <View style={styles.popup} role="dialog" aria-modal testID="cr-fait">
            <View style={styles.popupClose}>
              <IconButton icon={X} label="Fermer" onPress={close} size={22} />
            </View>
            <View style={styles.check}>
              <Check size={56} color={colors.success} strokeWidth={2} />
            </View>
            <Text variant="popupTitle" style={styles.popupTitle} {...headingA11y(2)}>
              {title}
            </Text>
          </View>
        </View>
      ) : null}
    </DoneContext>
  );
}

export function useDonePopup(): DoneApi {
  return use(DoneContext);
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  center: { justifyContent: 'center', alignItems: 'center', padding: space[4] },
  backdrop: { backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space[3],
    paddingHorizontal: space[5],
    flexShrink: 1,
  },
  // La hauteur maximale se rapporte à l'écran (le calque), pas au contenu.
  sheetMax: { maxHeight: '92%' },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetFoot: { paddingTop: space[3] },
  closeRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  popup: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    paddingTop: 36,
    paddingHorizontal: space[6],
    paddingBottom: 28,
    alignItems: 'center',
    gap: space[4],
    boxShadow: '0 10px 30px rgba(0,34,68,0.2)',
  },
  popupClose: { position: 'absolute', top: space[2], right: space[2] },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupTitle: { textAlign: 'center' },
});
