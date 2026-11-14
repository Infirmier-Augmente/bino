import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, currentApiUrl, errorMessage } from '@/features/api/client';
import { useSession } from '@/features/session/store';
import { Screen, TextField } from '@/ui/layout';
import { Banner, Button, Stack, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';

/** Adresse de l'API (accessible même sans session : utile au premier lancement sur téléphone). */
export default function ServeurScreen() {
  const setApiUrl = useSession((s) => s.setApiUrl);
  const override = useSession((s) => s.apiUrl);
  const qc = useQueryClient();
  const [value, setValue] = useState(override ?? currentApiUrl());
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    setApiUrl(value.trim() || null);
    try {
      await api.health();
      setResult({ ok: true, message: `Connecté à ${currentApiUrl()}` });
      void qc.invalidateQueries();
    } catch (e) {
      setResult({ ok: false, message: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Screen back title="Serveur" subtitle="Adresse de l’API Infirmier augmenté">
      <TextField
        label="Adresse"
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint="Sur téléphone : l’adresse « réseau » affichée au démarrage de l’API (même Wi-Fi), ex. http://192.168.1.20:8787"
      />
      <Stack direction="row" gap={space.sm}>
        <Button label="Tester et enregistrer" onPress={() => void test()} loading={testing} />
        {override ? (
          <Button
            label="Adresse automatique"
            kind="ghost"
            onPress={() => {
              setApiUrl(null);
              setValue(currentApiUrl());
              setResult(null);
            }}
          />
        ) : null}
      </Stack>
      {result ? (
        <Banner tone={result.ok ? 'success' : 'error'} title={result.ok ? 'Connexion OK' : 'Échec'}>
          <Text tone={result.ok ? 'success' : 'record'}>{result.message}</Text>
        </Banner>
      ) : null}
    </Screen>
  );
}
