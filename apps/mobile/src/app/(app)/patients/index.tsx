import { router } from 'expo-router';
import { Mic, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { errorMessage } from '@/features/api/client';
import { useBoard, useSessionInfo } from '@/features/api/hooks';
import { PatientRow } from '@/features/handover/PatientRow';
import { useRequiredSession } from '@/features/session/store';
import { Segmented } from '@/ui/controls';
import { Screen } from '@/ui/layout';
import { Banner, Button, Divider, EmptyState, Loading, Section, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';

/** Accueil téléphone : mes patients (ou tout le service) + bouton Dicter toujours à portée de pouce. */
export default function PatientsScreen() {
  const { unitId, nurseId } = useRequiredSession();
  const board = useBoard(unitId);
  const session = useSessionInfo();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const nurse = session.data?.nurses.find((n) => n.id === nurseId);
  const unit = board.data?.unit;

  const rows = board.data?.rows ?? [];
  const mine = rows.filter((r) => r.patient.assignedNurseId === nurseId);
  const visible = scope === 'mine' && mine.length > 0 ? mine : rows;

  return (
    <Screen
      title={unit?.name ?? 'Patients'}
      subtitle={[nurse?.firstName, board.data?.shift.label].filter(Boolean).join(' · ')}
      refreshControl={
        <RefreshControl refreshing={board.isRefetching} onRefresh={() => void board.refetch()} />
      }
      footer={
        <>
          <Button
            label="Entrée"
            kind="secondary"
            icon={UserPlus}
            size="lg"
            onPress={() => router.push('/admission')}
            accessibilityHint="Nouveau patient et dictée d’admission"
          />
          <Button
            label="Dicter"
            icon={Mic}
            size="lg"
            style={{ flex: 1 }}
            testID="dicter"
            onPress={() => router.push('/dictee')}
          />
        </>
      }
    >
      <Segmented
        accessibilityLabel="Patients affichés"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'mine', label: `Mes patients (${mine.length})` },
          { value: 'all', label: `Service (${rows.length})` },
        ]}
      />
      {board.isLoading ? <Loading /> : null}
      {board.error ? (
        <Banner tone="error" title="Impossible de charger les patients">
          <Text tone="record">{errorMessage(board.error)}</Text>
        </Banner>
      ) : null}
      {board.data && visible.length === 0 ? (
        <EmptyState
          title="Aucun patient"
          description="Charge un scénario depuis le simulateur pour remplir le service."
        />
      ) : null}
      {visible.length > 0 ? (
        <Section flush>
          {visible.map((row, i) => (
            <View key={row.patient.id}>
              {i > 0 ? <Divider inset={space.lg} /> : null}
              <PatientRow
                row={row}
                roomPrefix={unit?.roomPrefix ?? ''}
                onPress={() => router.push(`/patients/${row.patient.id}`)}
              />
            </View>
          ))}
        </Section>
      ) : null}
      <Text variant="caption" tone="subtle" style={{ textAlign: 'center' }}>
        Triés par priorité : ★ d’abord, puis Rouge → Vert. Les couleurs sont des suggestions.
      </Text>
    </Screen>
  );
}
