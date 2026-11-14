import type { TransmissionMode } from '@infirmier/domain';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Keyboard, Mic, Send, Square, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '@/features/api/client';
import { useBoard, useConfig, useCreateTransmission, useSamples } from '@/features/api/hooks';
import { useServerDictation } from '@/features/dictation/useServerDictation';
import { useWebSpeech, webSpeechSupported } from '@/features/dictation/useWebSpeech';
import { useRequiredSession, useSession } from '@/features/session/store';
import { chooseDictationEngine } from '@/lib/dictation-engine';
import { duration } from '@/lib/format';
import { Segmented } from '@/ui/controls';
import { Banner, Button, IconButton, Stack, Text } from '@/ui/primitives';
import { useTheme } from '@/ui/ThemeProvider';
import { CONTENT_MAX_WIDTH, radius, space, type } from '@/ui/theme';

const haptic = () => {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

/**
 * DICTÉE — un bouton, on parle, le texte s'affiche, on envoie.
 * Trois moteurs (choix : `chooseDictationEngine`) : enregistrement + transcription serveur
 * en priorité, sinon reconnaissance du navigateur (texte en direct), sinon clavier.
 */
export default function DicteeScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ patientId?: string; mode?: TransmissionMode }>();
  const { unitId, nurseId } = useRequiredSession();
  const demoMode = useSession((s) => s.demoMode);
  const config = useConfig();
  const board = useBoard(unitId);
  const create = useCreateTransmission();
  const web = useWebSpeech();
  const server = useServerDictation();
  const samples = useSamples(unitId, demoMode);

  const [mode, setMode] = useState<TransmissionMode>(params.mode ?? 'transmission');
  const [patientId, setPatientId] = useState<string | null>(params.patientId ?? null);
  const [text, setText] = useState('');
  const [inputMethod, setInputMethod] = useState<
    'voice-device' | 'voice-server' | 'keyboard' | 'simulation'
  >('keyboard');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [showSamples, setShowSamples] = useState(false);
  const typing = useRef<ReturnType<typeof setInterval> | null>(null);
  const [typingSample, setTypingSample] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const engine = chooseDictationEngine({
    serverSttReady: config.data?.stt.ready === true,
    webSpeechAvailable: webSpeechSupported(),
  });
  const listening = web.listening || server.recording;
  const patient = board.data?.rows.find((r) => r.patient.id === patientId)?.patient;

  // Le texte reconnu en direct remplit la zone de saisie.
  useEffect(() => {
    if (web.listening) setText(web.text);
  }, [web.listening, web.text]);

  useEffect(
    () => () => {
      if (typing.current) clearInterval(typing.current);
    },
    [],
  );

  // Minuteur visible pendant l'enregistrement (activité réelle).
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [listening]);

  const start = async () => {
    haptic();
    if (engine === 'web-speech') {
      web.start(text);
      setInputMethod('voice-device');
      setStartedAt(Date.now());
    } else if (engine === 'server') {
      if (await server.start()) {
        setInputMethod('voice-server');
        setStartedAt(Date.now());
      }
    } else {
      inputRef.current?.focus();
    }
  };

  const stop = async () => {
    haptic();
    if (engine === 'web-speech') web.stop();
    else if (engine === 'server') {
      const r = await server.stop();
      if (r) setText((t) => `${t ? `${t} ` : ''}${r.text}`.trim());
    }
  };

  /** Démo sans micro : la dictée d'exemple s'écrit comme si on parlait. */
  const playSample = (sample: string) => {
    if (typing.current) clearInterval(typing.current);
    setShowSamples(false);
    setInputMethod('simulation');
    setTypingSample(true);
    const words = sample.split(' ');
    let i = 0;
    setText('');
    typing.current = setInterval(() => {
      i += 2;
      setText(words.slice(0, i).join(' '));
      if (i >= words.length && typing.current) {
        clearInterval(typing.current);
        typing.current = null;
        setTypingSample(false);
      }
    }, 90);
  };

  const send = () => {
    // Pas d'envoi pendant l'écoute, pendant la saisie d'un exemple, ni en double.
    if (listening || typingSample || create.isPending) return;
    create.mutate(
      {
        unitId,
        nurseId,
        transcript: text.trim(),
        mode,
        inputMethod,
        patientId,
        durationSec: startedAt ? Math.round((Date.now() - startedAt) / 1000) : null,
      },
      { onSuccess: (t) => router.replace(`/transmission/${t.id}`) },
    );
  };

  const engineLabel =
    engine === 'web-speech'
      ? 'Reconnaissance vocale du navigateur : le texte s’affiche pendant que tu parles.'
      : engine === 'server'
        ? `Transcription par le serveur (${config.data?.stt.provider}) : le texte s’affiche quand tu termines.`
        : 'Pas de transcription automatique ici : utilise le micro de ton clavier ou écris.';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <IconButton
          icon={X}
          label="Fermer"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/patients'))}
        />
        <Text variant="title" style={{ flex: 1 }}>
          {mode === 'admission' ? 'Dictée d’entrée' : 'Dictée'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          {!params.mode ? (
            <Segmented
              accessibilityLabel="Type de dictée"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'transmission', label: 'Transmission' },
                { value: 'admission', label: 'Entrée (admission)' },
              ]}
            />
          ) : null}

          {patient ? (
            <Stack direction="row" align="center" gap={space.sm}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                Pour {patient.roomLabel} · {patient.displayName}
              </Text>
              {!params.patientId ? (
                <Button label="Changer" kind="ghost" onPress={() => setPatientId(null)} />
              ) : null}
            </Stack>
          ) : (
            <Text tone="muted">Commence par le box ou le nom : « Box 12, monsieur Durand… »</Text>
          )}

          <View
            style={[
              styles.textBox,
              {
                backgroundColor: colors.surface,
                borderColor: listening ? colors.record : colors.border,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (inputMethod === 'simulation') setInputMethod('keyboard');
              }}
              editable={!listening}
              multiline
              placeholder={
                listening
                  ? 'Je t’écoute…'
                  : 'Ta dictée apparaîtra ici. Tu peux la corriger avant d’envoyer.'
              }
              placeholderTextColor={colors.inkSubtle}
              accessibilityLabel="Texte de la dictée"
              testID="dictee-texte"
              style={[type.body, styles.input, { color: colors.ink, fontSize: 19, lineHeight: 28 }]}
            />
            {web.interim ? (
              <Text tone="subtle" style={{ fontStyle: 'italic' }}>
                {web.interim}
              </Text>
            ) : null}
          </View>

          <Text variant="caption" tone="subtle">
            {engineLabel}
          </Text>

          {web.error || server.error ? (
            <Banner
              tone="error"
              title="Micro"
              action={
                server.canRetry ? (
                  <Button
                    label="Réessayer l’envoi"
                    kind="secondary"
                    loading={server.transcribing}
                    onPress={() =>
                      void server.retry().then((r) => {
                        if (r) setText((t) => `${t ? `${t} ` : ''}${r.text}`.trim());
                      })
                    }
                  />
                ) : undefined
              }
            >
              <Text tone="record">{web.error ?? server.error}</Text>
            </Banner>
          ) : null}
          {create.error ? (
            <Banner tone="error" title="Envoi impossible">
              <Text tone="record">{errorMessage(create.error)}</Text>
            </Banner>
          ) : null}

          {demoMode && samples.data && samples.data.length > 0 ? (
            <View style={{ gap: space.sm }}>
              <Button
                label={showSamples ? 'Masquer les exemples' : 'Exemples de dictée (démo)'}
                kind="ghost"
                onPress={() => setShowSamples((v) => !v)}
                testID="exemples"
              />
              {showSamples
                ? samples.data.map((s) => (
                    <Pressable
                      key={s.id}
                      accessibilityRole="button"
                      onPress={() => playSample(s.text)}
                      style={({ pressed }) => [
                        styles.sample,
                        {
                          borderColor: colors.border,
                          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                        },
                      ]}
                    >
                      <Text variant="bodyStrong">{s.label}</Text>
                      <Text variant="caption" tone="muted" numberOfLines={2}>
                        {s.text}
                      </Text>
                    </Pressable>
                  ))
                : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.footerInner}>
          {create.isPending ? (
            <View style={{ flex: 1, gap: space.xs }}>
              <Button label="Structuration en cours…" loading size="lg" block />
              <Text variant="caption" tone="subtle" style={{ textAlign: 'center' }}>
                Patient, transmissions DAR, vérification que chaque phrase vient de ta dictée.
              </Text>
            </View>
          ) : listening ? (
            <Button
              label={`Terminer · ${duration(server.recording ? server.durationMs : startedAt ? Date.now() - startedAt : 0)}`}
              kind="record"
              icon={Square}
              size="lg"
              block
              style={{ flex: 1 }}
              onPress={() => void stop()}
              testID="terminer"
            />
          ) : (
            <>
              <Button
                label={engine === 'keyboard' ? 'Clavier' : text ? 'Reprendre' : 'Dicter'}
                kind={text ? 'secondary' : 'primary'}
                icon={engine === 'keyboard' ? Keyboard : Mic}
                size="lg"
                style={text ? undefined : { flex: 1 }}
                loading={server.transcribing}
                onPress={() => void start()}
                testID="micro"
              />
              {text ? (
                <Button
                  label="Envoyer"
                  icon={Send}
                  size="lg"
                  style={{ flex: 1 }}
                  disabled={text.trim().length < 3 || typingSample}
                  onPress={send}
                  testID="envoyer"
                />
              ) : null}
            </>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  scroll: { paddingBottom: space.xxl },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    gap: space.lg,
  },
  textBox: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    padding: space.lg,
    minHeight: 220,
    gap: space.sm,
  },
  input: { minHeight: 180, textAlignVertical: 'top' },
  sample: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: space.md,
    gap: 2,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  footerInner: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
