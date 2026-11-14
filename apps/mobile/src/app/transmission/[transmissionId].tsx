import type { SourcedItem } from '@infirmier/domain';
import { APPAREIL_LABELS, TRANSVERSE_LABELS } from '@infirmier/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Clock3, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { errorMessage } from '@/features/api/client';
import { useBoard, useTransmission, useTransmissionActions } from '@/features/api/hooks';
import { useRequiredSession } from '@/features/session/store';
import { DarBlock } from '@/features/transmission/DarBlock';
import { FlagQuestion } from '@/features/transmission/FlagQuestion';
import { SourcedLine } from '@/features/transmission/SourcedLine';
import { TranscriptView } from '@/features/transmission/TranscriptView';
import { clock } from '@/lib/format';
import { Screen } from '@/ui/layout';
import {
  Badge,
  Banner,
  Button,
  Divider,
  IconButton,
  Loading,
  Section,
  Stack,
  Text,
} from '@/ui/primitives';
import { space } from '@/ui/theme';
import { useToast } from '@/ui/toast';

/**
 * RELECTURE — l'IDE vérifie ce que l'IA a rangé, répond aux questions,
 * corrige si besoin, puis VALIDE en un geste (ou marque « non relue »).
 * Rien n'est versé au dossier sans elle.
 */
