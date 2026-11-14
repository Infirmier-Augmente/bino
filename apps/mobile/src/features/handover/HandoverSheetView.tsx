import type { HandoverSheet } from '@infirmier/domain';
import { CircleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { DarBlock } from '@/features/transmission/DarBlock';
import { SourcedLine } from '@/features/transmission/SourcedLine';
import { plural } from '@/lib/format';
import { Badge, Divider, Section, Stack, Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { space } from '@/ui/theme';

/**
 * FICHE DE RELÈVE (exemple B du kit) : à retenir, appareils, infos transverses,
 * à faire, questions ouvertes. Chaque ligne garde sa source.
 */
export function HandoverSheetView({ sheet, large }: { sheet: HandoverSheet; large?: boolean }) {
  const { colors } = useTheme();
  const notReviewed = sheet.counts.draft + sheet.counts.unreviewed;
  return (
    <Stack gap={space.xl}>
      <Stack direction="row" gap={space.sm} wrap>
        <Badge label={sheet.shift.label} />
        {notReviewed > 0 ? (
          <Badge
            tone="question"
            icon={CircleAlert}
            label={`${plural(notReviewed, 'transmission')} non relue${notReviewed > 1 ? 's' : ''}`}
          />
        ) : sheet.counts.total > 0 ? (
          <Badge tone="success" label="Tout est relu" />
        ) : null}
      </Stack>

      <Section title="À retenir" testID="a-retenir">
        {sheet.headline.length === 0 ? (
          <Text tone="muted">Aucun événement dicté sur ce poste.</Text>
        ) : (
          sheet.headline.map((h) => <SourcedLine key={h.id} item={h} />)
        )}
      </Section>

      {sheet.openFlags.length > 0 ? (
        <Section title={`À clarifier (${sheet.openFlags.length})`}>
          {sheet.openFlags.map((f) => (
            <View key={f.id} style={styles.flag}>
              <CircleAlert size={18} color={colors.question} />
              <Text tone="question" style={{ flex: 1 }}>
                {f.question}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}

      <Section title={sheet.template === 'par-appareil' ? 'Par appareil' : 'Le poste'}>
        {sheet.sections.map((s, i) => (
          <View key={s.key} style={{ gap: space.xs }}>
            {i > 0 ? <Divider /> : null}
            <View style={[styles.sectionRow, large && { paddingVertical: space.xs }]}>
              <Text variant="label" tone="muted" style={styles.sectionTitle}>
                {s.title}
              </Text>
              <View style={{ flex: 1, gap: 2 }}>
                {s.items.length === 0 ? (
                  <Text tone="subtle">Non dicté sur ce poste</Text>
                ) : (
                  s.items.map((it) => <SourcedLine key={it.id} item={it} />)
                )}
              </View>
            </View>
          </View>
        ))}
      </Section>

      {sheet.targets.length > 0 ? (
        <Section title="Transmissions ciblées (DAR)">
          {sheet.targets.map((t, i) => (
            <View key={t.id} style={{ gap: space.md }}>
              {i > 0 ? <Divider /> : null}
              <DarBlock target={t} />
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Infos transverses">
        {sheet.transverse.map((l, i) => (
          <View key={l.field} style={{ gap: space.xs }}>
            {i > 0 ? <Divider /> : null}
            <View style={styles.sectionRow}>
              <Text variant="label" tone="muted" style={styles.sectionTitle}>
                {l.label}
              </Text>
              <Text style={{ flex: 1 }} tone={l.status === 'non-renseigne' ? 'question' : 'ink'}>
                {l.summary}
              </Text>
            </View>
          </View>
        ))}
      </Section>

      <Section title="Potentiellement à faire">
        {sheet.todos.length === 0 ? (
          <Text tone="muted">Rien de dicté à faire pour la suite.</Text>
        ) : (
          sheet.todos.map((t) => <SourcedLine key={t.id} item={t} />)
        )}
      </Section>
    </Stack>
  );
}

const styles = StyleSheet.create({
  flag: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  sectionRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', flexWrap: 'wrap' },
  sectionTitle: { width: 128, paddingTop: 3 },
});
