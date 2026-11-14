import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/features/api/client';
import { useBoard } from '@/features/api/hooks';
import { PatientRow } from '@/features/patients/PatientRow';
import { useRequiredSession, useSession } from '@/features/session/store';
import { useLogout } from '@/features/session/useLogout';
import { dateFr } from '@/lib/format';
import { PATIENT_SORT_LABELS, type PatientSort, sortPatients } from '@/lib/sort';
import { headingA11y } from '@/ui/a11y';
import { SortMenu } from '@/ui/controls';
import { Button, Spinner, Text, TextButton } from '@/ui/primitives';
import { CountBadge, Mascot } from '@/ui/surfaces';
import { space } from '@/ui/theme';

const SORT_OPTIONS = (Object.keys(PATIENT_SORT_LABELS) as PatientSort[]).map((value) => ({
  value,
  label: PATIENT_SORT_LABELS[value],
}));

/** PATIENTS : tous les patients du service, triés par chambre ou par nom. */
export default function PatientsScreen() {
  const insets = useSafeAreaInsets();
  const { nurse, unit } = useRequiredSession();
  const board = useBoard(unit.id);
  const sort = useSession((s) => s.patientSort);
  const setSort = useSession((s) => s.setPatientSort);
  const logout = useLogout();
  const rows = sortPatients(board.data?.rows ?? [], sort);
  const date = board.data ? dateFr(board.data.now, board.data.unit.timeZone) : null;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={board.isRefetching} onRefresh={() => void board.refetch()} />
      }
    >
      <View style={[styles.hello, { paddingTop: 24 + insets.top }]}>
        <Mascot pose="salue" width={52} height={52} />
        <View style={styles.helloText}>
          <Text variant="hello" numberOfLines={1} testID="prenom">
            {nurse.firstName}
          </Text>
          {date ? (
            <Text variant="field" tone="sec" style={{ fontSize: 15 }}>
              Date : {date}
            </Text>
          ) : null}
        </View>
        <TextButton label="Déconnexion" onPress={logout} testID="deconnexion" />
      </View>

      <View style={styles.main}>
        <View style={styles.listHead}>
          <View style={styles.listTitle}>
            <Text variant="listTitle" tone="sec" {...headingA11y(2)}>
              Patients
            </Text>
            {board.data ? <CountBadge value={rows.length} /> : null}
          </View>
          <SortMenu value={sort} options={SORT_OPTIONS} onChange={setSort} testID="tri-patients" />
        </View>

        {board.isPending ? (
          <View style={styles.state}>
            <Spinner />
            <Text tone="sec">Chargement…</Text>
          </View>
        ) : board.isError ? (
          <View style={styles.state}>
            <Text tone="sec">{errorMessage(board.error)}</Text>
            <Button
              label="Réessayer"
              kind="secondary"
              size="sm"
              onPress={() => void board.refetch()}
            />
          </View>
        ) : (
          rows.map((r) => (
            <PatientRow
              key={r.patient.id}
              patient={r.patient}
              onPress={() => router.push(`/patient/${r.patient.id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space[6] },
  hello: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space[5],
    paddingBottom: space[2],
  },
  helloText: { flex: 1, minWidth: 0, gap: space[1] },
  main: { paddingHorizontal: space[5], paddingTop: space[2] },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space[4],
    marginBottom: space[3],
  },
  listTitle: { flexDirection: 'row', alignItems: 'center' },
  state: { alignItems: 'center', gap: space[3], paddingVertical: space[8] },
});
