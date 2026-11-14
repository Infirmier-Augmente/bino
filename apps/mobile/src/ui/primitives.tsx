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
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, MIN_TOUCH, radius, space, type TypeVariant, type } from './theme';

// ─── Texte ───────────────────────────────────────────────────────────────────

type Tone = 'navy' | 'sec' | 'magenta' | 'white' | 'error' | 'warn' | 'success';

const TONES: Record<Tone, string> = {
  navy: colors.navy,
  sec: colors.sec,
  magenta: colors.magenta,
  white: colors.white,
  error: colors.error,
  warn: colors.warn,
  success: colors.success,
};

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: Tone;
}

export function Text({ variant = 'body', tone = 'navy', style, ...rest }: TextProps) {
  return <RNText {...rest} style={[type[variant], { color: TONES[tone] }, style]} />;
}

// ─── Boutons ─────────────────────────────────────────────────────────────────

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  kind?: 'primary' | 'secondary';
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  /** Élément après le libellé (chevron du menu de tri). */
  trailing?: ReactNode;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Bouton primaire magenta (52 px) ou secondaire blanc bordé ; « sm » = 44 px. */
export function Button({
  label,
  kind = 'primary',
  size = 'md',
  icon: Icon,
  trailing,
  loading,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const primary = kind === 'primary';
  const off = disabled || loading;
  const fg = primary ? colors.white : colors.navy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' ? styles.buttonSm : styles.buttonMd,
        primary
          ? {
              backgroundColor: off
                ? colors.disabled
                : pressed
                  ? colors.magentaPress
                  : colors.magenta,
            }
          : {
              backgroundColor: pressed ? colors.pressed : colors.white,
              borderWidth: 1,
              borderColor: colors.fieldBorder,
            },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : null}
      {!loading && Icon ? <Icon size={16} color={fg} strokeWidth={2} /> : null}
      <RNText
        style={[size === 'sm' ? type.buttonSm : type.button, { color: fg }]}
        numberOfLines={1}
      >
        {label}
      </RNText>
      {trailing}
    </Pressable>
  );
}

/** Bouton texte magenta sans fond (« Déconnexion »). */
export function TextButton({
  label,
  onPress,
  size = 13,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  size?: 13 | 14;
  testID?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      testID={testID}
      style={({ pressed }) => [styles.textButton, pressed && { opacity: 0.6 }]}
    >
      <RNText style={[type.chip, { fontSize: size, color: colors.magenta }, style]}>{label}</RNText>
    </Pressable>
  );
}

/** Bouton icône 44 × 44 gris (« Fermer »). */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  size = 24,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  size?: number;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && { backgroundColor: colors.iconPressed },
      ]}
    >
      <Icon size={size} color={colors.sec} strokeWidth={2} />
    </Pressable>
  );
}

/** Petite roue de chargement (dans un texte ou un bouton). */
export function Spinner({ light }: { light?: boolean }) {
  return <ActivityIndicator size="small" color={light ? colors.white : colors.navy} />;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
  },
  buttonMd: { minHeight: 52, borderRadius: radius.lg, alignSelf: 'stretch' },
  buttonSm: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    gap: space[1],
  },
  textButton: { paddingVertical: space[2], paddingLeft: space[1] },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
