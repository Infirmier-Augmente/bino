import { ApiError } from '@infirmier/domain';
import { router } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/features/api/client';
import { useLogin, useSessionInfo } from '@/features/api/hooks';
import { useSession } from '@/features/session/store';
import { headingA11y } from '@/ui/a11y';
import { Field } from '@/ui/controls';
import { Button, Text, TextButton } from '@/ui/primitives';
import { Card, Mascot } from '@/ui/surfaces';
import { space } from '@/ui/theme';

const BAD_CREDENTIALS = 'Matricule ou mot de passe incorrect.';

/** CONNEXION de démo : matricule + mot de passe partagé, vérifiés par le serveur. */
export default function ConnexionScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useSession((s) => s.signIn);
  const info = useSessionInfo();
  const login = useLogin();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const idRef = useRef<ComponentRef<typeof TextInput>>(null);
  const pwRef = useRef<ComponentRef<typeof TextInput>>(null);
  const demoMatricule = info.data?.nurses[0]?.matricule;

  const submit = () => {
    const id = matricule.replace(/\s+/g, '');
    if (!id || !password.trim()) {
      setError('Indique le matricule et le mot de passe.');
      (id ? pwRef : idRef).current?.focus();
      return;
    }
    login.mutate(
      { matricule: id, password },
      {
        onSuccess: (result) => {
          signIn(result);
          setPassword('');
          router.replace('/connexion-reussie');
        },
        onError: (e) => {
          const status = e instanceof ApiError ? e.status : -1;
          setOffline(status === 0);
          setError(
            status === 400 || status === 401 || status === 404 ? BAD_CREDENTIALS : errorMessage(e),
          );
          if (status !== 0) pwRef.current?.focus();
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: 32 + insets.top }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.login}>
          <Mascot pose="presente" width={104} height={126} />
          <Text variant="h1" style={styles.title} {...headingA11y(1)}>
            Connexion
          </Text>
          <Text variant="sub" tone="sec" style={styles.center}>
            Entre ton matricule et ton mot de passe.
          </Text>
          <Card style={styles.card}>
            <View style={{ gap: space[3] }}>
              <Field
                ref={idRef}
                label="Matricule"
                value={matricule}
                onChangeText={setMatricule}
                keyboardType="number-pad"
                inputMode="numeric"
                autoComplete="username"
                textContentType="username"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => pwRef.current?.focus()}
                testID="login-matricule"
              />
              <Field
                ref={pwRef}
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={submit}
                testID="login-password"
              />
            </View>
            {error ? (
              <Text variant="sub" tone="error" accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Button
              label="Se connecter"
              onPress={submit}
              loading={login.isPending}
              style={styles.submit}
              testID="login-submit"
            />
          </Card>
          {demoMatricule ? (
            <Text variant="small" tone="sec" style={styles.hint}>
              Démo · matricule {demoMatricule} · mot de passe bino
            </Text>
          ) : null}
          {offline || info.isError ? (
            <View style={styles.hint}>
              <TextButton
                label="Serveur injoignable : régler l’adresse"
                onPress={() => router.push('/serveur')}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  login: { alignItems: 'center', paddingHorizontal: space[5], paddingBottom: 48 },
  title: { marginTop: space[3] },
  center: { textAlign: 'center' },
  card: { alignSelf: 'stretch', marginTop: space[4], marginBottom: 0 },
  error: { marginTop: space[3] },
  submit: { marginTop: space[4] },
  hint: { marginTop: space[4], textAlign: 'center' },
});
