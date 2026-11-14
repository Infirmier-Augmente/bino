import type { SourcedItem, SourceRef } from '@infirmier/domain';
import { Check, Pencil, Quote, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { clock } from '@/lib/format';
import { IconButton, Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { radius, space, type } from '@/ui/theme';

function sourceLabel(s: SourceRef): string {
  switch (s.kind) {
    case 'dictation':
      return `« ${s.quote} »`;
    case 'record':
      return s.label;
    case 'nurse':
      return `Saisi par l’IDE à ${clock(s.at)}`;
  }
}

/**
 * Une phrase structurée. Toucher = afficher sa source (règle produit :
 * chaque phrase renvoie à l'extrait de dictée d'origine).
 * En relecture : modifier ou retirer.
 */
export function SourcedLine({
  item,
  onSelect,
  selected,
  onEdit,
  onRemove,
  muted,
}: {
  item: SourcedItem;
  onSelect?: (item: SourcedItem | null) => void;
  selected?: boolean;
  onEdit?: (text: string) => void;
  onRemove?: () => void;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const expanded = selected ?? open;

  if (editing) {
    return (
      <View style={[styles.editRow, { borderColor: colors.accent }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          autoFocus
          accessibilityLabel="Modifier la phrase"
          style={[type.body, styles.editInput, { color: colors.ink }]}
        />
        <View style={styles.editActions}>
          {onRemove ? (
            <IconButton
              icon={Trash2}
              label="Retirer cet élément"
              tone="record"
              onPress={onRemove}
            />
          ) : null}
          <View style={{ flex: 1 }} />
          <IconButton
            icon={X}
            label="Annuler"
            onPress={() => {
              setDraft(item.text);
              setEditing(false);
            }}
          />
          <IconButton
            icon={Check}
            label="Enregistrer"
            tone="accent"
            onPress={() => {
              if (draft.trim() && draft.trim() !== item.text) onEdit?.(draft.trim());
              setEditing(false);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [
            styles.line,
            {
              backgroundColor: expanded
                ? colors.accentSoft
                : pressed
                  ? colors.surfacePressed
                  : 'transparent',
            },
          ]}
          accessibilityRole="button"
          accessibilityHint="Affiche la source"
          accessibilityState={{ expanded }}
          onPress={() => {
            if (onSelect) onSelect(expanded ? null : item);
            else setOpen((v) => !v);
          }}
        >
          <Text tone={muted ? 'muted' : 'ink'}>
            {item.text}
            {item.edited ? (
              <Text variant="caption" tone="subtle">
                {'  (modifié)'}
              </Text>
            ) : null}
          </Text>
        </Pressable>
        {onEdit ? (
          <IconButton
            icon={Pencil}
            label={`Modifier : ${item.text}`}
            tone="subtle"
            size={18}
            onPress={() => setEditing(true)}
          />
        ) : null}
      </View>
      {expanded ? (
        <View style={[styles.sources, { borderColor: colors.accent }]}>
          {item.sources.map((s) => (
            <View key={JSON.stringify(s)} style={styles.source}>
              <Quote size={14} color={colors.accent} />
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {sourceLabel(s)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  line: {
    flex: 1,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    marginHorizontal: -space.sm,
  },
  sources: {
    borderLeftWidth: 2,
    marginLeft: space.xs,
    paddingLeft: space.md,
    paddingVertical: space.xs,
    gap: space.xs,
    marginTop: space.xs,
  },
  source: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  editRow: { borderWidth: 1.5, borderRadius: radius.md, padding: space.sm, gap: space.xs },
  editInput: { minHeight: 44 },
  editActions: { flexDirection: 'row', alignItems: 'center' },
});
