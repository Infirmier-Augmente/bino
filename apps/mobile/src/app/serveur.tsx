import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { api, currentApiUrl, errorMessage } from '@/features/api/client';
import { useSession } from '@/features/session/store';
import { Field } from '@/ui/controls';
import { Button, Text } from '@/ui/primitives';
import { Card } from '@/ui/surfaces';
import { space } from '@/ui/theme';
import { UtilityScreen } from '@/ui/UtilityScreen';

/** Adresse de l'API (accessible sans connexion : utile au premier lancement sur téléphone). */
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
    <UtilityScreen title="Serveur" subtitle="Adresse de l’API Infirmier augmenté">
      <Card>
        <Field
          label="Adresse"
          value={value}
          onChangeText={setValue}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text variant="small" tone="sec" style={{ marginTop: space[2] }}>
          Sur téléphone : l’adresse « réseau » affichée au démarrage de l’API (même Wi-Fi), ex.
          http://192.168.1.20:8787
        </Text>
      </Card>
      <Button label="Tester et enregistrer" onPress={() => void test()} loading={testing} />
      {override ? (
        <Button
          label="Adresse automatique"
          kind="secondary"
          onPress={() => {
            setApiUrl(null);
            setValue(currentApiUrl());
            setResult(null);
          }}
          style={{ alignSelf: 'stretch' }}
        />
      ) : null}
      {result ? (
        <View accessibilityRole={result.ok ? undefined : 'alert'}>
          <Text variant="bodyStrong" tone={result.ok ? 'success' : 'error'}>
            {result.ok ? 'Connexion OK' : 'Échec'}
          </Text>
          <Text tone={result.ok ? 'success' : 'error'}>{result.message}</Text>
        </View>
      ) : null}
    </UtilityScreen>
  );
}