export default function TransmissionScreen() {
  const { transmissionId } = useLocalSearchParams<{ transmissionId: string }>();
  const { unitId } = useRequiredSession();
  const query = useTransmission(transmissionId);
  const board = useBoard(unitId);
  const actions = useTransmissionActions(transmissionId);
  const toast = useToast();
  const [selected, setSelected] = useState<SourcedItem | null>(null);

  const t = query.data;
  const ranges = useMemo(() => {
    if (!t) return [];
    const c = t.content;
    const items = [
      ...c.targets.flatMap((x) => [...x.data, ...x.actions, ...x.results]),
      ...c.observations,
      ...c.routine,
      ...c.todos,
      ...c.transverse,
      ...(c.admission ? Object.values(c.admission).flat() : []),
    ];
    return items.flatMap((i) =>
      i.sources.flatMap((s) => (s.kind === 'dictation' ? [{ start: s.start, end: s.end }] : [])),
    );
  }, [t]);

  if (query.isLoading)
    return (
      <Screen back>
        <Loading />
      </Screen>
    );
  if (!t) {
    return (
      <Screen back title="Transmission">
        <Banner tone="error" title="Introuvable">
          <Text tone="record">{errorMessage(query.error)}</Text>
        </Banner>
      </Screen>
    );
  }

  const editable = t.review.status !== 'validated';
  const patient = board.data?.rows.find((r) => r.patient.id === t.patientId)?.patient;
  const onError = (e: unknown) => toast.show(errorMessage(e), 'error');
  const edit = editable
    ? (itemId: string, text: string) =>
        actions.edit.mutate({ edits: [{ itemId, text }] }, { onError })
    : undefined;
  const remove = editable
    ? (itemId: string) => actions.edit.mutate({ removals: [itemId] }, { onError })
    : undefined;
  const activeSource = selected?.sources.find((s) => s.kind === 'dictation');
  const openFlags = t.flags.filter((f) => f.status === 'open');
  const c = t.content;
  const select = (item: SourcedItem | null) => setSelected(item);
  const line = (item: SourcedItem) => (
    <SourcedLine
      key={item.id}
      item={item}
      selected={selected?.id === item.id}
      onSelect={select}
      onEdit={edit ? (text) => edit(item.id, text) : undefined}
      onRemove={remove ? () => remove(item.id) : undefined}
    />
  );

  const done = (decision: 'validate' | 'defer') =>
    actions.review.mutate(decision, {
      onSuccess: () => {
        toast.show(
          decision === 'validate'
            ? `Validée${patient ? ` · ${patient.roomLabel}` : ''}`
            : 'Gardée « non relue »',
          'success',
        );
        if (router.canGoBack()) router.back();
        else router.replace('/patients');
      },
      onError,
    });

  return (
    <Screen
      back
      title={patient ? `${patient.roomLabel} · ${patient.displayName}` : 'Patient à préciser'}
      subtitle={`Dictée de ${clock(t.createdAt)}${t.mode === 'admission' ? ' · entrée' : ''}`}
      headerRight={
        editable ? (
          <IconButton
            icon={Trash2}
            label="Supprimer cette dictée"
            tone="subtle"
            onPress={() =>
              actions.remove.mutate(undefined, { onSuccess: () => router.back(), onError })
            }
          />
        ) : null
      }
      testID="relecture"
      footer={
        editable ? (
          <>
            <Button
              label="Plus tard"
              kind="secondary"
              icon={Clock3}
              size="lg"
              onPress={() => done('defer')}
              loading={actions.review.isPending && actions.review.variables === 'defer'}
              accessibilityHint="Garde la transmission, marquée non relue pour la relève"
              testID="plus-tard"
            />
            <Button
              label="Valider"
              icon={Check}
              size="lg"
              style={{ flex: 1 }}
              disabled={!t.patientId}
              onPress={() => done('validate')}
              loading={actions.review.isPending && actions.review.variables === 'validate'}
              testID="valider"
            />
          </>
        ) : undefined
      }
    >
      <Stack direction="row" gap={space.sm} wrap>
        <Badge
          tone={t.review.status === 'validated' ? 'success' : 'question'}
          label={
            t.review.status === 'validated'
              ? `Validée à ${t.review.at ? clock(t.review.at) : ''}`
              : t.review.status === 'unreviewed'
                ? 'Non relue'
                : 'À relire'
          }
        />
        <Badge
          label={
            t.engine.degraded
              ? 'Mode dégradé : moteur local'
              : `Rangé par ${t.engine.structuring.split(':').at(-1) ?? t.engine.structuring}`
          }
          tone={t.engine.degraded ? 'question' : 'neutral'}
        />
      </Stack>

      {t.engine.degraded ? (
        <Banner tone="question" title="Le service d’IA n’a pas répondu">
          <Text tone="question">
            Le rangement a été fait par le moteur local, plus simple. Relis avec attention.
          </Text>
        </Banner>
      ) : null}

      {!t.patientId ? (
        <Section title="De qui s’agit-il ?" testID="choix-patient">
          <Text tone="question">
            La dictée ne permet pas de savoir avec certitude. Choisis le patient :
          </Text>
          <Stack direction="row" gap={space.sm} wrap>
            {(t.resolution.candidates.length > 0
              ? t.resolution.candidates.flatMap(
                  (cand) => board.data?.rows.filter((r) => r.patient.id === cand.patientId) ?? [],
                )
              : (board.data?.rows ?? [])
            ).map((r) => (
              <Button
                key={r.patient.id}
                kind="secondary"
                label={`${r.patient.roomLabel} · ${r.patient.displayName}`}
                onPress={() => actions.assign.mutate(r.patient.id, { onError })}
              />
            ))}
          </Stack>
        </Section>
      ) : null}

      {openFlags.filter((f) => f.kind !== 'patient-ambiguous').length > 0 ? (
        <Stack gap={space.md}>
          {openFlags
            .filter((f) => f.kind !== 'patient-ambiguous')
            .map((f) => (
              <FlagQuestion
                key={f.id}
                flag={f}
                busy={actions.answer.isPending}
                onAnswer={
                  editable
                    ? (answer) => actions.answer.mutate({ flagId: f.id, answer }, { onError })
                    : undefined
                }
                onDismiss={
                  editable
                    ? () => actions.answer.mutate({ flagId: f.id, dismiss: true }, { onError })
                    : undefined
                }
              />
            ))}
        </Stack>
      ) : null}

      {c.admission ? (
        <Section title="Macro-cible d’entrée">
          {(
            [
              ['motif', 'Motif'],
              ['antecedents', 'Antécédents'],
              ['histoire', 'Histoire'],
              ['autonomie', 'Autonomie'],
              ['contexte', 'Contexte'],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={{ gap: 2 }}>
              <Text variant="label" tone="muted">
                {label}
              </Text>
              {c.admission?.[key].length ? (
                c.admission[key].map(line)
              ) : (
                <Text tone="subtle">Non dicté</Text>
              )}
            </View>
          ))}
        </Section>
      ) : null}

      {c.targets.length > 0 ? (
        <Section title="Transmissions ciblées (DAR)">
          {c.targets.map((target, i) => (
            <View key={target.id} style={{ gap: space.md }}>
              {i > 0 ? <Divider /> : null}
              <DarBlock
                target={target}
                selectedId={selected?.id ?? null}
                onSelect={select}
                onEdit={edit}
                onRemove={remove}
              />
            </View>
          ))}
        </Section>
      ) : null}

      {c.observations.length > 0 ? (
        <Section title="Surveillance">
          {c.observations.map((o) => (
            <View key={o.id} style={{ gap: 2 }}>
              <Text variant="caption" tone="subtle">
                {APPAREIL_LABELS[o.appareil]}
              </Text>
              {line(o)}
            </View>
          ))}
        </Section>
      ) : null}

      {c.routine.length > 0 ? (
        <Section title="Soins de routine → diagramme de soins">{c.routine.map(line)}</Section>
      ) : null}
      {c.todos.length > 0 ? (
        <Section title="Potentiellement à faire">{c.todos.map(line)}</Section>
      ) : null}
      {c.transverse.length > 0 ? (
        <Section title="Infos transverses">
          {c.transverse.map((u) => (
            <View key={u.id} style={{ gap: 2 }}>
              <Text variant="caption" tone="subtle">
                {TRANSVERSE_LABELS[u.field]}
              </Text>
              {line(u)}
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Ta dictée">
        <TranscriptView
          text={t.dictation.transcript}
          ranges={ranges}
          active={activeSource && activeSource.kind === 'dictation' ? activeSource : null}
        />
        <Text variant="caption" tone="subtle">
          Souligné : utilisé dans les transmissions. Touche une phrase plus haut pour voir son
          extrait.
        </Text>
      </Section>

      {t.engine.rejected.length > 0 ? (
        <Text variant="caption" tone="subtle">
          {t.engine.rejected.length} proposition(s) de l’IA écartée(s) : introuvable(s) dans ta
          dictée ou chiffre modifié.
        </Text>
      ) : null}
    </Screen>
  );
}
