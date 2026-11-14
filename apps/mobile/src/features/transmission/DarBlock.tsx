import type { DarTarget, SourcedItem } from '@infirmier/domain';
import { APPAREIL_LABELS } from '@infirmier/domain';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { radius, space, type } from '@/ui/theme';
import { SourcedLine } from './SourcedLine';

const ROWS = [
  { key: 'data', letter: 'D', label: 'Données' },
  { key: 'actions', letter: 'A', label: 'Actions' },
  { key: 'results', letter: 'R', label: 'Résultats' },
] as const;

/** Une cible au format DAR. Un R vide est montré comme tel : jamais rempli à la place de l'IDE. */
export function DarBlock({
  target,
  selectedId,
  onSelect,
  onEdit,
  onRemove,
}: {
  target: DarTarget;
  selectedId?: string | null;
  onSelect?: (item: SourcedItem | null) => void;
  onEdit?: (itemId: string, text: string) => void;
  onRemove?: (itemId: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.block} testID={`cible-${target.label}`}>
      <View style={styles.header}>
        <Text variant="heading">{target.label}</Text>
        <Text variant="caption" tone="subtle">
          {APPAREIL_LABELS[target.appareil]}
        </Text>
      </View>
      {ROWS.map((row) => {
        const items = target[row.key];
        return (
          <View key={row.key} style={styles.dar}>
            <View
              style={[styles.letter, { backgroundColor: colors.surfaceMuted }]}
              accessibilityLabel={row.label}
            >
              <Text style={[type.mono, { fontFamily: type.monoLarge.fontFamily }]}>
                {row.letter}
              </Text>
            </View>
            <View style={styles.items}>
              {items.length === 0 ? (
                <Text tone="question" style={{ paddingVertical: space.xs }}>
                  {row.key === 'results' ? 'Non renseigné : à préciser' : 'Rien de dicté'}
                </Text>
              ) : (
                items.map((item) => (
                  <SourcedLine
                    key={item.id}
                    item={item}
                    selected={onSelect ? selectedId === item.id : undefined}
                    onSelect={onSelect}
                    onEdit={onEdit ? (text) => onEdit(item.id, text) : undefined}
                    onRemove={onRemove ? () => onRemove(item.id) : undefined}
                  />
                ))
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  dar: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  letter: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  items: { flex: 1, gap: 2 },
});
