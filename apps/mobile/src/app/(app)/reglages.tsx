import { router } from 'expo-router';
import { View } from 'react-native';
import { currentApiUrl } from '@/features/api/client';
import { useConfig, useSessionInfo } from '@/features/api/hooks';
import { type ThemePreference, useRequiredSession, useSession } from '@/features/session/store';
import { ListRow, Segmented } from '@/ui/controls';
import { Screen } from '@/ui/layout';
import { Button, Divider, Section, Stack, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';

export default function ReglagesScreen() {
  const config = useConfig();
  const info = useSessionInfo();
  const { nurseId } = useRequiredSession();
  const theme = useSession((s) => s.theme);
  const setTheme = useSession((s) => s.setTheme);
  const demo = useSession((s) => s.demoMode);
  const setDemo = useSession((s) => s.setDemoMode);
  const signOut = useSession((s) => s.signOut);
  const nurse = info.data?.nurses.find((n) => n.id === nurseId);
  const c = config.data;

  return (
    <Screen title="Réglages">
      <Section title="Soignant">
        <Text variant="bodyStrong">
          {nurse ? `${nurse.firstName} ${nurse.lastName} (${nurse.role})` : nurseId}
        </Text>
        <Button
          label="Changer de soignant"
          kind="secondary"
          onPress={() => {
            signOut();
            router.replace('/bienvenue');
          }}
        />
      </Section>

      <Section title="Affichage">
        <Segmented<ThemePreference>
          accessibilityLabel="Thème"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'system', label: 'Système' },
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre (nuit)' },
          ]}
        />
        <Segmented<'on' | 'off'>
          accessibilityLabel="Exemples de dictée"
          value={demo ? 'on' : 'off'}
          onChange={(v) => setDemo(v === 'on')}
          options={[
            { value: 'on', label: 'Exemples de dictée visibles' },
            { value: 'off', label: 'Masqués' },
          ]}
        />
      </Section>

      <Section title="Serveur et IA" flush>
        <ListRow onPress={() => router.push('/serveur')}>
          <Text variant="bodyStrong">Adresse du serveur</Text>
          <Text variant="caption" tone="subtle">
            {currentApiUrl()}
          </Text>
        </ListRow>
        {c ? (
          <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm }}>
            <Divider />
            <Stack gap={space.xs}>
              <Text>
                Structuration : {c.llm.provider}
                {c.llm.model ? ` (${c.llm.model})` : ''}
                {c.llm.fallback ? `, repli ${c.llm.fallback}` : ''}
              </Text>
              <Text>
                Transcription serveur :{' '}
                {c.stt.ready
                  ? `${c.stt.provider}${c.stt.model ? ` (${c.stt.model})` : ''}`
                  : 'non configurée'}
              </Text>
              <Text>Classifieur : {c.classifier.provider}</Text>
              <Text variant="caption" tone="subtle">
                Les fournisseurs se changent côté serveur (fichier .env), sans toucher au code.
              </Text>
            </Stack>
          </View>
        ) : null}
      </Section>
      <Text variant="caption" tone="subtle" style={{ textAlign: 'center' }}>
        Prototype de hackathon · données fictives uniquement · version {c?.version ?? '?'}
      </Text>
    </Screen>
  );
}
