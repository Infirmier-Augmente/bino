import {
  APPAREIL_LABELS,
  APPAREIL_ORDER,
  type Appareil,
  type SourcedItem,
} from '../schemas/common';
import {
  type CareUnit,
  type Patient,
  PRIORITY_LABELS,
  TRANSVERSE_LABELS,
  type TransverseField,
} from '../schemas/hospital';
import { type DarTarget, SEVERITY_RANK, type Transmission } from '../schemas/transmission';
import type {
  HandoverSection,
  HandoverSheet,
  PatientListItem,
  PatientSummary,
  RecapLine,
  TransmissionCounts,
  TransverseLine,
  UnitBoard,
} from '../schemas/views';
import { patientLevelFlags } from './completeness';
import { lexicalSeverity } from './lexicon';
import { comparePriority, effectivePriority, suggestPriority } from './priority';
import { ageAt, dayOfStay, formatClock, handoverWindow, isWithin, toLocalIso } from './time';

/**
 * FICHE DE RELÈVE — assemblée de façon DÉTERMINISTE à partir des transmissions
 * structurées du poste. Aucune phrase n'est générée ici : on range, on trie,
 * on compte. Elle fonctionne donc même si aucun LLM n'est disponible.
 */

export function displayName(p: Pick<Patient, 'sex' | 'lastName'>): string {
  return `${p.sex === 'F' ? 'Mme' : 'M.'} ${p.lastName}`;
}

export function roomLabel(unit: Pick<CareUnit, 'roomPrefix'>, room: string): string {
  return `${unit.roomPrefix} ${room}`;
}

export function patientSummary(patient: Patient, unit: CareUnit, now: Date): PatientSummary {
  return {
    id: patient.id,
    unitId: patient.unitId,
    room: patient.room,
    roomLabel: roomLabel(unit, patient.room),
    displayName: displayName(patient),
    lastName: patient.lastName,
    firstName: patient.firstName,
    sex: patient.sex,
    age: ageAt(patient.birthDate, now),
    admissionReason: patient.admissionReason,
    admittedAt: patient.admittedAt,
    dayOfStay: dayOfStay(patient.admittedAt, now, unit.timeZone),
    assignedNurseId: patient.assignedNurseId,
  };
}

