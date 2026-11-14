import type {
  Bundle,
  BundleEntry,
  Composition,
  CompositionSection,
  Patient as FhirPatient,
} from 'fhir/r4';
import { formatClock, toLocalIso } from '../rules/time';
import type { SourcedItem } from '../schemas/common';
import type { CareUnit, Nurse, Patient } from '../schemas/hospital';
import type { Transmission } from '../schemas/transmission';

/**
 * EXPORT STRUCTURÉ VERS LE DPI (simulé pendant le hackathon).
 * Format d'échange : Bundle FHIR R4 (type "collection") avec une Composition
 * "Nurse Note" (LOINC 34746-8) par lot de transmissions, une section par cible DAR.
 * Le statut reflète la validation : final = validé par l'IDE, preliminary sinon.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const li = (items: readonly SourcedItem[]) =>
  items.length === 0
    ? '<li><em>Non renseigné</em></li>'
    : items.map((i) => `<li>${esc(i.text)}</li>`).join('');

function div(inner: string): { status: 'generated'; div: string } {
  return { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${inner}</div>` };
}

export interface FhirExportInput {
  unit: CareUnit;
  patient: Patient;
  nurses: readonly Nurse[];
  transmissions: readonly Transmission[];
  now: Date;
  bundleId: string;
}

export function buildFhirBundle({
  unit,
  patient,
  nurses,
  transmissions,
  now,
  bundleId,
}: FhirExportInput): Bundle {
  const patientRef = `urn:uuid:patient-${patient.id}`;
  const fhirPatient: FhirPatient = {
    resourceType: 'Patient',
    id: `patient-${patient.id}`,
    identifier: [{ system: 'urn:infirmier-augmente:ipp', value: patient.ipp }],
    name: [{ family: patient.lastName, given: [patient.firstName] }],
    gender: patient.sex === 'F' ? 'female' : 'male',
    birthDate: patient.birthDate,
  };

  const entries: BundleEntry[] = [];
  const compositions: Composition[] = transmissions.map((t) => {
    const nurse = nurses.find((n) => n.id === t.nurseId);
    const sections: CompositionSection[] = t.content.targets.map((target) => ({
      title: `Cible : ${target.label}`,
      code: { text: target.appareil },
      text: div(
        `<p><b>D</b></p><ul>${li(target.data)}</ul><p><b>A</b></p><ul>${li(target.actions)}</ul><p><b>R</b></p><ul>${li(target.results)}</ul>`,
      ),
    }));
    if (t.content.observations.length > 0) {
      sections.push({ title: 'Surveillance', text: div(`<ul>${li(t.content.observations)}</ul>`) });
    }
    if (t.content.routine.length > 0) {
      sections.push({
        title: 'Diagramme de soins (soins de routine)',
        text: div(`<ul>${li(t.content.routine)}</ul>`),
      });
    }
    if (t.content.admission) {
      const a = t.content.admission;
      sections.unshift({
        title: 'Macro-cible d’entrée',
        text: div(
          `<p>Motif</p><ul>${li(a.motif)}</ul><p>Antécédents</p><ul>${li(a.antecedents)}</ul><p>Histoire</p><ul>${li(a.histoire)}</ul><p>Autonomie</p><ul>${li(a.autonomie)}</ul><p>Contexte</p><ul>${li(a.contexte)}</ul>`,
        ),
      });
    }
    return {
      resourceType: 'Composition',
      id: `transmission-${t.id}`,
      status: t.review.status === 'validated' ? 'final' : 'preliminary',
      type: {
        coding: [{ system: 'http://loinc.org', code: '34746-8', display: 'Nurse Note' }],
        text: t.mode === 'admission' ? 'Macro-cible d’entrée' : 'Transmissions ciblées',
      },
      subject: { reference: patientRef },
      date: t.createdAt,
      author: [
        {
          display: nurse ? `${nurse.firstName} ${nurse.lastName} (${nurse.role})` : t.nurseId,
        },
      ],
      title: `Transmissions ${unit.name} · ${formatClock(t.createdAt, unit.timeZone)}`,
      section: sections,
    };
  });

  entries.push({ fullUrl: patientRef, resource: fhirPatient });
  for (const c of compositions) {
    entries.push({ fullUrl: `urn:uuid:${c.id}`, resource: c });
  }

  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'collection',
    timestamp: toLocalIso(now, unit.timeZone),
    entry: entries,
  };
}
