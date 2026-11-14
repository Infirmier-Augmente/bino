import type { Patient } from '../schemas/hospital';
import type { PatientCandidate, PatientResolution } from '../schemas/transmission';
import { levenshtein, normalize, normalizeWithMap, tokenize } from './text';

/**
 * Rattachement d'une dictée au bon patient ("Box 12, M. X : extubé à 10h…").
 * Déterministe et explicable : chaque candidat porte ses raisons.
 * Un classifieur peut départager les ex aequo (voir @infirmier/ai), mais
 * en cas de doute on DEMANDE à l'infirmière plutôt que de deviner.
 */

const NUMBER_WORDS: Record<string, string> = {
  un: '1',
  deux: '2',
  trois: '3',
  quatre: '4',
  cinq: '5',
  six: '6',
  sept: '7',
  huit: '8',
  neuf: '9',
  dix: '10',
  onze: '11',
  douze: '12',
  treize: '13',
  quatorze: '14',
  quinze: '15',
  seize: '16',
  vingt: '20',
};

const ROOM_WORDS = ['box', 'chambre', 'ch', 'lit', 'la', 'le', 'du', 'numero', 'n'];

/** Un nombre suivi de ces mots n'est pas une chambre ("16 h", "3 litres", "le 12 novembre"). */
const NOT_ROOM_UNITS = [
  'h',
  'heure',
  'heures',
  'l',
  'litre',
  'litres',
  'mg',
  'ml',
  'cc',
  'g',
  'min',
  'minutes',
  'jours',
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
];

export interface RoomMention {
  room: string;
  /** Position dans le texte original. */
  start: number;
  end: number;
}

/** Numéros de chambre/box cités ("box 12", "la 8", "chambre douze", "dans le 4"). */
export function findRoomMentions(transcript: string): RoomMention[] {
  const { value, map } = normalizeWithMap(transcript);
  const tokens = tokenize(value);
  const out: RoomMention[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok || !ROOM_WORDS.includes(tok.value)) continue;
    let j = i + 1;
    // "box numéro 12", "chambre n 12"
    while (tokens[j] && (tokens[j]?.value === 'numero' || tokens[j]?.value === 'n')) j++;
    const next = tokens[j];
    if (!next) continue;
    let room: string | undefined;
    if (/^\d{1,3}[a-z]?$/.test(next.value)) room = next.value;
    else if (NUMBER_WORDS[next.value]) room = NUMBER_WORDS[next.value];
    if (!room) continue;
    // "le 8" n'est une chambre que si le mot précédent n'est pas une heure ("vers le 8" est rare) :
    // on garde, le score sera faible si aucun patient ne correspond.
    // On écarte "16 h", "3 l" (heures, litres) : le token suivant ne doit pas être une unité.
    const after = tokens[j + 1]?.value;
    if (after && NOT_ROOM_UNITS.includes(after)) continue;
    const start = map[tok.start] ?? 0;
    const end = (map[next.end - 1] ?? start) + 1;
    out.push({ room: room.toUpperCase(), start, end });
  }
  return out;
}

export interface MatchOptions {
  /** Patients de l'IDE qui dicte : léger bonus en cas d'égalité. */
  preferredPatientIds?: readonly string[];
}

export interface MatchResult {
  candidates: PatientCandidate[];
  mention: string | null;
}

const MALE_HINTS = ['monsieur', 'mr', 'm', 'il', 'lui', 'patient'];
const FEMALE_HINTS = ['madame', 'mme', 'elle', 'patiente', 'la dame'];

export function matchPatients(
  transcript: string,
  patients: readonly Patient[],
  options: MatchOptions = {},
): MatchResult {
  const norm = normalize(transcript);
  const tokens = tokenize(norm).map((t) => t.value);
  const head = tokens.slice(0, 25);
  const rooms = findRoomMentions(transcript);
  const firstRoom = rooms[0];
  const preferred = new Set(options.preferredPatientIds ?? []);

  const maleHint = MALE_HINTS.some((h) => head.includes(h));
  const femaleHint = FEMALE_HINTS.some((h) => head.includes(h) || norm.startsWith(h));

  const candidates: PatientCandidate[] = [];
  let mention: string | null = null;

  for (const p of patients) {
    let score = 0;
    const reasons: string[] = [];

    const roomHit = rooms.find((r) => r.room === p.room.toUpperCase());
    if (roomHit) {
      score += roomHit === firstRoom ? 0.65 : 0.45;
      reasons.push(`chambre ${p.room} citée`);
      if (!mention) mention = transcript.slice(roomHit.start, roomHit.end);
    }

    const last = normalize(p.lastName);
    if (tokens.includes(last)) {
      score += 0.55;
      reasons.push(`nom « ${p.lastName} » cité`);
    } else if (
      // Tolérance d'une lettre seulement pour des mots longs ("Lefebvre" / "Lefèvre"),
      // sinon "matin" ressemble à "Martin".
      last.length >= 6 &&
      tokens.some((t) => t.length >= 6 && levenshtein(t, last, 1) <= 1)
    ) {
      score += 0.55;
      reasons.push(`nom proche de « ${p.lastName} »`);
    }
    const first = normalize(p.firstName);
    if (first.length >= 3 && tokens.includes(first)) {
      score += 0.2;
      reasons.push(`prénom « ${p.firstName} » cité`);
    }

    if (score > 0) {
      if (
        (p.sex === 'M' && femaleHint && !maleHint) ||
        (p.sex === 'F' && maleHint && !femaleHint)
      ) {
        score -= 0.25;
        reasons.push('genre employé incohérent');
      } else if ((p.sex === 'M' && maleHint) || (p.sex === 'F' && femaleHint)) {
        score += 0.05;
      }
      if (preferred.has(p.id)) {
        score += 0.05;
        reasons.push('patient de l’IDE');
      }
      candidates.push({ patientId: p.id, score: Math.round(score * 100) / 100, reasons });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return { candidates, mention };
}

const RESOLVE_MIN = 0.6;
const RESOLVE_MARGIN = 0.25;

/** Décide à partir des candidats : résolu, ambigu (on demande), ou introuvable. */
export function resolveFromCandidates(match: MatchResult, method = 'regles'): PatientResolution {
  const [top, second] = match.candidates;
  if (!top) {
    return {
      status: 'unresolved',
      patientId: null,
      confidence: null,
      mention: match.mention,
      candidates: [],
      method,
    };
  }
  const margin = top.score - (second?.score ?? 0);
  if (top.score >= RESOLVE_MIN && margin >= RESOLVE_MARGIN) {
    return {
      status: 'resolved',
      patientId: top.patientId,
      confidence: Math.min(1, top.score),
      mention: match.mention,
      candidates: match.candidates,
      method,
    };
  }
  return {
    status: 'ambiguous',
    patientId: null,
    confidence: null,
    mention: match.mention,
    candidates: match.candidates.slice(0, 4),
    method,
  };
}

/**
 * Plusieurs patients CLAIREMENT cités dans une même dictée ? (on suggère de séparer)
 * Seules les preuves fortes comptent : chambre citée ou nom exact (pas un nom approchant).
 */
export function mentionsSeveralPatients(match: Pick<MatchResult, 'candidates'>): boolean {
  const strong = match.candidates.filter((c) =>
    c.reasons.some((r) => r.startsWith('chambre') || r.startsWith('nom «')),
  );
  return strong.length >= 2;
}
