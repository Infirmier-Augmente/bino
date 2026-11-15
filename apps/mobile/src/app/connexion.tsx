import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionInfo } from '@/features/api/hooks';
import { useSession } from '@/features/session/store';
import { type NurseChoice, nurseChoices } from '@/lib/session';
import { headingA11y } from '@/ui/a11y';
import { Text, TextButton } from '@/ui/primitives';
import { Card, Mascot } from '@/ui/surfaces';
import { colors, space } from '@/ui/theme';

/**
 * « QUI ES-TU ? » — connexion de démo sans mot de passe : un toucher sur son prénom et on arrive
 * sur Patients. Le soignant choisi signe ses comptes rendus (« Mes CR », « Karim 14h05 »).
 * Pas une authentification : l'API garde `POST /session/login` (matricule + mot de passe), non
 * utilisé ici.
 */
export default function ConnexionScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useSession((s) => s.signIn);
  const info = useSessionInfo();
  const choices = info.data ? nurseChoices(info.data) : [];

  const choose = ({ nurse, unit }: NurseChoice) => {
    signIn({ nurse, unit });
    router.replace('/patients');
  };

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 32 + insets.top }]}>
      <View style={styles.page}>
        <Mascot pose="presente" width={104} height={126} />
        <Text variant="h1" style={styles.title} {...headingA11y(1)}>
          Qui es-tu ?
        </Text>
        <Text variant="sub" tone="sec" style={styles.center}>
          Touche ton prénom pour commencer.
        </Text>

        <View style={styles.list}>
          {choices.map((c) => (
            <Card key={c.nurse.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${c.detail}`}
                onPress={() => choose(c)}
                testID={`soignant-${c.nurse.id}`}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.pressed },
                ]}
              >
                <Text variant="patientName">{c.name}</Text>
                <Text variant="small" tone="sec">
                  {c.detail}
                </Text>
              </Pressable>
            </Card>
          ))}
        </View>

        {info.isPending ? (
          <Text variant="sub" tone="sec" style={styles.hint}>
            Chargement…
          </Text>
        ) : null}
        {info.isError ? (
          <View style={styles.hint}>
            <TextButton
              label="Serveur injoignable : régler l’adresse"
              onPress={() => router.push('/serveur')}
            />
          </View>
        ) : null}
        {info.data && choices.length === 0 ? (
          <Text variant="sub" tone="sec" style={[styles.hint, styles.center]}>
            Aucun soignant dans le scénario chargé.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center' },
  page: { alignItems: 'center', paddingHorizontal: space[5], paddingBottom: 48 },
  title: { marginTop: space[3] },
  center: { textAlign: 'center' },
  list: { alignSelf: 'stretch', marginTop: space[4] },
  card: { padding: 0 },
  row: {
    minHeight: 72,
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  hint: { marginTop: space[4] },
});
