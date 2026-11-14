import type { SampleDictation } from '@infirmier/domain';
import { Mic, Play, Square } from 'lucide-react-native';
import { type ComponentRef, type Ref, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text, TextButton } from '@/ui/primitives';
import { Chip } from '@/ui/surfaces';
import { colors, space, type } from '@/ui/theme';
import { EMPTY_DRAFT, useDrafts } from './drafts';
import type { useReportDictation } from './useReportDictation';

/**
 * Zone du compte rendu : grande zone de texte, transcription partielle, micro 72 px et
 * exemple de dictée. Le texte vit dans le brouillon du patient (gardé à la fermeture).
 */
export function ReportComposer({
  patientId,
  inputRef,
  dictation,
  sample,
  minHeight,
}: {
  patientId: string;
  inputRef: Ref<ComponentRef<typeof TextInput>>;
  dictation: ReturnType<typeof useReportDictation>;
  sample: SampleDictation | null;
  minHeight: number;
}) {
  const draft = useDrafts((s) => s.drafts[patientId]) ?? EMPTY_DRAFT;
  const update = useDrafts((s) => s.update);
  const [focused, setFocused] = useState(false);
  const live = dictation.interim || (dictation.transcribing ? 'Transcription en cours…' : '');

  return (
    <View style={styles.zone}>
      <TextInput
        ref={inputRef}
        multiline
        value={draft.text}
        onChangeText={(text) => update(patientId, text, 'typed')}
        placeholder="Ce que tu as vu et fait, comme à la relève."
        placeholderTextColor={colors.sec}
        accessibilityLabel="Compte rendu"
        textAlignVertical="top"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        testID="cr-texte"
        style={[type.composer, styles.input, { minHeight }, focused && styles.focused]}
      />
      <Text variant="sub" tone="sec" style={styles.live} accessibilityLiveRegion="polite">
        {live}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          dictation.transcribing
            ? 'Transcription en cours'
            : dictation.listening
              ? 'Arrêter la dictée'
              : 'Dicter le compte rendu'
        }
        accessibilityState={{ busy: dictation.transcribing }}
        disabled={dictation.transcribing}
        onPress={() => void dictation.toggle()}
        testID="micro"
        style={({ pressed }) => [styles.mic, (dictation.listening || pressed) && styles.micActive]}
      >
        {dictation.transcribing ? (
          <ActivityIndicator color={colors.white} />
        ) : dictation.listening ? (
          <Square size={28} color={colors.white} strokeWidth={2} />
        ) : (
          <Mic size={28} color={colors.white} strokeWidth={2} />
        )}
      </Pressable>
      {dictation.canRetry ? (
        <TextButton label="Réessayer l’envoi de la dictée" onPress={() => void dictation.retry()} />
      ) : null}
      {sample ? (
        <Chip
          icon={Play}
          label={`Exemple : ${sample.label}`}
          onPress={() => update(patientId, sample.text, 'sample')}
          testID="exemple"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space[3],
    paddingBottom: space[4],
  },
  input: {
    alignSelf: 'stretch',
    padding: space[4],
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.fieldBorder,
    color: colors.navy,
    backgroundColor: colors.white,
  },
  focused: {
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: colors.focus,
    outlineOffset: 1,
  },
  live: { alignSelf: 'stretch', minHeight: 20, fontStyle: 'italic' },
  mic: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Halo fixe, sans pulsation : on n'anime que l'activité réelle (le bouton change d'icône).
  micActive: {
    backgroundColor: colors.magentaPress,
    boxShadow: '0 0 0 6px rgba(255,0,102,0.1)',
  },
});
