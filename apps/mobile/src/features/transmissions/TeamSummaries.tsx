import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/features/api/client';
import { useSetPriority, useUnitSummaries } from '@/features/api/hooks';
import { useSession } from '@/features/session/store';
import { levelOfNumber } from '@/lib/priority';
import { SUMMARY_SORT_LABELS, type SummarySort, sortDigests } from '@/lib/sort';
import { SortMenu } from '@/ui/controls';
import { Spinner, Text } from '@/ui/primitives';
import { Card } from '@/ui/surfaces';
import { space } from '@/ui/theme';
import { useToast } from '@/ui/toast';
import { SummaryCard } from './SummaryCard';

const SORT_OPTIONS = (Object.keys(SUMMARY_SORT_LABELS) as SummarySort[]).map((value) => ({
  value,
  label: SUMMARY_SORT_LABELS[value],
}));

/** « Tous » : une carte par patient, comptes rendus de toute l'équipe, priorité modifiable. */
export function TeamSummaries({ unitId }: { unitId: string }) {
  const summaries = useUnitSummaries(unitId);
  const setPriority = useSetPriority(unitId);
  const sort = useSession((s) => s.summarySort);
  const setSort = useSession((s) => s.setSummarySort);
  const toast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = sortDigests(summaries.data?.rows ?? [], sort);

  return (
    <View>
      <View style={styles.head}>
        <SortMenu
          value={sort}
          options={SORT_OPTIONS}
          onChange={setSort}
          align="left"
          testID="tri-tous"
        />
      </View>
      {summaries.isPending ? (
        <View style={styles.state}>
          <Spinner />
        </View>
      ) : summaries.isError ? (
        <Card>
          <Text tone="sec">{errorMessage(summaries.error)}</Text>
        </Card>
      ) : (
        rows.map((d) => (
          <SummaryCard
            key={d.patient.id}
            digest={d}
            open={openId === d.patient.id}
            onToggle={() => setOpenId((id) => (id === d.patient.id ? null : d.patient.id))}
            onPick={(n) => {
              setOpenId(null);
              setPriority.mutate(
                { patientId: d.patient.id, level: levelOfNumber(n) },
                {
                  onSuccess: () => toast.show(`Priorité ${n} enregistrée.`),
                  onError: () => toast.show('Modification impossible pour le moment.'),
                },
              );
            }}
          />
        ))
      )}
      <Text variant="foot" tone="sec" style={styles.foot}>
        Puces de la plus récente à la plus ancienne ; chacune vient d’un compte rendu (auteur et
        heure dessous). À relire avant la relève.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { minHeight: 32, flexDirection: 'row', marginBottom: 10 },
  state: { alignItems: 'center', paddingVertical: space[8] },
  foot: { textAlign: 'center', marginTop: space[1] },
});
