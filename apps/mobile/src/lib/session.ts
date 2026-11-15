import type { CareUnit, Nurse, SessionInfo } from '@infirmier/domain';

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

/** Un soignant proposé sur l'écran « Qui es-tu ? », avec son service (connexion sans mot de passe). */
export interface NurseChoice {
  nurse: Nurse;
  unit: CareUnit;
  /** « Martine Dubois » */
  name: string;
  /** « IDE · Chirurgie polyvalente » */
  detail: string;
}

/** Les soignants du scénario chargé, dans l'ordre du serveur ; ceux sans service connu sont écartés. */
export function nurseChoices(info: Pick<SessionInfo, 'nurses' | 'units'>): NurseChoice[] {
  return info.nurses.flatMap((nurse) => {
    const unit = info.units.find((u) => u.id === nurse.unitId);
    return unit
      ? [
          {
            nurse,
            unit,
            name: `${nurse.firstName} ${nurse.lastName}`,
            detail: `${nurse.role} · ${unit.name}`,
          },
        ]
      : [];
  });
}
