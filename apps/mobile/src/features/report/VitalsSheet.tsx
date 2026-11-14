import { news2, type PatientDetail, type PatientSummary } from '@infirmier/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useUpdateVitals } from '@/features/api/hooks';
import { patientFullName, roomChipLabel } from '@/lib/format';
import { type NumericVital, parseVitalsForm, type VitalsForm, vitalsToForm } from '@/lib/vitals';
import { headingA11y } from '@/ui/a11y';
import { ChoiceField, Field } from '@/ui/controls';
import { BottomSheet } from '@/ui/overlays';
import { Button, Text } from '@/ui/primitives';
import { Card } from '@/ui/surfaces';
import { space } from '@/ui/theme';
import { useToast } from '@/ui/toast';

const NUMERIC_ROWS: readonly (readonly [NumericVital, string, NumericVital, string])[] = [
  ['respiratoryRate', 'FR (/min)', 'spo2', 'SpO2 (%)'],
  ['systolic', 'TA systolique', 'diastolic', 'TA diastolique'],
  ['heartRate', 'FC (/min)', 'temperature', 'Température (°C)'],
];

/**
 * Feuille « Constantes » : saisie manuelle, NEWS2 recalculé en direct par la règle du
 * domaine (`news2`). Aucune borne physiologique : seulement des nombres > 0.
 */
export function VitalsSheet({
  patient,
  current,
  onClose,
  onSaved,
}: {
  patient: PatientSummary;
  current: PatientDetail['patient']['vitals'];
  onClose: () => void;
  onSaved: (detail: PatientDetail) => void;
}) {
  const toast = useToast();
  const save = useUpdateVitals(patient.id);
  const [form, setForm] = useState<VitalsForm>(() => vitalsToForm(current));
  const parsed = parseVitalsForm(form);
  const preview = parsed ? news2(parsed).total : null;

  const setValue = (key: NumericVital) => (text: string) => setForm((f) => ({ ...f, [key]: text }));
  const submit = () => {
    if (!parsed) {
      toast.show('Vérifie les valeurs saisies.');
      return;
    }
    save.mutate(parsed, {
      onSuccess: onSaved,
      onError: () => toast.show('L’enregistrement a échoué. Réessaie dans un instant.'),
    });
  };

  return (
    <BottomSheet
      label="Constantes"
      onClose={onClose}
      testID="feuille-constantes"
      footer={
        <Button
          label="Enregistrer"
          onPress={submit}
          loading={save.isPending}
          testID="enregistrer-constantes"
        />
      }
    >
      <Text variant="h1" {...headingA11y(1)}>
        Constantes
      </Text>
      <Text variant="sub" tone="sec">
        {patientFullName(patient)} · {roomChipLabel(patient.room)} · le score se recalcule en direct
      </Text>
      <Card style={styles.card}>
        <View style={styles.grid}>
          {NUMERIC_ROWS.map(([a, labelA, b, labelB]) => (
            <View key={a} style={styles.gridRow}>
              {(
                [
                  [a, labelA],
                  [b, labelB],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  label={label}
                  value={form[key]}
                  onChangeText={setValue(key)}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  testID={`constante-${key}`}
                />
              ))}
            </View>
          ))}
          <ChoiceField
            label="Oxygène"
            value={form.onOxygen ? 'o2' : 'air'}
            options={[
              { value: 'air', label: 'Air ambiant' },
              { value: 'o2', label: 'Sous O2' },
            ]}
            onChange={(v) => setForm((f) => ({ ...f, onOxygen: v === 'o2' }))}
            testIDPrefix="oxygene"
          />
          <ChoiceField
            label="Conscience"
            value={form.consciousness}
            options={[
              { value: 'A', label: 'Alerte' },
              { value: 'C', label: 'Confusion / altérée' },
            ]}
            onChange={(consciousness) => setForm((f) => ({ ...f, consciousness }))}
            testIDPrefix="conscience"
          />
        </View>
      </Card>
      <Card style={[styles.card, styles.preview]}>
        <Text variant="small" tone="sec">
          Nouveau score NEWS2
        </Text>
        <Text
          variant="popupTitle"
          testID="news2-apercu"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Nouveau score NEWS2 : ${preview ?? 'incomplet'}`}
        >
          {preview ?? '–'}
        </Text>
      </Card>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 0 },
  grid: { gap: 10 },
  gridRow: { flexDirection: 'row', gap: 10 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
});
