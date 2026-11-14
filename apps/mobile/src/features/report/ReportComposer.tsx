import type { SampleDictation } from '@infirmier/domain';
import { Play } from 'lucide-react-native';
import { type ComponentRef, type Ref, useState } from 'react';
import { Text as RNText, StyleSheet, TextInput, View } from 'react-native';
import { liveDisplayText } from '@/lib/live-segments';
import { appendDictation } from '@/lib/report';
import { TextButton } from '@/ui/primitives';
import { Chip } from '@/ui/surfaces';
import { colors, space, type } from '@/ui/theme';
import { DictationStatusLine } from './DictationStatusLine';
import { EMPTY_DRAFT, useDrafts } from './drafts';
import { LiveTranscript } from './LiveTranscript';
import { MicButton } from './MicButton';
import type { ReportDictation } from './useReportDictation';

/**
 * Zone du compte rendu : grande zone de texte, micro 72 px et exemple de dictée. Pendant la
 * dictée, le texte n'est pas modifiable : le brouillon s'affiche, suivi de la dictée segment
 * par segment (`LiveTranscript` : provisoire gris italique, puis définitif) ; à l'arrêt, le
 * texte définitif est ajouté au brouillon et redevient modifiable. Le texte vit dans le brouillon du patient (gardé à la fermeture).
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
  dictation: ReportDictation;
  sample: SampleDictation | null;
  minHeight: number;
}) {
  const draft = useDrafts((s) => s.drafts[patientId]) ?? EMPTY_DRAFT;
  const update = useDrafts((s) => s.update);
  const [focused, setFocused] = useState(false);
  const { status, segments } = dictation;
  const dictating = status === 'recording' || status === 'finalizing';
  const spoken = liveDisplayText(segments);

  return (
    <View style={styles.zone}>
      {dictating ? (
        <View style={[styles.input, styles.preview, { minHeight }]} testID="cr-apercu">
          {draft.text || spoken ? (
            <LiveTranscript
              draft={draft.text}
              segments={segments}
              label={`Compte rendu en cours de dictée : ${appendDictation(draft.text, spoken)}`}
            />
          ) : status === 'recording' ? (
            <RNText style={[type.composer, styles.hint]}>
              {dictation.textWhileSpeaking
                ? 'Parle : le texte s’affiche au fil de la dictée.'
                : 'Parle : le texte s’affichera à l’arrêt.'}
            </RNText>
          ) : null}
        </View>
      ) : (
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
      )}
      <DictationStatusLine status={status} startedAt={dictation.startedAt} />
      <MicButton status={status} level={dictation.level} onPress={() => void dictation.toggle()} />
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
  // Même boîte que la zone de texte, bordure magenta : on voit que la dictée est en cours.
  preview: { borderColor: colors.magenta },
  hint: { color: colors.sec },
  focused: {
    outlineWidth: 3,
    outlineStyle: 'solid',
    outlineColor: colors.focus,
    outlineOffset: 1,
  },
});
