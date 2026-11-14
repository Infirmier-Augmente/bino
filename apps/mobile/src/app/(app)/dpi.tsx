import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useDpiInbox } from '@/features/api/hooks';
import { clock } from '@/lib/format';
import { ListRow } from '@/ui/controls';
import { Screen } from '@/ui/layout';
import { Badge, Divider, EmptyState, Section, Stack, Text } from '@/ui/primitives';
import { space, type } from '@/ui/theme';

interface CompositionLike {
  id?: string;
  resourceType?: string;
  status?: string;
  title?: string;
  section?: { title?: string }[];
}

/**
 * DPI SIMULÉ — pas d'accès au vrai DPI pendant le hackathon : on montre ce qu'il
 * recevrait (Bundle FHIR R4). Une couche au-dessus de l'existant, pas un nouveau logiciel.
 */
export default function DpiScreen() {
  const inbox = useDpiInbox();
  const [openId, setOpenId] = useState<string | null>(null);
  const items = inbox.data ?? [];

  return (
    <Screen title="DPI simulé" subtitle="Exports structurés reçus (FHIR R4)">
      {items.length === 0 ? (
        <EmptyState
          title="Rien reçu pour l’instant"
          description="Depuis la fiche d’un patient, touche « Exporter »."
        />
      ) : (
        <Section flush>
          {items.map((e, i) => {
            const entries = (e.bundle.entry as { resource?: CompositionLike }[] | undefined) ?? [];
            const compositions = entries
              .map((x) => x.resource)
              .filter((r): r is CompositionLike => r?.resourceType === 'Composition');
            const open = openId === e.id;
            return (
              <View key={e.id}>
                {i > 0 ? <Divider inset={space.lg} /> : null}
                <ListRow onPress={() => setOpenId(open ? null : e.id)}>
                  <Text variant="bodyStrong">
                    {clock(e.exportedAt)} · {compositions.length} note(s) de soins
                  </Text>
                  <Stack direction="row" gap={space.xs} wrap>
                    {compositions.map((c) => (
                      <Badge
                        key={c.id ?? c.title}
                        tone={c.status === 'final' ? 'success' : 'question'}
                        label={`${c.status === 'final' ? 'validée' : 'préliminaire'} · ${(c.section ?? []).length} section(s)`}
                      />
                    ))}
                  </Stack>
                </ListRow>
                {open ? (
                  <ScrollView
                    horizontal
                    style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}
                  >
                    <Text style={[type.mono, { fontSize: 12, lineHeight: 17 }]} selectable>
                      {JSON.stringify(e.bundle, null, 2)}
                    </Text>
                  </ScrollView>
                ) : null}
              </View>
            );
          })}
        </Section>
      )}
    </Screen>
  );
}
