import type { PriorityLevel } from '@infirmier/domain';
import { PRIORITY_LABELS } from '@infirmier/domain';
import { ChevronRight, Star } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import { Text } from './primitives';
import { useTheme } from './ThemeProvider';
import { MIN_TOUCH, radius, space, type } from './theme';

/** Sélecteur segmenté (2 à 4 options courtes). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              selected && { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <RNText
              numberOfLines={1}
              style={[
                type.label,
                {
                  color: selected ? colors.ink : colors.inkMuted,
                  fontFamily: selected ? type.bodyStrong.fontFamily : type.label.fontFamily,
                },
              ]}
            >
              {o.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Badge de triage : couleur + LIBELLÉ (jamais la couleur seule, daltonisme),
 * pastille carrée pour se distinguer des badges d'état.
 */
export function PriorityBadge({
  level,
  origin,
  compact,
}: {
  level: PriorityLevel;
  origin?: 'manuelle' | 'suggeree';
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const t = colors.triage[level];
  return (
    <View
      style={[styles.priority, { backgroundColor: t.bg }]}
      accessibilityLabel={`Priorité ${PRIORITY_LABELS[level]}${origin === 'manuelle' ? ', choisie par l’IDE' : ', suggérée'}`}
    >
      <View style={[styles.swatch, { backgroundColor: t.swatch }]} />
      {!compact ? (
        <RNText style={[type.label, { color: t.fg, fontFamily: type.bodyStrong.fontFamily }]}>
          {PRIORITY_LABELS[level]}
        </RNText>
      ) : null}
    </View>
  );
}

export function StarToggle({
  starred,
  onToggle,
  size = 24,
}: {
  starred: boolean;
  onToggle?: () => void;
  size?: number;
}) {
  const { colors } = useTheme();
  const icon = (
    <Star
      size={size}
      color={starred ? colors.question : colors.inkSubtle}
      fill={starred ? colors.question : 'transparent'}
      strokeWidth={2}
    />
  );
  if (!onToggle) return starred ? icon : null;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: starred }}
      accessibilityLabel={
        starred ? 'Retirer l’étoile' : 'Mettre une étoile (remonter en tête de relève)'
      }
      onPress={onToggle}
      hitSlop={8}
      style={styles.star}
    >
      {icon}
    </Pressable>
  );
}

/** Ligne de liste cliquable (navigation). */
export function ListRow({
  onPress,
  leading,
  children,
  trailing,
  testID,
  accessibilityLabel,
  selected,
  chevron = true,
}: {
  chevron?: boolean;
  onPress?: () => void;
  leading?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected
            ? colors.accentSoft
            : pressed
              ? colors.surfacePressed
              : 'transparent',
        },
      ]}
    >
      {leading}
      <View style={styles.rowBody}>{children}</View>
      {trailing}
      {onPress && chevron ? <ChevronRight size={20} color={colors.inkSubtle} /> : null}
    </Pressable>
  );
}

/** Numéro de box/chambre en gros chiffres (repère principal en relève). */
export function RoomNumber({ prefix, room }: { prefix: string; room: string }) {
  return (
    <View style={styles.room}>
      <Text variant="caption" tone="subtle">
        {prefix}
      </Text>
      <Text variant="monoLarge">{room}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  priority: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  star: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: MIN_TOUCH + 16,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  rowBody: { flex: 1, gap: 2 },
  room: { width: 52, alignItems: 'center' },
});
