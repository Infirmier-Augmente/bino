import type { EffectivePriority, PriorityLevel } from '@infirmier/domain';
import { PriorityLevel as Levels, PRIORITY_LABELS } from '@infirmier/domain';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/features/api/client';
import { usePriorityActions } from '@/features/api/hooks';
import { PriorityBadge, StarToggle } from '@/ui/controls';
import { Button, Divider, Stack, Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { radius, space } from '@/ui/theme';
import { useToast } from '@/ui/toast';

/**
 * Priorité d'un patient : la SUGGESTION est expliquée, l'IDE garde la main
 * (couleur manuelle, étoile ★ pour remonter en tête de relève).
 */
export function PriorityControl({
  patientId,
  priority,
}: {
  patientId: string;
  priority: EffectivePriority;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const mutate = usePriorityActions(patientId);
  const [open, setOpen] = useState(false);

  const set = (input: { starred?: boolean; manualLevel?: PriorityLevel | null }) =>
    mutate.mutate(input, { onError: (e) => toast.show(errorMessage(e), 'error') });

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Changer la priorité"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.badgeBtn, pressed && { opacity: 0.7 }]}
      >
        <PriorityBadge level={priority.level} origin={priority.origin} />
        <Text variant="caption" tone="subtle">
          {priority.origin === 'manuelle' ? 'choisie' : 'suggérée'}
        </Text>
      </Pressable>
      <StarToggle starred={priority.starred} onToggle={() => set({ starred: !priority.starred })} />

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Stack gap={space.lg}>
              <Text variant="title">Priorité</Text>
              <Stack gap={space.xs}>
                <Text variant="label" tone="muted">
                  Suggestion : {PRIORITY_LABELS[priority.suggestion.level]}
                </Text>
                {priority.suggestion.reasons.length === 0 ? (
                  <Text tone="muted">Aucun élément particulier sur ce poste.</Text>
                ) : (
                  priority.suggestion.reasons
                    .slice(0, 5)
                    .map((r) => <Text key={r.label}>· {r.label}</Text>)
                )}
              </Stack>
              <Divider />
              <Stack direction="row" gap={space.sm} wrap>
                {Levels.options.map((l) => (
                  <Pressable
                    key={l}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: priority.origin === 'manuelle' && priority.level === l,
                    }}
                    onPress={() => {
                      set({ manualLevel: l });
                      setOpen(false);
                    }}
                    style={[
                      styles.choice,
                      {
                        borderColor:
                          priority.origin === 'manuelle' && priority.level === l
                            ? colors.ink
                            : colors.border,
                      },
                    ]}
                  >
                    <PriorityBadge level={l} />
                  </Pressable>
                ))}
              </Stack>
              <Stack direction="row" gap={space.sm} justify="flex-end">
                {priority.origin === 'manuelle' ? (
                  <Button
                    label="Revenir à la suggestion"
                    kind="ghost"
                    onPress={() => {
                      set({ manualLevel: null });
                      setOpen(false);
                    }}
                  />
                ) : null}
                <Button label="Fermer" kind="secondary" onPress={() => setOpen(false)} />
              </Stack>
            </Stack>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  badgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.lg },
  sheet: { width: '100%', maxWidth: 440, borderRadius: radius.lg, padding: space.xl },
  choice: { borderWidth: 2, borderRadius: radius.md, padding: space.xs },
});
