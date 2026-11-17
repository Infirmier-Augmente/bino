// Contrôle réel OpenRouter : une structuration et une transcription.
// Hors de `pnpm test` (qui reste local). Lancé par `pnpm live` et par le job CI dédié.
import { readFileSync } from 'node:fs';
import { aiConfigFromEnv, createAiServices, randomIds } from '@infirmier/ai';
import type { Transmission } from '@infirmier/domain';
import { getScenario, initialState } from '@infirmier/simulation';
import { HospitalService } from '../services/hospital-service';
import { HospitalStore } from '../store/store';

const TRANSCRIPT = 'Box 12, monsieur Durand. Température à 38,5, je lui ai donné du paracétamol.';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function sourced(t: Transmission) {
  const items = [
    ...t.content.targets.flatMap((target) => [
      ...target.data,
      ...target.actions,
      ...target.results,
    ]),
    ...t.content.routine,
    ...t.content.todos,
  ];
  return items.some((item) => item.sources.length > 0);
}

if (!process.env.OPENROUTER_API_KEY) fail('OPENROUTER_API_KEY manquante');

const scenario = getScenario('rea-box12');
if (!scenario) fail('scénario rea-box12 introuvable');
const store = HospitalStore.inMemory(initialState(scenario));
const ai = createAiServices(aiConfigFromEnv(process.env), { logger: { warn: () => {} } });
if (!ai.stt.ready) fail('la transcription OpenRouter n’est pas active');
const hospital = new HospitalService({ store, ai, ids: randomIds });

let detail = '';
let structured = false;
for (let attempt = 1; attempt <= 3; attempt++) {
  const note = await hospital.createTransmission({
    unitId: 'rea',
    nurseId: 'martine',
    patientId: 'rea-12',
    transcript: TRANSCRIPT,
    mode: 'transmission',
    inputMethod: 'keyboard',
  });
  detail = `${note.engine.structuring} dégradé=${note.engine.degraded} rejeté=${note.engine.rejected.length}`;
  if (
    !note.engine.degraded &&
    note.engine.structuring.includes('deepseek') &&
    note.engine.rejected.length === 0 &&
    sourced(note)
  ) {
    structured = true;
    console.info(`structuration ${detail}`);
    break;
  }
  console.warn(`essai ${attempt} refusé (${detail})`);
}
if (!structured) fail(`structuration non confirmée (${detail})`);

const audio = readFileSync(new URL('../fixtures/dictee.wav', import.meta.url));
const heard = await ai.stt.transcribe({
  audio: new Uint8Array(audio),
  mimeType: 'audio/wav',
  language: 'fr',
});
const text = heard.text.toLocaleLowerCase('fr');
if (!/calme|chambre|pansement/.test(text)) fail(`transcription inattendue : ${heard.text}`);
console.info(`transcription ${ai.stt.id} : ${heard.text}`);
