import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/features/api/client';
import { useNurseReports } from '@/features/api/hooks';
import { patientFullName } from '@/lib/format';
import { Spinner, Text } from '@/ui/primitives';
import { Card, RoomChip } from '@/ui/surfaces';
import { colors, space } from '@/ui/theme';

/** « Mes CR » : mes comptes rendus du poste, du plus récent au plus ancien, texte intégral. */
export function MyReports({ nurseId }: { nurseId: string }) {
  const reports = useNurseReports(nurseId);

  if (reports.isPending) {
    return (
      <View style={styles.state}>
        <Spinner />
      </View>
    );
  }
  if (reports.isError) {
    return (
      <Card>
        <Text tone="sec">{errorMessage(reports.error)}</Text>
      </Card>
    );
  }
  if (reports.data.length === 0) {
    return (
      <Card testID="mes-cr">
        <Text tone="sec">
          Pas encore de compte rendu. Touche un patient dans l’onglet Patients.
        </Text>
      </Card>
    );
  }
  return (
    <Card style={styles.list} testID="mes-cr">
      {reports.data.map((r, i) => (
        <View
          key={r.transmissionId}
          style={[styles.entry, i > 0 && styles.separated]}
          testID={`cr-${r.transmissionId}`}
        >
          <View style={styles.head}>
            <View style={styles.who}>
              <Text variant="bodyStrong">
                {r.patient ? patientFullName(r.patient) : 'Patient à préciser'}
              </Text>
              {r.patient ? <RoomChip room={r.patient.room} small /> : null}
            </View>
            <Text variant="small" tone="sec">
              {r.time}
            </Text>
          </View>
          <Text>{r.transcript}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', paddingVertical: space[8] },
  list: { paddingVertical: 0, paddingHorizontal: 18 },
  entry: { paddingVertical: 14, gap: 6 },
  separated: { borderTopWidth: 1, borderTopColor: colors.line },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  who: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1, gap: 2 },
});
