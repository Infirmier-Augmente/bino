import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './api-url';
import { chooseDictationEngine } from './dictation-engine';

describe('resolveApiUrl', () => {
  const none = { override: null, envUrl: undefined, webHostname: null, expoHostUri: null };
  it('priorité au réglage manuel, puis à la variable d’environnement', () => {
    expect(resolveApiUrl({ ...none, override: 'http://10.0.0.5:8787/', envUrl: 'http://x' })).toBe(
      'http://10.0.0.5:8787',
    );
    expect(resolveApiUrl({ ...none, envUrl: 'https://api.demo.fr' })).toBe('https://api.demo.fr');
  });
  it('devine l’hôte en web et en développement natif', () => {
    expect(resolveApiUrl({ ...none, webHostname: '192.168.1.20' })).toBe(
      'http://192.168.1.20:8787',
    );
    expect(resolveApiUrl({ ...none, expoHostUri: '192.168.1.30:8081' })).toBe(
      'http://192.168.1.30:8787',
    );
    expect(resolveApiUrl(none)).toBe('http://localhost:8787');
  });
});

describe('chooseDictationEngine', () => {
  it('la transcription serveur prime sur celle du navigateur dès qu’elle est configurée', () => {
    expect(chooseDictationEngine({ serverSttReady: true, webSpeechAvailable: true })).toBe(
      'server',
    );
    expect(chooseDictationEngine({ serverSttReady: true, webSpeechAvailable: false })).toBe(
      'server',
    );
  });
  it('sans transcription serveur : navigateur, sinon clavier', () => {
    expect(chooseDictationEngine({ serverSttReady: false, webSpeechAvailable: true })).toBe(
      'web-speech',
    );
    expect(chooseDictationEngine({ serverSttReady: false, webSpeechAvailable: false })).toBe(
      'keyboard',
    );
  });
});
