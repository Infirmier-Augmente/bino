import { describe, expect, it } from 'vitest';
import { isSessionStillValid, nurseChoices } from './session';

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

describe('« Qui es-tu ? »', () => {
  it('un choix par soignant, avec son service ; ordre du serveur', () => {
    const karim = { ...nurse('karim', 'chir'), firstName: 'Karim', lastName: 'Haddad' };
    const choices = nurseChoices({
      units: [{ ...unit('chir'), name: 'Chirurgie polyvalente' }],
      nurses: [nurse('martine', 'chir'), karim],
    });
    expect(choices.map((c) => [c.nurse.id, c.name, c.detail])).toEqual([
      ['martine', 'Martine Dubois', 'IDE · Chirurgie polyvalente'],
      ['karim', 'Karim Haddad', 'IDE · Chirurgie polyvalente'],
    ]);
    expect(choices[0]?.unit.id).toBe('chir');
  });
  it('un soignant sans service connu n’est pas proposé', () => {
    expect(nurseChoices({ units: [unit('chir')], nurses: [nurse('martine', 'rea')] })).toEqual([]);
  });
});
