import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRequiredSession } from '@/features/session/store';
import { useLogout } from '@/features/session/useLogout';
import { MyReports } from '@/features/transmissions/MyReports';
import { TeamSummaries } from '@/features/transmissions/TeamSummaries';
import { headingA11y } from '@/ui/a11y';
import { Segmented } from '@/ui/controls';
import { Text, TextButton } from '@/ui/primitives';
import { space } from '@/ui/theme';

type Scope = 'mine' | 'all';

const SCOPES = [
  { value: 'mine', label: 'Mes CR' },
  { value: 'all', label: 'Tous' },
] as const;

/** TRANSMISSIONS : mes comptes rendus, ou ceux de toute l'équipe par patient. */
export default function TransmissionsScreen() {
  const insets = useSafeAreaInsets();
  const { nurse, unit } = useRequiredSession();
  const logout = useLogout();
  const [scope, setScope] = useState<Scope>('mine');

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: space[4] + insets.top }]}>
      <View style={styles.top}>
        <Text variant="h1" {...headingA11y(1)}>
          Transmissions
        </Text>
        <TextButton label="Déconnexion" size={14} onPress={logout} testID="deconnexion" />
      </View>
      <Segmented
        value={scope}
        options={SCOPES}
        onChange={setScope}
        label="Quels comptes rendus"
        testIDPrefix="portee"
      />
      {scope === 'mine' ? <MyReports nurseId={nurse.id} /> : <TeamSummaries unitId={unit.id} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space[5], paddingBottom: space[6] },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
