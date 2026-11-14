import type { Sex } from '@infirmier/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Mic } from 'lucide-react-native';
import { useState } from 'react';
import { api, errorMessage } from '@/features/api/client';
import { useRequiredSession } from '@/features/session/store';
import { Segmented } from '@/ui/controls';
import { Screen, TextField } from '@/ui/layout';
import { Banner, Button, Section, Stack, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';

/**
 * ENTRÉE D'UN PATIENT (« je ne peux pas écrire quand il y a une admission ») :
 * quelques champs d'identité, puis une dictée libre transformée en macro-cible d'entrée.
 */
export default function AdmissionScreen() {
  const { unitId, nurseId } = useRequiredSession();
  const qc = useQueryClient();
  const [room, setRoom] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [sex, setSex] = useState<Sex>('F');
  const [birthDate, setBirthDate] = useState('');
  const [reason, setReason] = useState('');

  const admit = useMutation({
    mutationFn: () =>
      api.admitPatient({
        body: {
          unitId,
          room: room.trim(),
          lastName: lastName.trim(),
          firstName: firstName.trim(),
          sex,
          birthDate,
          admissionReason: reason.trim(),
          assignedNurseId: nurseId,
        },
      }),
    onSuccess: (p) => {
      void qc.invalidateQueries();
      router.replace({ pathname: '/dictee', params: { patientId: p.id, mode: 'admission' } });
    },
  });

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  const ready = room.trim() && lastName.trim() && firstName.trim() && validDate;

  return (
    <Screen
      back
      title="Entrée d’un patient"
      subtitle="Identité, puis dictée libre de l’admission"
      footer={
        <Button
          label="Continuer vers la dictée"
          icon={Mic}
          size="lg"
          block
          style={{ flex: 1 }}
          disabled={!ready}
          loading={admit.isPending}
          onPress={() => admit.mutate()}
        />
      }
    >
      <Section title="Identité (fictive)">
        <Stack gap={space.md}>
          <TextField
            label="Chambre / box"
            value={room}
            onChangeText={setRoom}
            keyboardType="number-pad"
            placeholder="16"
          />
          <TextField
            label="Nom"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
          <TextField
            label="Prénom"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          <Stack gap={space.xs}>
            <Text variant="label" tone="muted">
              Sexe
            </Text>
            <Segmented
              accessibilityLabel="Sexe"
              value={sex}
              onChange={setSex}
              options={[
                { value: 'F', label: 'Femme' },
                { value: 'M', label: 'Homme' },
              ]}
            />
          </Stack>
          <TextField
            label="Date de naissance"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="AAAA-MM-JJ"
            error={birthDate && !validDate ? 'Format attendu : 1948-05-21' : null}
          />
          <TextField
            label="Motif d’entrée (facultatif)"
            value={reason}
            onChangeText={setReason}
            hint="Tu pourras aussi le dicter."
          />
        </Stack>
      </Section>
      {admit.error ? (
        <Banner tone="error" title="Entrée impossible">
          <Text tone="record">{errorMessage(admit.error)}</Text>
        </Banner>
      ) : null}
    </Screen>
  );
}
