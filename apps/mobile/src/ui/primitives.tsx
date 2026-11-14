import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  Text as RNText,
  type TextProps as RNTextProps,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, type Palette, radius, space, type TypeVariant, type } from './theme';

// ─── Texte ───────────────────────────────────────────────────────────────────

type Tone = 'ink' | 'muted' | 'subtle' | 'accent' | 'question' | 'record' | 'success' | 'onAccent';

const toneColor = (c: Palette, tone: Tone) =>
  ({
    ink: c.ink,
    muted: c.inkMuted,
    subtle: c.inkSubtle,
    accent: c.accent,
    question: c.question,
    record: c.record,
    success: c.success,
    onAccent: c.onAccent,
  })[tone];

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: Tone;
}

export function Text({ variant = 'body', tone = 'ink', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[type[variant], { color: toneColor(colors, tone) }, style]} />;
}

// ─── Boutons ─────────────────────────────────────────────────────────────────

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'record' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  kind?: ButtonKind;
  icon?: LucideIcon;
  loading?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  /** Pleine largeur. */
  block?: boolean;
}

export function Button({
  label,
  kind = 'primary',
  icon: Icon,
  loading,
  size = 'md',
  style,
  block,
  disabled,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const palette: Record<ButtonKind, { bg: string; pressed: string; fg: string; border: string }> = {
    primary: {
      bg: colors.accent,
      pressed: colors.accentPressed,
      fg: colors.onAccent,
      border: colors.accent,
    },
    secondary: {
      bg: colors.surface,
      pressed: colors.surfacePressed,
      fg: colors.ink,
      border: colors.borderStrong,
    },
    ghost: {
      bg: 'transparent',
      pressed: colors.surfacePressed,
      fg: colors.accent,
      border: 'transparent',
    },
    record: {
      bg: colors.record,
      pressed: colors.record,
      fg: colors.onRecord,
      border: colors.record,
    },
    danger: {
      bg: colors.surface,
      pressed: colors.recordSoft,
      fg: colors.danger,
      border: colors.danger,
    },
  };
  const p = palette[kind];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        size === 'lg' && styles.buttonLg,
        block && styles.block,
        {
          backgroundColor: pressed ? p.pressed : p.bg,
          borderColor: p.border,
          opacity: isDisabled ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : Icon ? (
        <Icon size={size === 'lg' ? 22 : 18} color={p.fg} strokeWidth={2.2} />
      ) : null}
      <RNText
        style={[size === 'lg' ? type.heading : type.bodyStrong, { color: p.fg }]}
        numberOfLines={1}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  tone = 'ink',
  active,
  size = 22,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: Tone;
  active?: boolean;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed || active ? colors.surfacePressed : 'transparent' },
      ]}
    >
      <Icon size={size} color={toneColor(colors, tone)} strokeWidth={2} />
    </Pressable>
  );
}

// ─── Mise en page ────────────────────────────────────────────────────────────

export function Stack({
  children,
  gap = space.md,
  direction = 'column',
  align,
  justify,
  wrap,
  style,
}: {
  children: ReactNode;
  gap?: number;
  direction?: 'row' | 'column';
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: direction,
          gap,
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: inset,
      }}
    />
  );
}

/**
 * Section de contenu : un titre, un fond de surface, des séparateurs.
 * Jamais de section dans une section (pas de cartes imbriquées).
 */
export function Section({
  title,
  aside,
  children,
  flush,
  testID,
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionWrap} testID={testID}>
      {title ? (
        <View style={styles.sectionHeader}>
          <Text variant="label" tone="muted" accessibilityRole="header">
            {title}
          </Text>
          {aside}
        </View>
      ) : null}
      <View
        style={[
          styles.section,
          { backgroundColor: colors.surface, borderColor: colors.border },
          flush && { paddingHorizontal: 0, paddingVertical: 0 },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────

export function Badge({
  label,
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  tone?: 'neutral' | 'question' | 'success' | 'accent' | 'record';
  icon?: LucideIcon;
}) {
  const { colors } = useTheme();
  const map = {
    neutral: { bg: colors.surfaceMuted, fg: colors.inkMuted },
    question: { bg: colors.questionSoft, fg: colors.question },
    success: { bg: colors.successSoft, fg: colors.success },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    record: { bg: colors.recordSoft, fg: colors.record },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]}>
      {Icon ? <Icon size={14} color={map.fg} strokeWidth={2.2} /> : null}
      <RNText
        style={[type.caption, { color: map.fg, fontFamily: type.label.fontFamily }]}
        numberOfLines={1}
      >
        {label}
      </RNText>
    </View>
  );
}

// ─── États ───────────────────────────────────────────────────────────────────

export function Banner({
  tone,
  title,
  children,
  action,
}: {
  tone: 'info' | 'question' | 'error' | 'success';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  const map = {
    info: { bg: colors.surfaceMuted, fg: colors.ink },
    question: { bg: colors.questionSoft, fg: colors.question },
    error: { bg: colors.recordSoft, fg: colors.record },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: map.bg }]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
    >
      <RNText style={[type.bodyStrong, { color: map.fg }]}>{title}</RNText>
      {children ? <View style={{ gap: space.xs }}>{children}</View> : null}
      {action}
    </View>
  );
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Text tone="muted">{label}</Text>
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={[styles.center, { paddingVertical: space.xxl }]}>
      <Text variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {description ? (
        <Text tone="muted" style={{ textAlign: 'center', maxWidth: 420 }}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonLg: { minHeight: 60, paddingHorizontal: space.xl, borderRadius: radius.lg },
  block: { alignSelf: 'stretch' },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionWrap: { gap: space.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
  },
  section: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  banner: { borderRadius: radius.md, padding: space.lg, gap: space.sm },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
});
