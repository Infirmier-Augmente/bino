import type { Patient } from '../schemas/hospital';
import type { TransverseUpdate } from '../schemas/transmission';
import { normalize } from './text';

/**
 * Verse dans le dossier patient les infos transverses d'une transmission VALIDÉE.
 * Rien n'est versé sans validation de l'IDE (responsabilité, art. R4311-3 CSP).
 */
export function applyTransverseUpdates(
  patient: Patient,
  updates: readonly TransverseUpdate[],
): Patient {
  if (updates.length === 0) return patient;
  const tv = structuredClone(patient.transverse);
  for (const u of updates) {
    const { field: _field, ...item } = u;
    const n = normalize(u.text);
    switch (u.field) {
      case 'allergies': {
        const none = /\b(aucune|pas d allergie|pas allergique|sans allergie)\b/.test(n);
        tv.allergies.status = none && tv.allergies.status !== 'connues' ? 'aucune' : 'connues';
        if (!none || tv.allergies.status === 'connues') tv.allergies.items.push(item);
        break;
      }
      case 'precautions': {
        const standard =
          /\bstandard\b/.test(n) && !/\b(contact|gouttelettes|air|bmr|bhre)\b/.test(n);
        tv.precautions.status = standard ? 'standard' : 'complementaires';
        tv.precautions.items.push(item);
        break;
      }
      case 'engagement': {
        tv.engagement.status = /\blata\b|limitation|arret des therapeutiques/.test(n)
          ? 'lata'
          : 'pas-de-limitation';
        tv.engagement.items.push(item);
        break;
      }
      case 'examens':
      case 'prescriptions':
      case 'famille':
      case 'personneDeConfiance':
        tv[u.field].push(item);
        break;
    }
  }
  return { ...patient, transverse: tv };
}
