import type { PatientListItem } from '@infirmier/domain';
import { CircleAlert, ShieldAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { plural } from '@/lib/format';
import { ListRow, PriorityBadge, RoomNumber, StarToggle } from '@/ui/controls';
import { Badge, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';

/** Une ligne de la liste patients / de la vue service. */
export function PatientRow({
  row,
  roomPrefix,
  onPress,
  selected,
  large,
}: {
  row: PatientListItem;
  roomPrefix: string;
  onPress: () => void;
  selected?: boolean;
  large?: boolean;
}) {
  const { patient, priority, counts } = row;
  const notReviewed = counts.draft + counts.unreviewed;
  return (
    <ListRow
      onPress={onPress}
      selected={selected}
      chevron={false}
      testID={`patient-${patient.room}`}
      accessibilityLabel={`${patient.roomLabel}, ${patient.displayName}, priorité ${priority.level}`}
      leading={<RoomNumber prefix={roomPrefix} room={patient.room} />}
    >
      <View style={styles.titleRow}>
        <Text
          variant={large ? 'heading' : 'bodyStrong'}
          numberOfLines={1}
          style={{ flexShrink: 1 }}
        >
          {patient.displayName}
        </Text>
        <StarToggle starred={priority.starred} size={16} />
        <View style={{ flex: 1 }} />
        <PriorityBadge level={priority.level} origin={priority.origin} />
      </View>
      <Text variant="caption" tone="subtle" numberOfLines={1}>
        {`${patient.age} ans · ${patient.dayOfStay} · ${patient.admissionReason}`}
      </Text>
      {row.headline[0] ? (
        <Text
          variant={large ? 'body' : 'label'}
          tone="muted"
          numberOfLines={large ? 3 : 2}
          style={{ marginTop: 2 }}
        >
          {row.headline[0].text}
        </Text>
      ) : null}
      {notReviewed > 0 || counts.openFlags > 0 || row.alerts.length > 0 ? (
        <View style={styles.badges}>
          {notReviewed > 0 ? (
            <Badge
              tone="question"
              label={`${notReviewed} non relue${notReviewed > 1 ? 's' : ''}`}
            />
          ) : null}
          {counts.openFlags > 0 ? (
            <Badge
              tone="question"
              icon={CircleAlert}
              label={plural(counts.openFlags, 'question')}
            />
          ) : null}
          {row.alerts.map((a) => (
            <Badge key={a} icon={ShieldAlert} label={a} />
          ))}
        </View>
      ) : null}
    </ListRow>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
});
