import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton, Text } from './primitives';
import { useTheme } from './ThemeProvider';
import { CONTENT_MAX_WIDTH, MIN_TOUCH, radius, space, type, WIDE_BREAKPOINT } from './theme';

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

/**
 * Écran standard : zone sûre, en-tête simple, contenu centré à largeur lisible,
 * pied fixe optionnel (barre d'actions).
 */
export function Screen({
  title,
  subtitle,
  back,
  headerRight,
  children,
  footer,
  scroll = true,
  maxWidth = CONTENT_MAX_WIDTH,
  refreshControl,
  testID,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const content = <View style={[styles.content, { maxWidth }]}>{children}</View>;
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.bg }]}
      edges={['top', 'left', 'right']}
      testID={testID}
    >
      {title || back || headerRight ? (
        <View style={[styles.header, { maxWidth }]}>
          {back ? (
            <IconButton
              icon={ArrowLeft}
              label="Retour"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
          ) : null}
          <View style={styles.headerText}>
            {title ? (
              <Text variant="title" accessibilityRole="header" numberOfLines={2}>
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text variant="label" tone="muted" numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {headerRight}
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.flex}>{content}</View>
      )}
      {footer ? (
        <SafeAreaView
          edges={['bottom']}
          style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.footerInner, { maxWidth }]}>{footer}</View>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

export function TextField({
  label,
  hint,
  error,
  style,
  ...rest
}: TextInputProps & { label?: string; hint?: string; error?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.inkSubtle}
        accessibilityLabel={label}
        {...rest}
        style={[
          type.body,
          styles.input,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.record : colors.borderStrong,
          },
          rest.multiline && { minHeight: 120, textAlignVertical: 'top', paddingTop: space.md },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" tone="record">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  headerText: { flex: 1, gap: 2 },
  scroll: { paddingBottom: space.xxxl },
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.xl,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerInner: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
});
