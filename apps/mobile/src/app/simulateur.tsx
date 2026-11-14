import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, StepForward } from 'lucide-react-native';
import { View } from 'react-native';
import { api, errorMessage } from '@/features/api/client';
import { useScenarios, useSimulationActions, useSimulationStatus } from '@/features/api/hooks';
import { useSession } from '@/features/session/store';
import { clock } from '@/lib/format';
import { isSessionStillValid } from '@/lib/session';
import { Button, Text } from '@/ui/primitives';
import { Card } from '@/ui/surfaces';
import { space } from '@/ui/theme';
import { useToast } from '@/ui/toast';
import { UtilityScreen } from '@/ui/UtilityScreen';

const TZ = 'Europe/Paris';

/**
 * SIMULATEUR (utilitaire, accessible seulement par l'URL /simulateur) : remettre la démo à
 * zéro, rejouer une journée, avancer d'un événement. Hôpital fictif, données 100 % inventées.
 */
export default function SimulateurScreen() {
  const scenarios = useScenarios();
  const status = useSimulationStatus();
  const sim = useSimulationActions();
  const toast = useToast();
  const qc = useQueryClient();
  const nurse = useSession((s) => s.nurse);
  const unit = useSession((s) => s.unit);
  const signOut = useSession((s) => s.signOut);
  const busy = sim.load.isPending || sim.step.isPending;
  const st = status.data;

  const replay = (scenarioId: string, until: 'start' | 'end') =>
    sim.load.mutate(
      { scenarioId, until },
      {
        onSuccess: async () => {
          // Le scénario remplace tout l'hôpital : si le soignant connecté n'existe plus dans son
          // service, on le déconnecte.
          const info = await api.session();
          if (nurse && unit && !isSessionStillValid({ nurseId: nurse.id, unitId: unit.id }, info)) {
            signOut();
            qc.clear();
          }
          toast.show(until === 'end' ? 'Journée rejouée.' : 'Journée remise au début.');
        },
        onError: (e) => toast.show(errorMessage(e)),
      },
    );

  return (
    <UtilityScreen title="Simulateur" subtitle="Hôpital fictif, données 100 % inventées">
      {st ? (
        <Card>
          <Text variant="bodyStrong">{st.title ?? 'Aucun scénario'}</Text>
          <Text variant="sub" tone="sec">
            Heure {st.clockMode === 'simulated' ? 'simulée' : 'réelle'} : {clock(st.now, TZ)} ·
            Événement {st.cursor} / {st.total}
          </Text>
          {st.nextEvent ? (
            <Text variant="sub" tone="sec">
              Prochain : {clock(st.nextEvent.at, TZ)} · {st.nextEvent.label}
            </Text>
          ) : null}
          <Button
            label="Événement suivant"
            kind="secondary"
            size="sm"
            icon={StepForward}
            disabled={!st.nextEvent || busy}
            onPress={() => sim.step.mutate(1, { onError: (e) => toast.show(errorMessage(e)) })}
            style={{ marginTop: space[3] }}
          />
        </Card>
      ) : null}
      {(scenarios.data ?? []).map((s) => (
        <Card key={s.id} testID={`scenario-${s.id}`}>
          <Text variant="bodyStrong">{s.title}</Text>
          <Text variant="sub" tone="sec">
            {s.description}
          </Text>
          <View style={{ gap: space[2], marginTop: space[3] }}>
            <Button
              label="Rejouer la journée"
              disabled={busy}
              loading={sim.load.isPending && sim.load.variables?.scenarioId === s.id}
              onPress={() => replay(s.id, 'end')}
            />
            <Button
              label="Partir du début"
              kind="secondary"
              icon={RotateCcw}
              disabled={busy}
              onPress={() => replay(s.id, 'start')}
            />
          </View>
        </Card>
      ))}
    </UtilityScreen>
  );
}
