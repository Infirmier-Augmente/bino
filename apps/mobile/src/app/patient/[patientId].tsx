import type { PatientDetail } from '@infirmier/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { Folder, X } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import { ScrollView, StyleSheet, type TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/features/api/client';
import { useBoard, useCreateReport, usePatient, useSamples } from '@/features/api/hooks';
import { EMPTY_DRAFT, useDrafts } from '@/features/report/drafts';
import { MedicalRecord } from '@/features/report/MedicalRecord';
import { ReportComposer } from '@/features/report/ReportComposer';
import { useReportDictation } from '@/features/report/useReportDictation';
import { VitalsSheet } from '@/features/report/VitalsSheet';
import { useRequiredSession } from '@/features/session/store';
import { patientFullName } from '@/lib/format';
import { isReportEmpty, sampleFor } from '@/lib/report';
import { headingA11y, useEscapeKey } from '@/ui/a11y';
import { useDonePopup } from '@/ui/overlays';
import { Button, IconButton, Spinner, Text } from '@/ui/primitives';
import { TogglePill } from '@/ui/surfaces';
import { colors, space } from '@/ui/theme';
import { useToast } from '@/ui/toast';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/patients');
}

/**
 * FICHE « Nouveau compte rendu » (plein écran) : dossier médical repliable, zone de texte,
 * micro, « Valider ». Valider ENREGISTRE le compte rendu signé et horodaté ; la
 * structuration IA reste « à relire » côté serveur (jamais validée automatiquement).
 */
export default function PatientReportScreen() {
  const { patientId = '' } = useLocalSearchParams<{ patientId: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { nurse, unit } = useRequiredSession();
  const detail = usePatient(patientId);
  const board = useBoard(unit.id);
  const samples = useSamples(unit.id);
  const create = useCreateReport();
  const clearDraft = useDrafts((s) => s.clear);
  const toast = useToast();
  const done = useDonePopup();
  const [foldOpen, setFoldOpen] = useState(false);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const dictation = useReportDictation(patientId, () => inputRef.current?.focus());

  const patient =
    detail.data?.summary ?? board.data?.rows.find((r) => r.patient.id === patientId)?.patient;
  const sample = sampleFor(
    samples.data ?? [],
    patientId,
    detail.data?.transmissions.map((t) => t.dictation.transcript) ?? [],
  );

  const close = async () => {
    await dictation.finish();
    leave();
  };
  useEscapeKey(() => void close(), !vitalsOpen);

  const validate = async () => {
    if (create.isPending) return;
    await dictation.finish();
    const draft = useDrafts.getState().drafts[patientId] ?? EMPTY_DRAFT;
    if (isReportEmpty(draft.text)) {
      toast.show('Dicte ou écris d’abord le compte rendu.');
      return;
    }
    create.mutate(
      {
        unitId: unit.id,
        nurseId: nurse.id,
        patientId,
        mode: 'transmission',
        inputMethod: draft.inputMethod,
        transcript: draft.text.trim(),
      },
      {
        onSuccess: () => {
          clearDraft(patientId);
          leave();
          done.show('Compte rendu fait');
        },
        onError: () => toast.show('L’enregistrement a échoué. Réessaie dans un instant.'),
      },
    );
  };

  const onVitalsSaved = (saved: PatientDetail) => {
    setVitalsOpen(false);
    setFoldOpen(true);
    toast.show(`Constantes enregistrées · NEWS2 ${saved.news2?.total ?? '–'}.`);
  };

  return (
    <View style={styles.root} testID="fiche">
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: space[2] + insets.top }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <IconButton icon={X} label="Fermer" onPress={() => void close()} testID="fermer-fiche" />
        </View>
        <Text variant="sheetTitle" style={styles.title} {...headingA11y(1)}>
          Nouveau compte rendu
        </Text>
        {patient ? (
          <View>
            <Text variant="sheetName">{patientFullName(patient)}</Text>
            <Text variant="sub" tone="sec" style={styles.sub}>
              Chambre {patient.room} · {patient.age} ans
            </Text>
          </View>
        ) : detail.isError ? (
          <Text tone="error">{errorMessage(detail.error)}</Text>
        ) : (
          <Spinner />
        )}

        <View style={styles.actions}>
          <TogglePill
            label="Dossier médical"
            icon={Folder}
            on={foldOpen}
            onPress={() => setFoldOpen((v) => !v)}
            testID="dossier"
          />
        </View>
        {foldOpen ? (
          detail.data ? (
            <MedicalRecord
              detail={detail.data}
              timeZone={unit.timeZone}
              onEditVitals={() => setVitalsOpen(true)}
            />
          ) : (
            <View style={styles.loading}>
              <Spinner />
            </View>
          )
        ) : null}

        <ReportComposer
          patientId={patientId}
          inputRef={inputRef}
          dictation={dictation}
          sample={sample}
          minHeight={Math.round(height * 0.42)}
        />
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: space[4] + insets.bottom }]}>
        <Button
          label="Valider"
          onPress={() => void validate()}
          loading={create.isPending}
          disabled={dictation.busy}
          style={styles.validate}
          testID="valider"
        />
      </View>

      {vitalsOpen && patient ? (
        <VitalsSheet
          patient={patient}
          current={detail.data?.patient.vitals ?? null}
          onClose={() => setVitalsOpen(false)}
          onSaved={onVitalsSaved}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  scroll: { flexGrow: 1, paddingHorizontal: space[5] },
  topRow: { height: 44, flexDirection: 'row', justifyContent: 'flex-end' },
  title: { marginBottom: 6 },
  sub: { marginTop: 2 },
  actions: { marginTop: 18, marginBottom: 14 },
  loading: { paddingVertical: space[6], alignItems: 'center' },
  foot: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.footLine,
    paddingTop: space[3],
    paddingHorizontal: space[5],
  },
  validate: { width: '100%', maxWidth: 420, alignSelf: 'center' },
});
