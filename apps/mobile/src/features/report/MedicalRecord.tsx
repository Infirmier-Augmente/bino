import type { PatientDetail } from '@infirmier/domain';
import { Pencil } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { dossierLines } from '@/lib/dossier';
import { clock } from '@/lib/format';
import { formatPoints, pointsTone, totalTone, vitalsRows } from '@/lib/vitals';
import { Button, Text } from '@/ui/primitives';
import { Card } from '@/ui/surfaces';
import { colors, NEWS2_COLORS, space } from '@/ui/theme';

/**
 * « Dossier médical » de la fiche : constantes avec les points NEWS2 de CHAQUE paramètre
 * (aide au calcul, entrées toujours visibles), puis motif, antécédents, allergies…
 */
export function MedicalRecord({
  detail,
  timeZone,
  onEditVitals,
}: {
  detail: PatientDetail;
  timeZone: string;
  onEditVitals: () => void;
}) {
  const vitals = detail.patient.vitals;
  const score = detail.news2;
  return (
    <Card style={styles.card} testID="dossier-medical">
      {vitals && score ? (
        <View>
          {vitalsRows(vitals, score.points).map((r) => (
            <View
              key={r.key}
              style={styles.row}
              accessible
              accessibilityLabel={`${r.label} : ${r.value}, ${r.points} point${r.points > 1 ? 's' : ''} NEWS2`}
            >
              <Text variant="table" style={styles.label}>
                {r.label}
              </Text>
              <Text variant="tableStrong" style={styles.value}>
                {r.value}
              </Text>
              <Text
                variant="tableStrong"
                style={[styles.points, { color: NEWS2_COLORS[pointsTone(r.points)] }]}
              >
                {formatPoints(r.points)}
              </Text>
            </View>
          ))}
          <View style={[styles.row, styles.lastRow]}>
            <Text variant="tableStrong" style={styles.label}>
              Total NEWS2
            </Text>
            <Text
              variant="tableStrong"
              testID="news2-total"
              style={[styles.points, { color: NEWS2_COLORS[totalTone(score.total)] }]}
            >
              {score.total}
            </Text>
          </View>
          <Text variant="small" tone="sec" style={styles.measured}>
            Constantes de {clock(vitals.measuredAt, timeZone)}
          </Text>
        </View>
      ) : (
        <Text variant="small" tone="sec">
          Pas encore de constantes relevées.
        </Text>
      )}
      <Button
        label={vitals ? 'Modifier les constantes' : 'Saisir les constantes'}
        kind="secondary"
        size="sm"
        icon={Pencil}
        onPress={onEditVitals}
        style={styles.edit}
        testID="modifier-constantes"
      />
      {dossierLines(detail).map((line) => (
        <View key={line.label} style={styles.info}>
          <Text variant="table" tone="sec">
            {line.label}
          </Text>
          <Text variant="tableStrong" style={styles.infoValue}>
            {line.value}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.tableLine,
  },
  lastRow: { borderBottomWidth: 0 },
  label: { flex: 1 },
  value: { textAlign: 'right' },
  points: { width: 44, textAlign: 'right' },
  measured: { marginTop: 6 },
  edit: { marginTop: 10, marginBottom: 6 },
  info: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  infoValue: { flex: 1, textAlign: 'right' },
});
