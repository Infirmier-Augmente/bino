import type { CareUnit, Nurse } from '@infirmier/domain';

// Hôpital simulé « Hôpital Saint-Exemple » — tout est fictif.

export const UNIT_REA: CareUnit = {
  id: 'rea',
  name: 'Réanimation polyvalente',
  kind: 'reanimation',
  template: 'par-appareil',
  roomPrefix: 'Box',
  timeZone: 'Europe/Paris',
  shifts: { dayStart: '07:45', nightStart: '19:45' },
};

export const UNIT_MEDECINE: CareUnit = {
  id: 'medecine',
  name: 'Médecine interne',
  kind: 'medecine',
  template: 'sommaire',
  roomPrefix: 'Chambre',
  timeZone: 'Europe/Paris',
  shifts: { dayStart: '07:45', nightStart: '19:45' },
};

export const NURSES_REA: Nurse[] = [
  { id: 'martine', unitId: 'rea', firstName: 'Martine', lastName: 'Roux', role: 'IDE' },
  { id: 'karim', unitId: 'rea', firstName: 'Karim', lastName: 'Benali', role: 'IDE' },
  { id: 'sophie', unitId: 'rea', firstName: 'Sophie', lastName: 'Marchand', role: 'IDE' },
  { id: 'julien', unitId: 'rea', firstName: 'Julien', lastName: 'Faure', role: 'IDE' },
];

export const NURSES_MEDECINE: Nurse[] = [
  { id: 'claire', unitId: 'medecine', firstName: 'Claire', lastName: 'Garnier', role: 'IDE' },
  { id: 'yanis', unitId: 'medecine', firstName: 'Yanis', lastName: 'Haddad', role: 'IDE' },
  { id: 'lea', unitId: 'medecine', firstName: 'Léa', lastName: 'Perrin', role: 'IDE' },
  { id: 'nadia', unitId: 'medecine', firstName: 'Nadia', lastName: 'Morel', role: 'AS' },
];
