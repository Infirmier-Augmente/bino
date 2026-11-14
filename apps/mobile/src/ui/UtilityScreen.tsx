import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { headingA11y } from './a11y';
import { IconButton, Text } from './primitives';
import { space } from './theme';

/** Écran utilitaire (serveur, simulateur) : bouton fermer, titre, sous-titre, contenu. */
export function UtilityScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingTop: space[2] + insets.top }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <IconButton
          icon={X}
          label="Fermer"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
      <Text variant="h1" {...headingA11y(1)}>
        {title}
      </Text>
      <Text variant="sub" tone="sec" style={styles.sub}>
        {subtitle}
      </Text>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space[5], paddingBottom: space[8] },
  top: { height: 44, flexDirection: 'row', justifyContent: 'flex-end' },
  sub: { marginTop: space[1] },
  body: { marginTop: space[4], gap: space[3] },
});
