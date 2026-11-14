import type { PatientSummary } from '@infirmier/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { patientFullName, patientSubline } from '@/lib/format';
import { Text } from '@/ui/primitives';
import { Card, RoomChip } from '@/ui/surfaces';
import { colors } from '@/ui/theme';

/**
 * Ligne patient du tableau de bord : nom, âge · motif, pastille chambre. Aucune priorité ni
 * NEWS2 ici (ils vivent dans Transmissions › Tous). Toucher ouvre « Nouveau compte rendu ».
 */
export function PatientRow({ patient, onPress }: { patient: PatientSummary; onPress: () => void }) {
  return (
    <Card bar={colors.sky} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        testID={`patient-${patient.room}`}
        style={({ pressed }) => [styles.open, pressed && { backgroundColor: colors.pressed }]}
      >
        <View style={styles.main}>
          <Text variant="patientName">{patientFullName(patient)}</Text>
          <Text variant="small" tone="sec" numberOfLines={2}>
            {patientSubline(patient)}
          </Text>
        </View>
        <RoomChip room={patient.room} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0 },
  open: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14,
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
});
