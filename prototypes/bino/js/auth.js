// Comptes fictifs de la démo, alignés sur les soignants du service. Le mot de passe n'est jamais enregistré.
import { NURSES } from './data.js';

export const STAFF = [
  { matricule: '10482', password: 'bino', name: NURSES[1] },
  { matricule: '10415', password: 'bino', name: NURSES[2] },
  { matricule: '10401', password: 'bino', name: NURSES[0] },
];

export function findStaff(matricule, password) {
  const id = String(matricule || '').replace(/\s/g, '');
  const pw = String(password || '')
    .trim()
    .toLowerCase();
  return STAFF.find((s) => s.matricule === id && s.password === pw) || null;
}
