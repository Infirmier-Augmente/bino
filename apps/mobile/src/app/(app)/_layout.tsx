import { Redirect } from 'expo-router';
import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import {
  ClipboardList,
  FlaskConical,
  Inbox,
  type LucideIcon,
  Menu,
  Search,
  Settings,
  Users,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text as RNText, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSessionInfo } from '@/features/api/hooks';
import { useSession } from '@/features/session/store';
import { useIsWide } from '@/ui/layout';
import { Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { radius, space, type } from '@/ui/theme';

interface TabDef {
  name: string;
  href: '/patients' | '/releve' | '/recherche' | '/simulateur' | '/dpi' | '/reglages' | '/plus';
  label: string;
  icon: LucideIcon;
  /** Visible sur téléphone / sur grand écran. */
  phone: boolean;
  wide: boolean;
}

const TABS: readonly TabDef[] = [
  { name: 'patients', href: '/patients', label: 'Patients', icon: Users, phone: true, wide: true },
  {
    name: 'releve',
    href: '/releve',
    label: 'Relève',
    icon: ClipboardList,
    phone: true,
    wide: true,
  },
  {
    name: 'recherche',
    href: '/recherche',
    label: 'Recherche',
    icon: Search,
    phone: true,
    wide: true,
  },
  {
    name: 'simulateur',
    href: '/simulateur',
    label: 'Simulateur',
    icon: FlaskConical,
    phone: false,
    wide: true,
  },
  { name: 'dpi', href: '/dpi', label: 'DPI simulé', icon: Inbox, phone: false, wide: true },
  {
    name: 'reglages',
    href: '/reglages',
    label: 'Réglages',
    icon: Settings,
    phone: false,
    wide: true,
  },
  { name: 'plus', href: '/plus', label: 'Plus', icon: Menu, phone: true, wide: false },
];

type TabButtonProps = TabTriggerSlotProps & {
  icon: LucideIcon;
  label: string;
  wide: boolean;
  hidden: boolean;
};

function TabButton({
  icon: Icon,
  label,
  wide,
  hidden,
  isFocused,
  ref: _ref,
  ...props
}: TabButtonProps) {
  const { colors } = useTheme();
  const color = isFocused ? colors.accent : colors.inkMuted;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        wide ? styles.sideItem : styles.bottomItem,
        wide && isFocused && { backgroundColor: colors.accentSoft },
        pressed && { opacity: 0.7 },
        hidden && styles.hidden,
      ]}
    >
      <Icon size={wide ? 20 : 22} color={color} strokeWidth={isFocused ? 2.4 : 2} />
      <RNText
        style={[
          wide ? type.bodyStrong : type.caption,
          { color, fontFamily: isFocused ? type.bodyStrong.fontFamily : type.label.fontFamily },
        ]}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

function Bar({
  wide,
  hidden,
  children,
}: ViewProps & { wide: boolean; hidden: boolean; children?: ReactNode }) {
  const { colors } = useTheme();
  const unitId = useSession((s) => s.unitId);
  const { data } = useSessionInfo();
  const unit = data?.units.find((u) => u.id === unitId);
  if (wide) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'bottom']}
        style={[
          styles.sidebar,
          { backgroundColor: colors.surface, borderColor: colors.border },
          hidden && styles.hidden,
        ]}
      >
        <View style={styles.brand}>
          <Text variant="heading">Infirmier augmenté</Text>
          <Text variant="caption" tone="subtle">
            {unit?.name ?? ''}
          </Text>
        </View>
        <View style={{ gap: space.xs }}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.bottom, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.bottomInner}>{children}</View>
    </SafeAreaView>
  );
}

/**
 * Coquille responsive : barre latérale sur PC/tablette (vue relève au poste de soins),
 * onglets en bas sur téléphone (dictée en mobilité). Une seule app, deux usages.
 */
export default function AppLayout() {
  const wide = useIsWide();
  const nurseId = useSession((s) => s.nurseId);
  const meeting = useSession((s) => s.meetingMode);
  if (!nurseId) return <Redirect href="/bienvenue" />;

  const list = (
    <TabList asChild>
      <Bar wide={wide} hidden={meeting && wide}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <TabButton
              icon={t.icon}
              label={t.label}
              wide={wide}
              hidden={wide ? !t.wide : !t.phone}
            />
          </TabTrigger>
        ))}
      </Bar>
    </TabList>
  );

  return (
    <Tabs style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      {wide ? list : null}
      <TabSlot style={{ flex: 1 }} />
      {wide ? null : list}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  hidden: { display: 'none' },
  sidebar: {
    width: 232,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    gap: space.xl,
  },
  brand: { paddingHorizontal: space.sm, paddingTop: space.lg, gap: 2 },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    minHeight: 44,
    borderRadius: radius.md,
  },
  bottom: { borderTopWidth: StyleSheet.hairlineWidth, alignSelf: 'stretch', width: '100%' },
  bottomInner: { flexDirection: 'row', width: '100%' },
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 56,
    paddingTop: space.xs,
  },
});
