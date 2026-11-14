import type { PatientDetail, SourcedItem } from '@infirmier/domain';

export interface InfoLine {
  label: string;
  value: string;
}

/** Textes des éléments sourcés, sans point final, séparés par des virgules. */
export function joinItems(items: readonly SourcedItem[]): string {
  return items.map((i) => i.text.trim().replace(/\.$/, '')).join(', ');
}

/**
 * Lignes « Dossier médical » sous le tableau des constantes. Rien n'est supposé : une donnée
 * inconnue s'affiche « Non renseigné(e)s », jamais « Aucun ».
 */
export function dossierLines(detail: Pick<PatientDetail, 'patient' | 'devices'>): InfoLine[] {
  const { patient, devices } = detail;
  const t = patient.transverse;
  const lines: InfoLine[] = [
    { label: 'Motif', value: patient.admissionReason.trim() || 'Non renseigné' },
    { label: 'Antécédents', value: patient.history?.trim() || 'Non renseignés' },
    {
      label: 'Allergies',
      value:
        t.allergies.status === 'connues' && t.allergies.items.length > 0
          ? joinItems(t.allergies.items)
          : t.allergies.status === 'aucune'
            ? 'Aucune connue'
            : 'Non renseignées',
    },
  ];
  if (t.precautions.items.length > 0) {
    lines.push({ label: 'Précautions', value: joinItems(t.precautions.items) });
  }
  if (devices.length > 0) {
    lines.push({
      label: 'Dispositifs',
      value: devices.map((d) => `${d.label} (${d.day})`).join(', '),
    });
  }
  if (t.prescriptions.length > 0) {
    lines.push({ label: 'Nouvelle prescription', value: joinItems(t.prescriptions) });
  }
  const family = [...t.famille, ...t.personneDeConfiance];
  if (family.length > 0) lines.push({ label: 'Famille', value: joinItems(family) });
  return lines;
}
