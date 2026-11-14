import { memo, type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Platform, Text as RNText, StyleSheet, View } from 'react-native';
import { type LiveSegment, type LiveSegments, type TextToken, tokenize } from '@/lib/live-segments';
import { useReducedMotion } from '@/ui/a11y';
import { colors, type } from '@/ui/theme';

const NATIVE_DRIVER = Platform.OS !== 'web';
/** Seuls les derniers mots d'un segment provisoire sont animés (les autres : texte simple). */
const ANIMATED_TAIL = 6;
const APPEAR_MS = 180;
const SETTLE_MS = 600;
const RISE_PX = 4;
/** Largeur d'une espace dans la police du compte rendu (les mots sont des blocs séparés). */
const SPACE = 4.5;
const SKY_ON = 'rgba(91,184,240,0.25)';
const SKY_OFF = 'rgba(91,184,240,0)';

function Break({ blank }: { blank: boolean }) {
  return <View style={[styles.break, blank && styles.blank]} />;
}

/** Nouveau mot provisoire : apparaît en fondu en montant de 4 px (180 ms). */
function AppearingWord({ text, testID }: { text: string; testID?: string }) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: APPEAR_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [t]);
  const rise = t.interpolate({ inputRange: [0, 1], outputRange: [RISE_PX, 0] });
  return (
    <Animated.Text
      style={[styles.word, styles.provisional, { opacity: t, transform: [{ translateY: rise }] }]}
      testID={testID}
    >
      {text}
    </Animated.Text>
  );
}

function renderTokens(
  tokens: TextToken[],
  prefix: string,
  word: (text: string, key: string, n: number) => ReactNode,
) {
  return tokens.map((t, n) => {
    const key = `${prefix}${n}`;
    return t.kind === 'break' ? <Break key={key} blank={t.blank} /> : word(t.text, key, n);
  });
}

/**
 * Un segment de la dictée, mot par mot (les mots se placent dans le flux du texte). Provisoire :
 * gris italique, les nouveaux mots apparaissent. Définitif : texte normal, surligné en bleu ciel
 * qui s'efface (600 ms) : on voit la phrase « se poser ». Réduire les animations : rien ne bouge.
 */
const SegmentWords = memo(function SegmentWords({
  segment,
  reduceMotion,
}: {
  segment: LiveSegment;
  reduceMotion: boolean;
}) {
  const isFinal = segment.final !== null;
  const [glow] = useState(() => new Animated.Value(1));
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!isFinal || reduceMotion) return;
    // Couleur de fond : pas animable par le pilote natif.
    const anim = Animated.timing(glow, {
      toValue: 0,
      duration: SETTLE_MS,
      // Le surlignage tient puis s'efface (lisible), au lieu de disparaître d'emblée.
      easing: Easing.in(Easing.quad),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) setSettled(true);
    });
    return () => anim.stop();
  }, [isFinal, reduceMotion, glow]);

  const id = `segment-${segment.index}`;
  if (segment.final !== null) {
    const tokens = tokenize(segment.final);
    if (settled || reduceMotion) {
      return renderTokens(tokens, `${id}-f`, (text, key, n) => (
        <RNText key={key} style={styles.word} testID={n === 0 ? `${id}-definitif` : undefined}>
          {text}
        </RNText>
      ));
    }
    const backgroundColor = glow.interpolate({
      inputRange: [0, 1],
      outputRange: [SKY_OFF, SKY_ON],
    });
    return renderTokens(tokens, `${id}-f`, (text, key, n) => (
      <Animated.Text
        key={key}
        style={[styles.word, { backgroundColor }]}
        testID={n === 0 ? `${id}-definitif` : undefined}
      >
        {text}
      </Animated.Text>
    ));
  }

  const tokens = tokenize(segment.provisional);
  const animateFrom = reduceMotion ? tokens.length : tokens.length - ANIMATED_TAIL;
  return renderTokens(tokens, `${id}-p`, (text, key, n) =>
    n >= animateFrom ? (
      <AppearingWord key={key} text={text} testID={n === 0 ? `${id}-provisoire` : undefined} />
    ) : (
      <RNText
        key={key}
        style={[styles.word, styles.provisional]}
        testID={n === 0 ? `${id}-provisoire` : undefined}
      >
        {text}
      </RNText>
    ),
  );
});

/**
 * Texte pendant la dictée (lecture seule) : le brouillon, puis chaque segment dicté. Les mots
 * sont des blocs dans un flux qui passe à la ligne : un mot animé ne fait pas bouger les autres.
 */
export function LiveTranscript({
  draft,
  segments,
  label,
}: {
  draft: string;
  segments: LiveSegments;
  /** Texte complet lu par le lecteur d'écran (un seul élément, pas mot par mot). */
  label: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.flow} accessible accessibilityLabel={label}>
      {renderTokens(tokenize(draft), 'brouillon-', (text, key) => (
        <RNText key={key} style={styles.word}>
          {text}
        </RNText>
      ))}
      {segments.map((s) => (
        <SegmentWords key={s.index} segment={s} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  word: { ...type.composer, color: colors.navy, paddingRight: SPACE },
  provisional: { color: colors.sec, fontStyle: 'italic' },
  break: { width: '100%', height: 0 },
  blank: { height: type.composer.lineHeight },
});
