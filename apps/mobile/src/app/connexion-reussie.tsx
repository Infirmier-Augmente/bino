import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSession } from '@/features/session/store';
import { nurseFullName } from '@/lib/format';
import { headingA11y } from '@/ui/a11y';
import { Button, Text } from '@/ui/primitives';
import { Mascot } from '@/ui/surfaces';
import { space } from '@/ui/theme';

/** CONNEXION RÉUSSIE : Bino lève le pouce ; pas de redirection automatique. */
export default function ConnexionReussieScreen() {
  const nurse = useSession((s) => s.nurse);
  if (!nurse) return <Redirect href="/connexion" />;
  return (
    <View style={styles.root}>
      <Mascot pose="pouce" width={200} height={220} />
      <Text variant="h1" style={styles.center} {...headingA11y(1)}>
        {nurseFullName(nurse)}
      </Text>
      <Text variant="sub" tone="sec">
        Connexion réussie
      </Text>
      <Button
        label="Continuer"
        onPress={() => router.replace('/patients')}
        style={styles.button}
        testID="continuer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[5],
    paddingBottom: 48,
  },
  center: { textAlign: 'center', marginTop: space[1] },
  button: { marginTop: space[4], alignSelf: 'center', width: '100%', maxWidth: 280 },
});
