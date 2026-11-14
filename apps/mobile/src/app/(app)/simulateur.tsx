import { FastForward, Play, RotateCcw, StepForward } from 'lucide-react-native';
import { View } from 'react-native';
import { api, errorMessage } from '@/features/api/client';
import { useScenarios, useSimulationActions, useSimulationStatus } from '@/features/api/hooks';
import { useSession } from '@/features/session/store';
import { clock } from '@/lib/format';
import { Screen } from '@/ui/layout';
import { Badge, Banner, Button, Divider, Section, Stack, Text } from '@/ui/primitives';
import { space } from '@/ui/theme';
import { useToast } from '@/ui/toast';

/**
 * SIMULATEUR — l'hôpital fictif. Charger une journée, la rejouer pas à pas
 * ou d'un coup, régler l'horloge (ex. juste avant la relève de 19h45).
 */
export default function SimulateurScreen() {
  const scenarios = useScenarios();
  const status = useSimulationStatus();
  const sim = useSimulationActions();
  const toast = useToast();
  const signIn = useSession((s) => s.signIn);
  const nurseId = useSession((s) => s.nurseId);
  const onError = (e: unknown) => toast.show(errorMessage(e), 'error');
  const st = status.data;
  const busy = sim.load.isPending || sim.step.isPending || sim.clock.isPending;
  const day = st?.now.slice(0, 10);

  return (
    <Screen title="Simulateur" subtitle="Hôpital fictif, données 100 % inventées">
      {st ? (
        <Section title="En cours">
          <Stack gap={space.sm}>
            <Text variant="heading">{st.title ?? 'Aucun scénario'}</Text>
            <Stack direction="row" gap={space.sm} wrap>
              <Badge
                label={`Heure ${st.clockMode === 'simulated' ? 'simulée' : 'réelle'} : ${clock(st.now)}`}
                tone="accent"
              />
              <Badge label={`Événement ${st.cursor} / ${st.total}`} />
            </Stack>
            {st.nextEvent ? (
              <Text tone="muted">
                Prochain : {clock(st.nextEvent.at)} · {st.nextEvent.label}
              </Text>
            ) : st.total > 0 ? (
              <Text tone="muted">Scénario terminé.</Text>
            ) : null}
          </Stack>
          <Stack direction="row" gap={space.sm} wrap>
            <Button
              label="Événement suivant"
              icon={StepForward}
              disabled={!st.nextEvent || busy}
              loading={sim.step.isPending}
              onPress={() => sim.step.mutate(1, { onError })}
            />
            <Button
              label="Tout jouer"
              kind="secondary"
              icon={FastForward}
              disabled={!st.nextEvent || busy}
              onPress={() => sim.step.mutate(100, { onError })}
            />
          </Stack>
          <Divider />
          <Text variant="label" tone="muted">
            Horloge
          </Text>
          <Stack direction="row" gap={space.sm} wrap>
            {day
              ? (['08:00', '16:25', '19:40'] as const).map((h) => (
                  <Button
                    key={h}
                    label={h === '19:40' ? '19h40 (avant la relève)' : h.replace(':', 'h')}
                    kind="secondary"
                    disabled={busy}
                    onPress={() =>
                      sim.clock.mutate(
                        { mode: 'simulated', now: `${day}T${h}:00+01:00` },
                        { onError },
                      )
                    }
                  />
                ))
              : null}
            <Button
              label="Heure réelle"
              kind="ghost"
              disabled={busy}
              onPress={() => sim.clock.mutate({ mode: 'real' }, { onError })}
            />
          </Stack>
        </Section>
      ) : null}

      {st && st.log.length > 0 ? (
        <Section title="Journal">
          {[...st.log]
            .reverse()
            .slice(0, 12)
            .map((l) => (
              <Text key={`${l.at}-${l.label}`} tone="muted">
                {clock(l.at)} · {l.label}
              </Text>
            ))}
        </Section>
      ) : null}

      <Section title="Scénarios" flush>
        {(scenarios.data ?? []).map((s, i) => (
          <View key={s.id} style={{ padding: space.lg, gap: space.sm }}>
            {i > 0 ? <Divider /> : null}
            <Text variant="heading">{s.title}</Text>
            <Text tone="muted">{s.description}</Text>
            <Stack direction="row" gap={space.xs} wrap>
              {s.tags.map((t) => (
                <Badge key={t} label={t} />
              ))}
              <Badge label={`${s.eventCount} événements`} />
            </Stack>
            <Stack direction="row" gap={space.sm} wrap>
              <Button
                label="Rejouer la journée"
                icon={Play}
                disabled={busy}
                loading={
                  sim.load.isPending &&
                  sim.load.variables?.scenarioId === s.id &&
                  sim.load.variables.until === 'end'
                }
                onPress={() =>
                  sim.load.mutate(
                    { scenarioId: s.id, until: 'end' },
                    {
                      onSuccess: async () => {
                        // Le scénario remplace tout l'hôpital : on garde le soignant s'il existe, sinon le premier du service.
                        const info = await api.session();
                        const nurse =
                          info.nurses.find((n) => n.id === nurseId && n.unitId === s.unitId) ??
                          info.nurses.find((n) => n.unitId === s.unitId);
                        if (nurse) signIn(nurse.unitId, nurse.id);
                        toast.show('Journée rejouée : ouvre la Relève', 'success');
                      },
                      onError,
                    },
                  )
                }
              />
              {s.id === 'rea-box12' ? (
                <Button
                  label="Préparer la démo (16h25)"
                  kind="secondary"
                  disabled={busy}
                  onPress={() =>
                    sim.load.mutate(
                      { scenarioId: s.id, until: `${s.startsAt.slice(0, 10)}T16:25:00+01:00` },
                      {
                        onSuccess: () => toast.show('Prêt : dicte l’exemple A (Box 12)', 'success'),
                        onError,
                      },
                    )
                  }
                />
              ) : null}
              <Button
                label="Partir du début"
                kind="secondary"
                icon={RotateCcw}
                disabled={busy}
                onPress={() => sim.load.mutate({ scenarioId: s.id, until: 'start' }, { onError })}
              />
            </Stack>
          </View>
        ))}
      </Section>
      {sim.load.isPending ? (
        <Banner tone="info" title="Rejeu en cours">
          <Text>
            Chaque dictée passe par la vraie chaîne (patient, DAR, sources). Avec un LLM, compte ~2
            s par dictée.
          </Text>
        </Banner>
      ) : null}
    </Screen>
  );
}
