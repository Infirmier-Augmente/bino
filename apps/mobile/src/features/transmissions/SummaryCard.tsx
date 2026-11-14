import type { PatientDigest } from '@infirmier/domain';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text as RNText, StyleSheet, View } from 'react-native';
import { patientFullName } from '@/lib/format';
import {
  PRIORITY_NUMBERS,
  type PriorityNumber,
  priorityButtonLabel,
  priorityNumber,
  priorityReason,
} from '@/lib/priority';
import { bulletText, contributorsLine, moreBulletsLabel, splitBullets } from '@/lib/report';
import { pressedA11y } from '@/ui/a11y';
import { Text } from '@/ui/primitives';
import { Card, RoomChip } from '@/ui/surfaces';
import { colors, PRIORITY_COLORS, space, type } from '@/ui/theme';

/**
 * Carte d'un patient dans « Tous » : barre et pastille de priorité (« Priorité n », raison lue
 * par le lecteur d'écran), puces sourcées par thème avec auteurs et heures dessous.
 */
export function SummaryCard({
  digest,
  open,
  onToggle,
  onPick,
}: {
  digest: PatientDigest;
  open: boolean;
  onToggle: () => void;
  onPick: (n: PriorityNumber) => void;
}) {
  const { patient, priority } = digest;
  const name = patientFullName(patient);
  const n = priorityNumber(priority.level);
  const c = PRIORITY_COLORS[n];
  const reason = priorityReason(priority, digest.news2);
  const [allBullets, setAllBullets] = useState(false);
  const { shown, hidden } = splitBullets(digest.bullets, allBullets);

  return (
    <Card bar={c.fill} style={styles.card} testID={`resume-${patient.room}`}>
      <View style={styles.head}>
        <View style={styles.who}>
          <Text variant="bodyStrong">{name}</Text>
          <RoomChip room={patient.room} small />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={priorityButtonLabel(name, n, reason)}
          accessibilityState={{ expanded: open }}
          onPress={onToggle}
          hitSlop={6}
          testID={`priorite-${patient.room}`}
          style={[styles.lvl, { backgroundColor: c.fill }]}
        >
          <Text variant="tiny" style={{ color: c.text }}>
            Priorité {n}
          </Text>
          <ChevronDown
            size={14}
            color={c.text}
            strokeWidth={2}
            style={open ? styles.flipped : undefined}
          />
        </Pressable>
      </View>

      {open ? (
        <View style={styles.lvlRow} role="group" accessibilityLabel={`Priorité de ${name}`}>
          {PRIORITY_NUMBERS.map((k) => {
            const kc = PRIORITY_COLORS[k];
            const on = k === n;
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={`Priorité ${k}`}
                {...pressedA11y(on)}
                onPress={() => onPick(k)}
                hitSlop={7}
                testID={`priorite-${patient.room}-${k}`}
                style={[
                  styles.circle,
                  {
                    borderColor: on ? kc.fill : kc.ink,
                    backgroundColor: on ? kc.fill : colors.white,
                  },
                ]}
              >
                <RNText style={[type.chip, { color: on ? kc.text : kc.ink }]}>{k}</RNText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {digest.reportCount === 0 || digest.bullets.length === 0 ? (
        <Text variant="small" tone="sec" style={styles.empty}>
          Aucun compte rendu aujourd’hui.
        </Text>
      ) : (
        <View style={styles.bullets}>
          {shown.map((b) => (
            <View key={b.id} style={styles.bullet}>
              <View style={styles.dot} />
              <View style={styles.bulletBody}>
                <Text variant="bullet">{bulletText(b)}</Text>
                <Text variant="source" tone="sec">
                  {contributorsLine(b)}
                </Text>
                {b.question ? (
                  <Text variant="source" tone="warn" style={styles.question}>
                    {b.question}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {hidden > 0 || allBullets ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAllBullets((v) => !v)}
              hitSlop={8}
              testID={`plus-de-puces-${patient.room}`}
              style={styles.more}
            >
              <Text variant="small" tone="magenta" style={styles.moreText}>
                {allBullets ? 'Afficher moins' : moreBulletsLabel(hidden)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 14, paddingRight: space[4], paddingBottom: space[3], paddingLeft: 18 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  who: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1, gap: 2 },
  lvl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
    paddingHorizontal: space[2],
    borderRadius: 999,
  },
  flipped: { transform: [{ rotate: '180deg' }] },
  lvlRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 6,
    marginBottom: 2,
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { marginTop: space[2] },
  bullets: { marginTop: space[2], gap: space[2] },
  bullet: { flexDirection: 'row', gap: 10 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.navy, marginTop: 8 },
  bulletBody: { flex: 1, gap: 2 },
  question: { fontStyle: 'italic' },
  more: { alignSelf: 'flex-start', paddingVertical: space[1], marginLeft: 15 },
  moreText: { fontWeight: '700' },
});
