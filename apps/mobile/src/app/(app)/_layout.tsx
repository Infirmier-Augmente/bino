import { Redirect } from 'expo-router';
import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { FileText, type LucideIcon, Users } from 'lucide-react-native';
import { Pressable, Text as RNText, StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/features/session/store';
import { currentPageA11y } from '@/ui/a11y';
import { colors, fonts, type } from '@/ui/theme';

type TabButtonProps = TabTriggerSlotProps & { icon: LucideIcon; label: string };

function TabButton({ icon: Icon, label, isFocused, ref: _ref, ...props }: TabButtonProps) {
  const color = isFocused ? colors.magenta : colors.sec;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      {...currentPageA11y(!!isFocused)}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
    >
      <Icon size={22} color={color} strokeWidth={1.6} />
      <RNText
        style={[type.tab, { color, fontFamily: isFocused ? fonts.bodyBold : fonts.bodyMedium }]}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

function Bar({ children, ...rest }: ViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      {...rest}
      style={[styles.bar, { paddingBottom: insets.bottom }]}
      accessibilityLabel="Navigation principale"
      role="navigation"
    >
      {children}
    </View>
  );
}

/** Onglets en bas, toujours (pas de barre latérale) : Patients et Transmissions. */
export default function AppLayout() {
  const nurse = useSession((s) => s.nurse);
  const unit = useSession((s) => s.unit);
  if (!nurse || !unit) return <Redirect href="/connexion" />;

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.root} />
      <TabList asChild>
        <Bar>
          <TabTrigger name="patients" href="/patients" asChild>
            <TabButton icon={Users} label="Patients" testID="tab-patients" />
          </TabTrigger>
          <TabTrigger name="transmissions" href="/transmissions" asChild>
            <TabButton icon={FileText} label="Transmissions" testID="tab-transmissions" />
          </TabTrigger>
        </Bar>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  item: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
