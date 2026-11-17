// Comptes fictifs de la démo, alignés sur les soignants du service. Le mot de passe n'est jamais enregistré.
import { NURSES } from './data.js';
import type { Staff } from './model.js';

export const STAFF: Staff[] = [
  { matricule: '10482', password: 'bino', name: NURSES[0] },
  { matricule: '10415', password: 'bino', name: NURSES[2] },
  { matricule: '10401', password: 'bino', name: NURSES[1] },
];

export const staffName = (matricule: string): string =>
  STAFF.find((s) => s.matricule === matricule)?.name || '';

export function findStaff(matricule: string, password: string): Staff | null {
  const id = String(matricule || '').replace(/\s/g, '');
  const pw = String(password || '')
    .trim()
    .toLowerCase();
  return STAFF.find((s) => s.matricule === id && s.password === pw) || null;
}
