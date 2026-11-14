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

export const UNIT_CHIR: CareUnit = {
  id: 'chir',
  name: 'Chirurgie polyvalente',
  kind: 'chirurgie',
  template: 'sommaire',
  roomPrefix: 'Chambre',
  timeZone: 'Europe/Paris',
  shifts: { dayStart: '07:45', nightStart: '19:45' },
};

// Matricules de démo (fictifs, uniques). Mot de passe partagé : DEMO_PASSWORD côté API.
export const NURSES_REA: Nurse[] = [
  {
    id: 'martine',
    matricule: '20482',
    unitId: 'rea',
    firstName: 'Martine',
    lastName: 'Roux',
    role: 'IDE',
  },
  {
    id: 'karim',
    matricule: '20415',
    unitId: 'rea',
    firstName: 'Karim',
    lastName: 'Benali',
    role: 'IDE',
  },
  {
    id: 'sophie',
    matricule: '20401',
    unitId: 'rea',
    firstName: 'Sophie',
    lastName: 'Marchand',
    role: 'IDE',
  },
  {
    id: 'julien',
    matricule: '20430',
    unitId: 'rea',
    firstName: 'Julien',
    lastName: 'Faure',
    role: 'IDE',
  },
];

export const NURSES_MEDECINE: Nurse[] = [
  {
    id: 'claire',
    matricule: '30410',
    unitId: 'medecine',
    firstName: 'Claire',
    lastName: 'Garnier',
    role: 'IDE',
  },
  {
    id: 'yanis',
    matricule: '30420',
    unitId: 'medecine',
    firstName: 'Yanis',
    lastName: 'Haddad',
    role: 'IDE',
  },
  {
    id: 'lea',
    matricule: '30430',
    unitId: 'medecine',
    firstName: 'Léa',
    lastName: 'Perrin',
    role: 'IDE',
  },
  {
    id: 'nadia',
    matricule: '30440',
    unitId: 'medecine',
    firstName: 'Nadia',
    lastName: 'Morel',
    role: 'AS',
  },
];

/** Équipe du prototype Bino (matricules repris à l'identique). */
export const NURSES_CHIR: Nurse[] = [
  {
    id: 'martine',
    unitId: 'chir',
    matricule: '10482',
    firstName: 'Martine',
    lastName: 'Dubois',
    role: 'IDE',
  },
  {
    id: 'sophie',
    unitId: 'chir',
    matricule: '10401',
    firstName: 'Sophie',
    lastName: 'Lemoine',
    role: 'IDE',
  },
  {
    id: 'karim',
    unitId: 'chir',
    matricule: '10415',
    firstName: 'Karim',
    lastName: 'Haddad',
    role: 'IDE',
  },
];
