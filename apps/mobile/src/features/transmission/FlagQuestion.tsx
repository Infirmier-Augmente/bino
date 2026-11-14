import type { Flag } from '@infirmier/domain';
import { CircleHelp } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextField } from '@/ui/layout';
import { Button, Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { radius, space } from '@/ui/theme';

/**
 * Une question posée à l'IDE (jamais un verdict). Elle peut répondre
 * (la réponse devient un élément sourcé "saisi par l'IDE") ou l'écarter.
 */
export function FlagQuestion({
  flag,
  onAnswer,
  onDismiss,
  busy,
}: {
  flag: Flag;
  onAnswer?: (answer: string) => void;
  onDismiss?: () => void;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  const [answer, setAnswer] = useState('');
  const answerable = flag.kind !== 'patient-ambiguous' && flag.kind !== 'multiple-patients';
  return (
    <View
      style={[styles.box, { backgroundColor: colors.questionSoft }]}
      testID={`question-${flag.kind}`}
    >
      <View style={styles.head}>
        <CircleHelp size={20} color={colors.question} />
        <Text variant="bodyStrong" tone="question" style={{ flex: 1 }}>
          {flag.question}
        </Text>
      </View>
      {answerable && onAnswer ? (
        <TextField
          value={answer}
          onChangeText={setAnswer}
          placeholder={
            flag.kind === 'missing-result'
              ? 'Ta réévaluation (ex. bien toléré, pas de récidive)'
              : 'Ta réponse'
          }
          accessibilityLabel={`Réponse : ${flag.question}`}
          returnKeyType="done"
          onSubmitEditing={() => answer.trim() && onAnswer(answer.trim())}
        />
      ) : null}
      <View style={styles.actions}>
        {onDismiss ? (
          <Button label="Ignorer" kind="ghost" onPress={onDismiss} disabled={busy} />
        ) : null}
        {answerable && onAnswer ? (
          <Button
            label="Répondre"
            kind="secondary"
            onPress={() => onAnswer(answer.trim())}
            disabled={!answer.trim() || busy}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
});
