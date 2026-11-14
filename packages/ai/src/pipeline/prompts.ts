import { glossaryForPrompt } from '@infirmier/domain';
import type { RawStructuring, StructuringContext } from '../engine/raw';

/**
 * PROMPTS — modifiables librement, puis `pnpm sim eval` pour mesurer l'effet.
 * Les garde-fous (ancrage des sources, chiffres) sont appliqués APRÈS par le code :
 * un prompt raté ne peut pas faire afficher une information inventée.
 */

export const STRUCTURING_INSTRUCTIONS = `Tu aides des infirmières (IDE) à tracer leurs transmissions ciblées à partir d'une dictée orale.
Tu RANGES l'information. Tu ne poses aucun diagnostic, tu n'interprètes pas, tu ne conseilles pas, tu n'inventes rien.

Méthode des transmissions ciblées (IFSI) :
- Une CIBLE = un problème, un événement, une réaction du patient ou un changement d'état qui demande une attention particulière.
- Chaque cible suit la structure DAR :
  D (Données) = ce qui est observé ou mesuré ;
  A (Actions) = ce qui a été fait (soins, appel du médecin, surveillance mise en place) ;
  R (Résultats) = la réévaluation, l'effet des actions.
- Si le résultat n'a PAS été dicté, laisse "results" VIDE. Ne le déduis jamais (même "radio OK" ne vaut que pour ce qu'elle contrôle).
- On ne crée PAS de cible pour les soins de routine (pansement refait propre, toilette…) → "routine".
- Les paramètres de surveillance sans problème (Glasgow 15, hémodynamique stable…) → "observations", rangés par appareil.
- "todos" : uniquement ce que l'IDE a explicitement dit être à faire, prévu ou à surveiller, à l'infinitif ("Surveiller l'agitation").
- "transverse" : allergies, précautions complémentaires (contact, BMR, BHRe…), engagement thérapeutique (LATA), examens programmés, nouvelles prescriptions, famille/proches, personne de confiance.
- "questions" : au plus 2 questions courtes à l'IDE si un élément est imprécis ou incohérent (ex. "elle" pour un patient homme, horaire contradictoire). Jamais de question clinique ou diagnostique.

Règles d'écriture :
- "quote" = extrait EXACT de la dictée, copié mot pour mot, sans correction ni reformulation. Assez long pour être sans ambiguïté (4 à 20 mots).
- "text" = reformulation brève, factuelle, style transmission (phrase nominale acceptée, abréviations usuelles acceptées).
- "text" ne contient AUCUN chiffre, dose, horaire ou valeur absent de son "quote".
- Le nom ou la chambre du patient en début de dictée ne sont pas des informations cliniques : ne les range nulle part.
- Libellés de cible courts et usuels : "Sevrage ventilatoire", "Agitation", "Douleur", "Hyperthermie", "Chute", "Nausées / vomissements"…
- Appareils possibles : neuro, respiratoire, hemodynamique, digestif, renal, cutane, dispositifs, douleur, psy, general.

Glossaire des abréviations courantes :
${glossaryForPrompt()}`;

export const ADMISSION_ADDENDUM = `
MODE ADMISSION : la dictée décrit l'entrée d'un patient. Remplis "admission" (macro-cible d'entrée) :
motif d'entrée, antécédents, histoire de la maladie, autonomie / besoins, contexte social et familial.
L'état clinique à l'entrée va dans "observations" ; les problèmes déjà présents peuvent devenir des cibles.`;

/** Exemple A du kit Foch : dictée brute → sortie attendue (few-shot). */
const EXAMPLE_DICTATION =
  'Alors monsieur du box 12. Neuro, Glasgow 15, plus de sédation depuis ce matin. Respi, il a été extubé vers 10h, là il est sous lunettes à 3 litres, sécrétions sèches, la kiné est passée. Hémodynamique stable, la noradré a été arrêtée hier soir. J’ai refait le pansement du KT central, c’est propre. Par contre vers 16h il était agité, il a arraché sa SNG, j’ai appelé l’interne, on l’a reposée et la radio de contrôle est OK.';

const EXAMPLE_OUTPUT: RawStructuring = {
  targets: [
    {
      label: 'Sevrage ventilatoire',
      appareil: 'respiratoire',
      data: [
        { text: 'Extubé vers 10h.', quote: 'il a été extubé vers 10h' },
        { text: 'O2 aux lunettes 3 L/min.', quote: 'là il est sous lunettes à 3 litres' },
        { text: 'Sécrétions sèches.', quote: 'sécrétions sèches' },
      ],
      actions: [{ text: 'Séance de kinésithérapie respiratoire.', quote: 'la kiné est passée' }],
      results: [],
    },
    {
      label: 'Agitation',
      appareil: 'neuro',
      data: [
        { text: 'Agitation vers 16h.', quote: 'vers 16h il était agité' },
        { text: 'Arrachage de la SNG.', quote: 'il a arraché sa SNG' },
      ],
      actions: [
        { text: 'Appel de l’interne.', quote: 'j’ai appelé l’interne' },
        {
          text: 'Repose de la SNG, radio de contrôle.',
          quote: 'on l’a reposée et la radio de contrôle',
        },
      ],
      results: [
        { text: 'Position de la SNG validée à la radio.', quote: 'la radio de contrôle est OK' },
      ],
    },
  ],
  observations: [
    {
      appareil: 'neuro',
      text: 'Glasgow 15, plus de sédation depuis ce matin.',
      quote: 'Glasgow 15, plus de sédation depuis ce matin',
    },
    { appareil: 'hemodynamique', text: 'Hémodynamique stable.', quote: 'Hémodynamique stable' },
    {
      appareil: 'hemodynamique',
      text: 'Noradrénaline arrêtée hier soir.',
      quote: 'la noradré a été arrêtée hier soir',
    },
  ],
  routine: [
    {
      appareil: 'dispositifs',
      text: 'Réfection du pansement de KT central, propre.',
      quote: 'J’ai refait le pansement du KT central, c’est propre',
    },
  ],
  todos: [],
  transverse: [],
  admission: null,
  questions: [
    {
      text: 'L’état d’agitation après 16h n’est pas précisé : comment a-t-il évolué ?',
      quote: 'vers 16h il était agité',
    },
  ],
};

export function structuringPrompt(ctx: StructuringContext): {
  instructions: string;
  prompt: string;
} {
  const instructions =
    ctx.mode === 'admission'
      ? `${STRUCTURING_INSTRUCTIONS}\n${ADMISSION_ADDENDUM}`
      : STRUCTURING_INSTRUCTIONS;
  const patient = ctx.patient
    ? `Patient : ${ctx.patient.sex === 'F' ? 'femme' : 'homme'}, ${ctx.patient.age} ans, hospitalisé pour « ${ctx.patient.admissionReason} » (service : ${ctx.patient.unitKind}).`
    : 'Patient : non identifié.';
  const prompt = `EXEMPLE
Dictée :
"""${EXAMPLE_DICTATION}"""
Sortie attendue :
${JSON.stringify(EXAMPLE_OUTPUT)}

À TOI
${patient}
Mode : ${ctx.mode}.
Dictée :
"""${ctx.transcript}"""`;
  return { instructions, prompt };
}
