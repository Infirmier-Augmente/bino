import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Maximize2, MessageSquareText, Minimize2 } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '@/features/api/client';
import { useBoard, useHandover, useRecap } from '@/features/api/hooks';
import { HandoverSheetView } from '@/features/handover/HandoverSheetView';
import { PatientRow } from '@/features/handover/PatientRow';
import { PriorityControl } from '@/features/priority/PriorityControl';
import { useRequiredSession, useSession } from '@/features/session/store';
import { clock, plural } from '@/lib/format';
import { Screen, useIsWide } from '@/ui/layout';
import {
  Badge,
  Banner,
  Button,
  Divider,
  EmptyState,
  IconButton,
  Loading,
  Section,
  Stack,
  Text,
} from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { radius, space } from '@/ui/theme';
import { useToast } from '@/ui/toast';

/**
 * VUE RELÈVE — l'écran partagé de la relève (PC du poste de soins ou téléphone).
 * Patients triés ★ puis Rouge → Vert ; sur grand écran, la fiche s'ouvre à côté.
 * On ne remplace pas la relève orale : on la prépare.
 */
export default function ReleveScreen() {
  const { colors } = useTheme();
  const { unitId } = useRequiredSession();
  const wide = useIsWide();
  const meeting = useSession((s) => s.meetingMode);
  const setMeeting = useSession((s) => s.setMeetingMode);
  const board = useBoard(unitId);
  const [selected, setSelected] = useState<string | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const recap = useRecap(unitId, recapOpen);
  const toast = useToast();

  const rows = board.data?.rows ?? [];
  const current = selected ?? rows[0]?.patient.id ?? null;
  const sheet = useHandover(wide ? current : null);
  const totals = board.data?.totals;

  const header = board.data ? (
    <Stack gap={space.sm}>
      <Stack direction="row" gap={space.sm} wrap align="center">
        <Badge label={board.data.shift.label} />
        {totals ? <Badge label={plural(totals.total, 'transmission')} /> : null}
        {totals && totals.draft + totals.unreviewed > 0 ? (
          <Badge tone="question" label={`${totals.draft + totals.unreviewed} non relue(s)`} />
        ) : null}
        {totals && totals.openFlags > 0 ? (
          <Badge
            tone="question"
            label={plural(totals.openFlags, 'question ouverte', 'questions ouvertes')}
          />
        ) : null}
        <Text variant="caption" tone="subtle">
          Mise à jour {clock(board.data.now)}
        </Text>
      </Stack>
    </Stack>
  ) : null;

  const actions = (
    <Stack direction="row" gap={space.xs}>
      <IconButton
        icon={MessageSquareText}
        label="Récap court (SMS)"
        onPress={() => setRecapOpen(true)}
      />
      {wide ? (
        <IconButton
          icon={meeting ? Minimize2 : Maximize2}
          label={meeting ? 'Quitter le mode réunion' : 'Mode réunion (grand écran)'}
          onPress={() => setMeeting(!meeting)}
        />
      ) : null}
    </Stack>
  );

  const list = (
    <Section flush>
      {rows.map((row, i) => (
        <View key={row.patient.id}>
          {i > 0 ? <Divider inset={space.lg} /> : null}
          <PatientRow
            row={row}
            roomPrefix={board.data?.unit.roomPrefix ?? ''}
            selected={wide && current === row.patient.id}
            large={meeting}
            onPress={() =>
              wide ? setSelected(row.patient.id) : router.push(`/patients/${row.patient.id}`)
            }
          />
        </View>
      ))}
    </Section>
  );

  const recapModal = (
    <Modal
      visible={recapOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setRecapOpen(false)}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={() => setRecapOpen(false)}
      >
        <Pressable
          style={[styles.modal, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text variant="title">Récap court</Text>
          <Text tone="muted">Pour qui a raté la relève : une ligne par patient.</Text>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: space.sm }}>
            {(recap.data ?? []).map((l) => (
              <Text key={l.patientId} variant="label">
                {l.text}
              </Text>
            ))}
          </ScrollView>
          <Stack direction="row" gap={space.sm} justify="flex-end">
            <Button
              label="Copier"
              kind="secondary"
              onPress={() => {
                void Clipboard.setStringAsync((recap.data ?? []).map((l) => l.text).join('\n'));
                toast.show('Récap copié', 'success');
              }}
            />
            <Button label="Fermer" onPress={() => setRecapOpen(false)} />
          </Stack>
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (!wide) {
    return (
      <Screen title="Relève" subtitle={board.data?.unit.name} headerRight={actions} testID="releve">
        {header}
        {board.isLoading ? <Loading /> : null}
        {board.error ? (
          <Banner tone="error" title="Erreur">
            <Text tone="record">{errorMessage(board.error)}</Text>
          </Banner>
        ) : null}
        {rows.length ? list : board.data ? <EmptyState title="Aucun patient" /> : null}
        {recapModal}
      </Screen>
    );
  }

  const selectedRow = rows.find((r) => r.patient.id === current);
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.bg }]}
      edges={['top', 'right']}
      testID="releve"
    >
      <View style={styles.topbar}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text variant={meeting ? 'display' : 'title'}>
            Relève · {board.data?.unit.name ?? ''}
          </Text>
          {header}
        </View>
        {actions}
      </View>
      <View style={styles.columns}>
        <ScrollView
          style={[styles.left, meeting && { maxWidth: 560 }]}
          contentContainerStyle={{ padding: space.lg, gap: space.md }}
        >
          {board.isLoading ? <Loading /> : list}
        </ScrollView>
        <ScrollView
          style={[styles.right, { borderColor: colors.border }]}
          contentContainerStyle={{ padding: space.xl, gap: space.lg }}
        >
          {selectedRow ? (
            <>
              <Stack gap={space.xs}>
                <Text variant={meeting ? 'display' : 'title'}>
                  {selectedRow.patient.roomLabel} · {selectedRow.patient.displayName}
                </Text>
                <Text tone="muted">
                  {selectedRow.patient.age} ans · {selectedRow.patient.dayOfStay} ·{' '}
                  {selectedRow.patient.admissionReason}
                </Text>
              </Stack>
              <Stack direction="row" gap={space.md} align="center" wrap>
                <PriorityControl
                  patientId={selectedRow.patient.id}
                  priority={selectedRow.priority}
                />
                <Button
                  label="Ouvrir le dossier"
                  kind="ghost"
                  onPress={() => router.push(`/patients/${selectedRow.patient.id}`)}
                />
              </Stack>
              {sheet.data ? <HandoverSheetView sheet={sheet.data} large={meeting} /> : <Loading />}
            </>
          ) : (
            <EmptyState title="Sélectionne un patient" />
          )}
        </ScrollView>
      </View>
      {recapModal}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  columns: { flex: 1, flexDirection: 'row' },
  left: { flex: 2, maxWidth: 480 },
  right: { flex: 3, borderLeftWidth: StyleSheet.hairlineWidth },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  modal: {
    width: '100%',
    maxWidth: 640,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
  },
});
