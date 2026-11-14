import type { LucideIcon } from 'lucide-react-native';
import { ChevronDown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  Image,
  Pressable,
  Text as RNText,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { roomChipLabel } from '@/lib/format';
import pouce from '../../assets/bino/pouce-bust.png';
import presente from '../../assets/bino/presente-bust.png';
import salue from '../../assets/bino/salue-bust.png';
import { colors, radius, space, type } from './theme';

/**
 * Carte blanche, rayon 20, filet 1 px. `bar` = barre gauche de 4 px dans la carte
 * (bleu ciel sur les lignes patient, couleur de priorité sur Tous).
 */
export function Card({
  children,
  bar,
  style,
  testID,
}: {
  children: ReactNode;
  bar?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {bar ? <View style={[styles.bar, { backgroundColor: bar }]} /> : null}
      {children}
    </View>
  );
}

/** Pastille « CHAMB 12 ». */
export function RoomChip({ room, small }: { room: string; small?: boolean }) {
  return (
    <View style={[styles.room, small && styles.roomSm]}>
      <RNText style={[type.chip, { color: colors.navy }, small && styles.roomTextSm]}>
        {roomChipLabel(room)}
      </RNText>
    </View>
  );
}

/** Compteur magenta à côté d'un titre. */
export function CountBadge({ value }: { value: number }) {
  return (
    <View style={styles.count} accessibilityLabel={`${value} patients`}>
      <RNText style={[type.tiny, { color: colors.white, fontSize: 12 }]}>{value}</RNText>
    </View>
  );
}

/** Puce grise (exemple de dictée). */
export function Chip({
  label,
  icon: Icon,
  onPress,
  testID,
}: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.chip, pressed && { backgroundColor: colors.iconPressed }]}
    >
      {Icon ? <Icon size={14} color={colors.navy} strokeWidth={2} /> : null}
      <RNText style={[type.label, { color: colors.navy }]}>{label}</RNText>
    </Pressable>
  );
}

/** Pilule bascule bordée navy ; active = magenta (« Dossier médical »). */
export function TogglePill({
  label,
  icon: Icon,
  on,
  onPress,
  testID,
}: {
  label: string;
  icon: LucideIcon;
  on: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const fg = on ? colors.white : colors.navy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: on }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: on ? colors.magenta : pressed ? colors.pressed : colors.white },
      ]}
    >
      <Icon size={18} color={fg} strokeWidth={2} />
      <RNText style={[type.buttonSm, { color: fg }]}>{label}</RNText>
      <ChevronDown size={16} color={fg} strokeWidth={2} style={on ? styles.flipped : undefined} />
    </Pressable>
  );
}

const MASCOTS = { presente, pouce, salue } as const;

/** Bino, la mascotte (image décorative : `alt` vide). */
export function Mascot({
  pose,
  width,
  height,
}: {
  pose: keyof typeof MASCOTS;
  width: number;
  height: number;
}) {
  return (
    <Image
      source={MASCOTS[pose]}
      style={{ width, height }}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no"
      alt=""
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space[4],
    marginBottom: space[3],
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  room: {
    borderWidth: 1.5,
    borderColor: colors.sky,
    backgroundColor: colors.skyLight,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  roomSm: { borderWidth: 1, paddingVertical: 1, paddingHorizontal: 7, marginLeft: space[1] },
  roomTextSm: { fontSize: 11, lineHeight: 15 },
  count: {
    minWidth: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.magenta,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    backgroundColor: colors.chip,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[2],
    height: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  flipped: { transform: [{ rotate: '180deg' }] },
});
