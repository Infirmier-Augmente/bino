import { REVIEW_LABELS } from '@infirmier/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { FileOutput, Mic } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/features/api/client';
import { useExportToDpi, useHandover, usePatient } from '@/features/api/hooks';
import { HandoverSheetView } from '@/features/handover/HandoverSheetView';
import { PriorityControl } from '@/features/priority/PriorityControl';
import { clock } from '@/lib/format';
import { ListRow, Segmented } from '@/ui/controls';
import { Screen } from '@/ui/layout';
import {
  Badge,
  Banner,
  Button,
  Divider,
  EmptyState,
  Loading,
  Section,
  Stack,
  Text,
} from '@/ui/primitives';
import { space } from '@/ui/theme';
import { useToast } from '@/ui/toast';

/** Un patient : sa fiche de relève, ses transmissions, sa priorité, l'export DPI. */
export default function PatientScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const detail = usePatient(patientId);
  const sheet = useHandover(patientId);
  const exportDpi = useExportToDpi(patientId);
  const toast = useToast();
  const [tab, setTab] = useState<'fiche' | 'transmissions'>('fiche');

  if (detail.isLoading)
    return (
      <Screen back>
        <Loading />
      </Screen>
    );
  if (detail.error || !detail.data) {
    return (
      <Screen back title="Patient">
        <Banner tone="error" title="Patient introuvable">
          <Text tone="record">{errorMessage(detail.error)}</Text>
        </Banner>
      </Screen>
    );
  }
  const { summary, priority, transmissions } = detail.data;

  return (
    <Screen
      back
      title={`${summary.roomLabel} · ${summary.displayName}`}
      subtitle={`${summary.age} ans · ${summary.dayOfStay} · ${summary.admissionReason}`}
      footer={
        <>
          <Button
            label="Exporter"
            kind="secondary"
            icon={FileOutput}
            size="lg"
            loading={exportDpi.isPending}
            accessibilityHint="Envoie les transmissions du poste au DPI simulé"
            onPress={() =>
              exportDpi.mutate(undefined, {
                onSuccess: (e) =>
                  toast.show(
                    `Envoyé au DPI · ${e.transmissionIds.length} transmission(s)`,
                    'success',
                  ),
                onError: (e) => toast.show(errorMessage(e), 'error'),
              })
            }
          />
          <Button
            label="Dicter"
            accessibilityLabel="Dicter pour ce patient"
            icon={Mic}
            size="lg"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/dictee', params: { patientId } })}
          />
        </>
      }
    >
      <PriorityControl patientId={patientId} priority={priority} />
      <Segmented
        accessibilityLabel="Vue"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'fiche', label: 'Fiche de relève' },
          { value: 'transmissions', label: `Transmissions (${transmissions.length})` },
        ]}
      />
      {tab === 'fiche' ? (
        sheet.data ? (
          <HandoverSheetView sheet={sheet.data} />
        ) : (
          <Loading />
        )
      ) : transmissions.length === 0 ? (
        <EmptyState
          title="Aucune transmission"
          description="Dicte la première depuis le bouton en bas."
        />
      ) : (
        <Section flush>
          {transmissions.map((t, i) => (
            <View key={t.id}>
              {i > 0 ? <Divider inset={space.lg} /> : null}
              <ListRow
                onPress={() => router.push(`/transmission/${t.id}`)}
                testID={`transmission-${t.id}`}
              >
                <Stack direction="row" gap={space.sm} align="center" wrap>
                  <Text variant="bodyStrong">{clock(t.createdAt)}</Text>
                  <Badge
                    label={REVIEW_LABELS[t.review.status]}
                    tone={t.review.status === 'validated' ? 'success' : 'question'}
                  />
                  {t.mode === 'admission' ? <Badge label="Entrée" tone="accent" /> : null}
                </Stack>
                <Text variant="label" tone="muted" numberOfLines={2}>
                  {t.content.targets.map((x) => x.label).join(' · ') || t.dictation.transcript}
                </Text>
              </ListRow>
            </View>
          ))}
        </Section>
      )}
    </Screen>
  );
}
