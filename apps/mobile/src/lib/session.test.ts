import { describe, expect, it } from 'vitest';
import { isSessionStillValid } from './session';

const unit = (id: string) => ({
  id,
  name: id,
  kind: 'chirurgie' as const,
  template: 'sommaire' as const,
  roomPrefix: 'Chambre',
  timeZone: 'Europe/Paris',
  shifts: { dayStart: '07:45', nightStart: '19:45' },
});
const nurse = (id: string, unitId: string) => ({
  id,
  unitId,
  matricule: '10482',
  firstName: 'Martine',
  lastName: 'Dubois',
  role: 'IDE' as const,
});

describe('session après un changement de scénario', () => {
  const session = { nurseId: 'martine', unitId: 'chir' };
  it('reste valable si le soignant existe toujours dans le même service', () => {
    expect(
      isSessionStillValid(session, { units: [unit('chir')], nurses: [nurse('martine', 'chir')] }),
    ).toBe(true);
  });
  it('tombe si le même identifiant existe dans un autre service (réa ≠ chirurgie)', () => {
    expect(
      isSessionStillValid(session, { units: [unit('rea')], nurses: [nurse('martine', 'rea')] }),
    ).toBe(false);
  });
  it('tombe si le soignant a disparu', () => {
    expect(
      isSessionStillValid(session, { units: [unit('chir')], nurses: [nurse('karim', 'chir')] }),
    ).toBe(false);
  });
});
