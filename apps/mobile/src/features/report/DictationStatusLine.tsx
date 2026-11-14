import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatElapsed } from '@/lib/live-transcription';
import { Text } from '@/ui/primitives';
import { space } from '@/ui/theme';
import type { DictationStatus } from './useReportDictation';

const LABELS: Record<DictationStatus, string> = {
  idle: '',
  recording: 'Enregistrement',
  finalizing: 'Finalisation…',
  transcribing: 'Transcription en cours…',
};

/** Durée écoulée, mise à jour chaque seconde (seul ce texte se re-rend). */
function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text variant="sub" tone="sec" style={styles.time} testID="dictee-duree">
      {formatElapsed(now - startedAt)}
    </Text>
  );
}

/**
 * Ligne d'état sous le texte : « Enregistrement 0:07 », « Finalisation… ». Le lecteur
 * d'écran annonce les changements d'état, pas chaque seconde.
 */
export function DictationStatusLine({
  status,
  startedAt,
}: {
  status: DictationStatus;
  startedAt: number | null;
}) {
  return (
    <View style={styles.row}>
      <Text
        variant="sub"
        tone="sec"
        accessibilityLiveRegion="polite"
        role="status"
        testID="dictee-etat"
      >
        {LABELS[status]}
      </Text>
      {status === 'recording' && startedAt !== null ? <Elapsed startedAt={startedAt} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    minHeight: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space[2],
  },
  time: { fontVariant: ['tabular-nums'] },
});