export function transmissionsInShift(
  transmissions: readonly Transmission[],
  patientId: string,
  shift: { start: string; end: string },
): Transmission[] {
  return transmissions
    .filter((t) => t.patientId === patientId && isWithin(t.createdAt, shift.start, shift.end))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function countTransmissions(transmissions: readonly Transmission[]): TransmissionCounts {
  return {
    total: transmissions.length,
    draft: transmissions.filter((t) => t.review.status === 'draft').length,
    validated: transmissions.filter((t) => t.review.status === 'validated').length,
    unreviewed: transmissions.filter((t) => t.review.status === 'unreviewed').length,
    openFlags: transmissions.reduce(
      (n, t) => n + t.flags.filter((f) => f.status === 'open').length,
      0,
    ),
  };
}

function targetSeverityRank(t: DarTarget): number {
  const text = [t.label, ...t.data.map((d) => d.text)].join(' ');
  return SEVERITY_RANK[t.severity?.level ?? lexicalSeverity(text)];
}

/** Une ligne "À retenir" par cible : libellé + premières données, avec leurs sources. */
function targetHeadline(t: DarTarget): SourcedItem {
  const parts = [...t.data, ...t.actions].slice(0, 2);
  const details = joinFragments(parts.map((p) => p.text));
  const sources = [...t.data, ...t.actions, ...t.results].flatMap((i) => i.sources);
  return {
    id: `headline:${t.id}`,
    text: details ? `${t.label} : ${details}.` : `${t.label}.`,
    sources: sources.length > 0 ? sources : [{ kind: 'record', field: 'target', label: t.label }],
    edited: false,
  };
}

/** "Agité vers 16h." + "Il a arraché sa SNG." → "Agité vers 16h, il a arraché sa SNG" */
export function joinFragments(texts: readonly string[]): string {
  return texts
    .map((t, i) => {
      const s = t.trim().replace(/\.$/, '');
      // On ne baisse pas la casse d'un sigle ("SNG", "KT").
      return i === 0 || /^[A-ZÀ-Ý]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
    })
    .join(', ');
}

export function buildHeadline(transmissions: readonly Transmission[], limit = 4): SourcedItem[] {
  const targets = transmissions.flatMap((t) => t.content.targets);
  const admission = transmissions.find((t) => t.content.admission !== null)?.content.admission;
  const items: SourcedItem[] = [];
  if (admission?.motif[0]) {
    const m = admission.motif[0];
    items.push({ ...m, id: `headline:admission:${m.id}`, text: `Entrée : ${m.text}` });
  }
  const sorted = [...targets].sort((a, b) => targetSeverityRank(b) - targetSeverityRank(a));
  for (const t of sorted) items.push(targetHeadline(t));
  return items.slice(0, limit);
}

const CORE_APPAREILS: readonly Appareil[] = ['neuro', 'respiratoire', 'hemodynamique'];

function buildSections(unit: CareUnit, transmissions: readonly Transmission[]): HandoverSection[] {
  const observations = transmissions.flatMap((t) => t.content.observations);
  const routine = transmissions.flatMap((t) => t.content.routine);
  const targets = transmissions.flatMap((t) => t.content.targets);

  if (unit.template === 'sommaire') {
    return [
      { key: 'evenements', title: 'Événements du poste', items: targets.map(targetHeadline) },
      { key: 'surveillance', title: 'Surveillance', items: observations },
      { key: 'soins', title: 'Soins réalisés', items: routine },
    ];
  }

  const sections: HandoverSection[] = [];
  for (const appareil of APPAREIL_ORDER) {
    const items = [
      ...observations.filter((o) => o.appareil === appareil),
      // Les données des cibles apparaissent aussi dans leur appareil (comme l'exemple B du kit).
      ...targets.filter((t) => t.appareil === appareil).flatMap((t) => t.data),
      ...routine.filter((r) => r.appareil === appareil),
    ];
    if (items.length > 0 || CORE_APPAREILS.includes(appareil)) {
      sections.push({ key: appareil, title: APPAREIL_LABELS[appareil], items });
    }
  }
  return sections;
}

function transverseLines(patient: Patient, pending: readonly Transmission[]): TransverseLine[] {
  const pendingUpdates = pending
    .filter((t) => t.review.status !== 'validated')
    .flatMap((t) => t.content.transverse);
  const extra = (field: TransverseField): SourcedItem[] =>
    pendingUpdates.filter((u) => u.field === field);
  const tv = patient.transverse;

  const line = (
    field: TransverseField,
    items: SourcedItem[],
    status: 'renseigne' | 'non-renseigne',
    fallback: string,
  ): TransverseLine => ({
    field,
    label: TRANSVERSE_LABELS[field],
    status,
    summary: items.length > 0 ? items.map((i) => i.text.replace(/\.$/, '')).join(' · ') : fallback,
    items,
  });

  const allergies = [...tv.allergies.items, ...extra('allergies')];
  const precautions = [...tv.precautions.items, ...extra('precautions')];
  const engagement = [...tv.engagement.items, ...extra('engagement')];

  return [
    line(
      'allergies',
      allergies,
      tv.allergies.status === 'inconnu' && allergies.length === 0 ? 'non-renseigne' : 'renseigne',
      tv.allergies.status === 'aucune' ? 'Aucune allergie connue' : 'Non renseigné',
    ),
    line(
      'precautions',
      precautions,
      tv.precautions.status === 'inconnu' && precautions.length === 0
        ? 'non-renseigne'
        : 'renseigne',
      tv.precautions.status === 'standard' ? 'Précautions standard' : 'Non renseigné',
    ),
    line(
      'engagement',
      engagement,
      tv.engagement.status === 'inconnu' && engagement.length === 0 ? 'non-renseigne' : 'renseigne',
      tv.engagement.status === 'pas-de-limitation' ? 'Pas de limitation' : 'Non renseigné',
    ),
    ...(['examens', 'prescriptions', 'famille', 'personneDeConfiance'] as const).map((field) => {
      const items = [...tv[field], ...extra(field)];
      return line(
        field,
        items,
        items.length > 0 ? 'renseigne' : 'non-renseigne',
        'Rien de transmis',
      );
    }),
  ];
}

export interface HandoverInput {
  unit: CareUnit;
  patient: Patient;
  transmissions: readonly Transmission[];
  now: Date;
}

export function buildHandoverSheet({
  unit,
  patient,
  transmissions,
  now,
}: HandoverInput): HandoverSheet {
  const shift = handoverWindow(now, unit);
  const inShift = transmissionsInShift(transmissions, patient.id, shift);
  const suggestion = suggestPriority({ patient, shiftTransmissions: inShift, now });
  return {
    patient: patientSummary(patient, unit, now),
    template: unit.template,
    shift,
    generatedAt: toLocalIso(now, unit.timeZone),
    headline: buildHeadline(inShift),
    targets: inShift.flatMap((t) => t.content.targets),
    sections: buildSections(unit, inShift),
    transverse: transverseLines(patient, inShift),
    todos: inShift.flatMap((t) => t.content.todos),
    openFlags: [
      ...inShift.flatMap((t) => t.flags.filter((f) => f.status === 'open')),
      ...patientLevelFlags(patient),
    ],
    counts: countTransmissions(inShift),
    priority: effectivePriority(patient, suggestion),
    transmissionIds: inShift.map((t) => t.id),
  };
}

export function buildPatientListItem({
  unit,
  patient,
  transmissions,
  now,
}: HandoverInput): PatientListItem {
  const shift = handoverWindow(now, unit);
  const inShift = transmissionsInShift(transmissions, patient.id, shift);
  const suggestion = suggestPriority({ patient, shiftTransmissions: inShift, now });
  const alerts: string[] = [];
  const tv = patient.transverse;
  if (tv.allergies.status === 'connues') {
    alerts.push(`Allergie : ${tv.allergies.items.map((i) => i.text).join(', ')}`);
  }
  if (tv.precautions.status === 'complementaires') {
    alerts.push(tv.precautions.items.map((i) => i.text).join(', '));
  }
  if (tv.engagement.status === 'lata') alerts.push('LATA');
  const last = inShift.at(-1);
  return {
    patient: patientSummary(patient, unit, now),
    priority: effectivePriority(patient, suggestion),
    counts: countTransmissions(inShift),
    headline: buildHeadline(inShift, 2),
    alerts,
    lastTransmissionAt: last ? last.createdAt : null,
  };
}

export interface BoardInput {
  unit: CareUnit;
  patients: readonly Patient[];
  transmissions: readonly Transmission[];
  now: Date;
}

export function buildUnitBoard({ unit, patients, transmissions, now }: BoardInput): UnitBoard {
  const rows = patients
    .filter((p) => p.unitId === unit.id && p.status === 'present')
    .map((patient) => buildPatientListItem({ unit, patient, transmissions, now }))
    .sort((a, b) =>
      comparePriority(
        { priority: a.priority, room: a.patient.room },
        { priority: b.priority, room: b.patient.room },
      ),
    );
  const shift = handoverWindow(now, unit);
  const inShift = transmissions.filter(
    (t) => t.unitId === unit.id && isWithin(t.createdAt, shift.start, shift.end),
  );
  return {
    unit,
    shift,
    now: toLocalIso(now, unit.timeZone),
    rows,
    totals: countTransmissions(inShift),
  };
}

/** Récap "taille SMS" : une ligne courte par patient, pour qui a raté la relève. */
export function buildRecap(board: UnitBoard): RecapLine[] {
  return board.rows.map((row) => {
    const parts = [
      `${row.patient.roomLabel} ${row.patient.displayName}`,
      PRIORITY_LABELS[row.priority.level].toUpperCase(),
    ];
    const first = row.headline[0];
    if (first) parts.push(first.text.replace(/\.$/, ''));
    if (row.counts.openFlags > 0) {
      parts.push(
        `${row.counts.openFlags} question${row.counts.openFlags > 1 ? 's' : ''} ouverte${row.counts.openFlags > 1 ? 's' : ''}`,
      );
    }
    if (row.counts.unreviewed + row.counts.draft > 0) {
      parts.push(`${row.counts.unreviewed + row.counts.draft} non relue(s)`);
    }
    if (row.lastTransmissionAt) {
      parts.push(`dernière note ${formatClock(row.lastTransmissionAt, board.unit.timeZone)}`);
    }
    const text = `${row.priority.starred ? '★ ' : ''}${parts.join(' · ')}`;
    return {
      patientId: row.patient.id,
      level: row.priority.level,
      starred: row.priority.starred,
      text: text.length > 200 ? `${text.slice(0, 197)}…` : text,
    };
  });
}
