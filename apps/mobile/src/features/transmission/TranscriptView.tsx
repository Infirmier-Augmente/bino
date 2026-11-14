import { Text as RNText } from 'react-native';
import { highlightSegments } from '@/lib/highlight';
import { useTheme } from '@/ui/ThemeProvider';
import { type } from '@/ui/theme';

/** La dictée d'origine, extraits cités soulignés, extrait sélectionné surligné. */
export function TranscriptView({
  text,
  ranges,
  active,
}: {
  text: string;
  ranges: readonly { start: number; end: number }[];
  active: { start: number; end: number } | null;
}) {
  const { colors } = useTheme();
  const segments = highlightSegments(text, ranges, active);
  return (
    <RNText style={[type.body, { color: colors.inkMuted }]} testID="transcript">
      {segments.map((s, i) => (
        <RNText
          // biome-ignore lint/suspicious/noArrayIndexKey: segments ordonnés et stables pour un même texte
          key={i}
          style={
            s.mark === 'active'
              ? { backgroundColor: colors.highlight, color: colors.ink }
              : s.mark === 'source'
                ? {
                    color: colors.ink,
                    textDecorationLine: 'underline',
                    textDecorationColor: colors.borderStrong,
                  }
                : undefined
          }
        >
          {s.text}
        </RNText>
      ))}
    </RNText>
  );
}
