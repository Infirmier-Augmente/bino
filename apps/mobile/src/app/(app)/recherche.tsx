import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text as RNText, View } from 'react-native';
import { useSearch } from '@/features/api/hooks';
import { useRequiredSession } from '@/features/session/store';
import { clock } from '@/lib/format';
import { ListRow } from '@/ui/controls';
import { Screen, TextField } from '@/ui/layout';
import { Divider, EmptyState, Loading, Section, Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { space, type } from '@/ui/theme';

/**
 * RECHERCHE SOURCÉE : des extraits de dictées, comme un Ctrl+F.
 * Jamais un chiffre affirmé : c'est l'infirmière qui conclut.
 */
export default function RechercheScreen() {
  const { colors } = useTheme();
  const { unitId } = useRequiredSession();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);
  const search = useSearch(unitId, q);

  return (
    <Screen title="Recherche" subtitle="Dans les dictées du service">
      <TextField
        value={input}
        onChangeText={setInput}
        placeholder="Doliprane, SNG, chute, famille…"
        accessibilityLabel="Rechercher dans les dictées"
        autoCorrect={false}
        returnKeyType="search"
      />
      {search.isFetching && !search.data ? <Loading label="Recherche…" /> : null}
      {q.length >= 2 && search.data?.length === 0 ? (
        <EmptyState title="Aucun extrait" description="Essaie un autre mot." />
      ) : null}
      {search.data && search.data.length > 0 ? (
        <Section title={`${search.data.length} extrait(s)`} flush>
          {search.data.map((h, i) => (
            <View key={`${h.transmissionId}:${h.sourceStart}`}>
              {i > 0 ? <Divider inset={space.lg} /> : null}
              <ListRow onPress={() => router.push(`/transmission/${h.transmissionId}`)}>
                <Text variant="label" tone="muted">
                  {h.patientLabel} · {clock(h.createdAt)}
                </Text>
                <RNText style={[type.body, { color: colors.inkMuted }]}>
                  {h.snippet.slice(0, h.matchStart)}
                  <RNText style={{ backgroundColor: colors.highlight, color: colors.ink }}>
                    {h.snippet.slice(h.matchStart, h.matchEnd)}
                  </RNText>
                  {h.snippet.slice(h.matchEnd)}
                </RNText>
              </ListRow>
            </View>
          ))}
        </Section>
      ) : null}
      {q.length < 2 ? (
        <Text tone="subtle">
          La recherche renvoie les passages exacts des dictées, avec l’heure et le patient. À toi de
          conclure.
        </Text>
      ) : null}
    </Screen>
  );
}
