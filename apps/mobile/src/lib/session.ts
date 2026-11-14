import type { SessionInfo } from '@infirmier/domain';

/**
 * Après un changement de scénario (tout l'hôpital est remplacé), la session reste valable
 * seulement si le même soignant existe encore DANS LE MÊME service. Un même identifiant
 * (« martine ») peut exister dans deux scénarios avec des services différents.
 */
export function isSessionStillValid(
  session: { nurseId: string; unitId: string },
  info: Pick<SessionInfo, 'nurses' | 'units'>,
): boolean {
  return (
    info.units.some((u) => u.id === session.unitId) &&
    info.nurses.some((n) => n.id === session.nurseId && n.unitId === session.unitId)
  );
}
