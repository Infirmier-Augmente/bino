import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/features/api/client';
import { useConfig, useSessionInfo } from '@/features/api/hooks';
import { useSession } from '@/features/session/store';
import { initials } from '@/lib/format';
import { ListRow, Segmented } from '@/ui/controls';
import { Screen } from '@/ui/layout';
import { Banner, Button, Divider, Loading, Section, Stack, Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { space } from '@/ui/theme';

/** Prise de poste : choisir son service et son nom. Deux gestes, pas de mot de passe (démo). */
export default function Bienvenue() {
  const { colors } = useTheme();
  const session = useSessionInfo();
  const config = useConfig();
  const signIn = useSession((s) => s.signIn);
  const [unitId, setUnitId] = useState<string | null>(useSession.getState().unitId);
  const [nurseId, setNurseId] = useState<string | null>(null);

  const units = session.data?.units ?? [];
  useEffect(() => {
    if (!unitId && units[0]) setUnitId(units[0].id);
  }, [unitId, units]);

  const nurses = (session.data?.nurses ?? []).filter((n) => n.unitId === unitId);

  return (
    <Screen
      footer={
        <Button
          label="Prendre mon poste"
          size="lg"
          block
          style={{ flex: 1 }}
          disabled={!unitId || !nurseId}
          onPress={() => {
            if (!unitId || !nurseId) return;
            signIn(unitId, nurseId);
            router.replace('/patients');
          }}
        />
      }
    >
      <Stack gap={space.sm} style={{ paddingTop: space.xxl }}>
        <Text variant="display" accessibilityRole="header">
          Infirmier augmenté
        </Text>
        <Text tone="muted">
          Dicte tes transmissions en sortant de la chambre. À la relève, la fiche de chaque patient
          est prête.
        </Text>
      </Stack>

      {session.isLoading ? <Loading label="Connexion au serveur…" /> : null}
      {session.error ? (
        <Banner tone="error" title="Serveur injoignable">
          <Text tone="record">{errorMessage(session.error)}</Text>
          <Button
            label="Réglages du serveur"
            kind="secondary"
            onPress={() => router.push('/serveur')}
          />
        </Banner>
      ) : null}

      {units.length > 1 ? (
        <Section title="Service">
          <Segmented
            accessibilityLabel="Service"
            value={unitId ?? ''}
            options={units.map((u) => ({ value: u.id, label: u.name }))}
            onChange={(v) => {
              setUnitId(v);
              setNurseId(null);
            }}
          />
        </Section>
      ) : null}

      {nurses.length > 0 ? (
        <Section title="Qui prend le poste ?" flush>
          {nurses.map((n, i) => (
            <View key={n.id}>
              {i > 0 ? <Divider inset={space.lg} /> : null}
              <ListRow
                onPress={() => setNurseId(n.id)}
                selected={nurseId === n.id}
                testID={`soignant-${n.id}`}
                leading={
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: nurseId === n.id ? colors.accent : colors.surfaceMuted },
                    ]}
                  >
                    <Text variant="label" tone={nurseId === n.id ? 'onAccent' : 'ink'}>
                      {initials(n.firstName, n.lastName)}
                    </Text>
                  </View>
                }
              >
                <Text variant="bodyStrong">
                  {n.firstName} {n.lastName}
                </Text>
                <Text variant="caption" tone="subtle">
                  {n.role}
                </Text>
              </ListRow>
            </View>
          ))}
        </Section>
      ) : null}

      {config.data ? (
        <Text variant="caption" tone="subtle">
          IA : {config.data.llm.provider}
          {config.data.llm.model ? ` (${config.data.llm.model})` : ''} · classifieur{' '}
          {config.data.classifier.provider} · données 100 % fictives
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
