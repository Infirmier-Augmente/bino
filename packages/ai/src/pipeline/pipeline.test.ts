import { describe, expect, it, vi } from 'vitest';
import { JevClassifier } from '../classifier/jev';
import type { Answers, ClassifierPort, Question } from '../classifier/port';
import { AiConfigError, aiConfigFromEnv } from '../config';
import { HeuristicEngine } from '../engine/heuristic/engine';
import { emptyRaw, type RawStructuring, type StructuringEngine } from '../engine/raw';
import { createAiServices } from '../services';
import { makePatientForTests } from '../testing';
import { assemble, sequentialIds } from './assemble';
import { resolvePatient } from './resolve-patient';
import { structureDictation } from './structure';

const DICTATION = 'Box 12, il a de la fièvre à 38,5, j’ai donné du paracétamol.';

describe('config', () => {
  it('fonctionne sans aucune clé (moteur heuristique)', () => {
    const c = aiConfigFromEnv({});
    expect(c.llm.provider).toBe('heuristic');
    expect(c.stt.provider).toBe('none');
    expect(c.classifier.provider).toBe('heuristic');
  });
  it('donne un modèle par défaut à DeepSeek et exige la clé', () => {
    expect(aiConfigFromEnv({ LLM_PROVIDER: 'deepseek', LLM_API_KEY: 'x' }).llm.model).toBe(
      'deepseek-chat',
    );
    expect(() => aiConfigFromEnv({ LLM_PROVIDER: 'deepseek' })).toThrow(AiConfigError);
    expect(() => aiConfigFromEnv({ LLM_PROVIDER: 'openai', LLM_API_KEY: 'x' })).toThrow(
      /LLM_MODEL/,
    );
    expect(() => aiConfigFromEnv({ CLASSIFIER_PROVIDER: 'jev' })).toThrow(/JEV_API_KEY/);
  });
  it('utilise OpenRouter dès que OPENROUTER_API_KEY est renseignée', () => {
    const c = aiConfigFromEnv({ OPENROUTER_API_KEY: 'sk-or-test' });
    expect(c.llm.provider).toBe('openai-compatible');
    expect(c.llm.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(c.llm.model).toBe('deepseek/deepseek-chat');
    expect(c.llm.apiKey).toBe('sk-or-test');
    expect(aiConfigFromEnv({ OPENROUTER_API_KEY: ' ' }).llm.provider).toBe('heuristic');
    expect(
      aiConfigFromEnv({
        OPENROUTER_API_KEY: 'sk-or-test',
        OPENROUTER_MODEL: 'deepseek/deepseek-v3',
      }).llm.model,
    ).toBe('deepseek/deepseek-v3');
  });
});

describe('assemble (porte anti-invention)', () => {
  it('écarte une phrase dont l’extrait n’existe pas ou dont le chiffre change', () => {
    const raw: RawStructuring = {
      ...emptyRaw(),
      targets: [
        {
          label: 'Hyperthermie',
          appareil: 'general',
          data: [
            { text: 'Fièvre à 38,5.', quote: 'il a de la fièvre à 38,5' },
            { text: 'Frissons.', quote: 'il tremble beaucoup' },
            { text: 'Fièvre à 39.', quote: 'fièvre à 38,5' },
          ],
          actions: [{ text: 'Paracétamol administré.', quote: 'j’ai donné du paracétamol' }],
          results: [],
        },
      ],
    };
    const r = assemble(raw, 't1', DICTATION, sequentialIds());
    expect(r.content.targets[0]?.data.map((d) => d.text)).toEqual(['Fièvre à 38,5.']);
    expect(r.rejected.map((x) => x.reason)).toEqual(['quote-not-found', 'number-mismatch']);
    expect(r.flags.map((f) => f.kind)).toEqual(['missing-result']);
  });
});

describe('structureDictation', () => {
  const failing: StructuringEngine = {
    id: 'deepseek:deepseek-chat',
    structure: () => Promise.reject(new Error('503 Service Unavailable')),
  };

  it('bascule sur le moteur local et le signale', async () => {
    const warn = vi.fn();
    const out = await structureDictation(
      't1',
      { transcript: DICTATION, mode: 'transmission', patient: null },
      { primary: failing, fallback: new HeuristicEngine(), timeoutMs: 1000, logger: { warn } },
    );
    expect(out.degraded).toBe(true);
    expect(out.engine).toBe('heuristic');
    expect(out.error).toMatch(/503/);
    expect(out.content.targets[0]?.label).toBe('Hyperthermie');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('remonte l’erreur si aucun repli n’est configuré', async () => {
    await expect(
      structureDictation(
        't1',
        { transcript: DICTATION, mode: 'transmission', patient: null },
        { primary: failing, fallback: null, timeoutMs: 1000 },
      ),
    ).rejects.toThrow(/503/);
  });
});

describe('createAiServices avec un faux LLM', () => {
  it('utilise le LLM puis note la gravité via le lexique', async () => {
    const raw: RawStructuring = {
      ...emptyRaw(),
      targets: [
        {
          label: 'Hyperthermie',
          appareil: 'general',
          data: [{ text: 'Fièvre à 38,5.', quote: 'il a de la fièvre à 38,5' }],
          actions: [],
          results: [],
        },
      ],
    };
    const llm = { id: 'fake:model', generateStructured: vi.fn(async () => raw) };
    const ai = createAiServices(aiConfigFromEnv({}), { llm: llm as never });
    const out = await ai.structure('t1', {
      transcript: DICTATION,
      mode: 'transmission',
      patient: null,
    });
    expect(out.engine).toBe('fake:model');
    expect(out.content.targets[0]?.severity?.level).toBe('surveillance');
    expect(ai.status('1.0').llm.fallback).toBe('heuristic');
  });
});

describe('JevClassifier', () => {
  it('envoie le format TypeSafe et lit les réponses', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        questions: Record<string, { type: string; criteria: unknown }>;
      };
      expect(body.questions.patient?.type).toBe('choice');
      expect(body.questions.gravite?.criteria).toEqual(['faible', 'forte']);
      return new Response(
        JSON.stringify({
          model: 'jev-1.14.0',
          answers: {
            patient: {
              type: 'choice',
              choice: 'p12',
              confidence: 0.9,
              probabilities: { p12: 0.95, p14: 0.05 },
            },
            gravite: {
              type: 'score',
              score: 1.2,
              confidence: 0.4,
              legend: {},
              probabilities: { '0': 0.2, '1': 0.8 },
            },
            urgent: { type: 'noul', noul: 0.12 },
          },
          usage: { input_tokens: 10, output_tokens: 3 },
        }),
        { status: 200 },
      );
    });
    const jev = new JevClassifier(
      {
        provider: 'jev',
        jevApiKey: 'k',
        jevModel: 'jev-latest',
        jevBaseUrl: 'https://api.typesafe.ai',
      },
      fetchMock as unknown as typeof fetch,
    );
    const a = await jev.ask(
      { dictee: 'box 12' },
      {
        patient: {
          type: 'choice',
          instructions: 'Quel patient ?',
          options: { p12: 'box 12', p14: 'box 14' },
        },
        gravite: { type: 'score', instructions: 'Gravité ?', levels: ['faible', 'forte'] },
        urgent: { type: 'noul', instructions: 'Urgent ?' },
      },
    );
    expect(a.patient.choice).toBe('p12');
    expect(a.gravite.score).toBe(1.2);
    expect(a.urgent.probability).toBe(0.12);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.typesafe.ai/v1/systemone');
  });

  it('réessaie après un 429', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls++;
      if (calls === 1) return new Response('{}', { status: 429, headers: { 'retry-after': '0' } });
      return new Response(
        JSON.stringify({ model: 'jev', answers: { u: { type: 'noul', noul: 0.9 } } }),
        { status: 200 },
      );
    });
    const jev = new JevClassifier(
      { provider: 'jev', jevApiKey: 'k', jevModel: 'jev-latest', jevBaseUrl: 'https://x' },
      fetchMock as unknown as typeof fetch,
    );
    const a = await jev.ask({}, { u: { type: 'noul', instructions: '?' } });
    expect(a.u.probability).toBe(0.9);
    expect(calls).toBe(2);
  });
});

describe('resolvePatient', () => {
  const patients = [
    makePatientForTests({ id: 'p8', room: '8', lastName: 'Martin', sex: 'M' }),
    makePatientForTests({ id: 'p9', room: '9', lastName: 'Martins', sex: 'F' }),
  ];
  const semantic = (choice: string, confidence: number): ClassifierPort => ({
    id: 'fake-jev',
    semantic: true,
    ask: async <Qs extends Record<string, Question>>() =>
      ({
        patient: { type: 'choice', choice, confidence, probabilities: {} },
      }) as unknown as Answers<Qs>,
  });

  it('le classifieur départage les ambiguïtés quand il est confiant', async () => {
    const r = await resolvePatient('Martin a vomi', patients, {
      classifier: semantic('p8', 0.9),
      ageOf: () => 70,
    });
    expect(r.status).toBe('resolved');
    expect(r.patientId).toBe('p8');
    expect(r.method).toBe('regles+fake-jev');
  });

  it('on demande à l’IDE quand le classifieur hésite', async () => {
    const r = await resolvePatient('Martin a vomi', patients, {
      classifier: semantic('p8', 0.3),
      ageOf: () => 70,
    });
    expect(r.status).toBe('ambiguous');
  });
});
