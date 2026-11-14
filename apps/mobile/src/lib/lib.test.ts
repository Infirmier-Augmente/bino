import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './api-url';
import { chooseDictationEngine } from './dictation-engine';
import { duration, plural, relative } from './format';
import { highlightSegments } from './highlight';

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

describe('format', () => {
  it('durées et pluriels', () => {
    expect(duration(42_500)).toBe('0:42');
    expect(plural(1, 'question')).toBe('1 question');
    expect(plural(3, 'question')).toBe('3 questions');
  });
  it('temps relatif', () => {
    const now = new Date('2026-11-14T16:00:00+01:00');
    expect(relative('2026-11-14T15:55:00+01:00', now)).toBe('il y a 5 min');
    expect(relative('2026-11-14T13:30:00+01:00', now)).toBe('il y a 2 h');
    expect(relative('2026-11-14T08:05:00+01:00', now)).toBe('8h05');
  });
});

describe('highlightSegments', () => {
  it('marque les extraits cités et l’extrait actif', () => {
    const segs = highlightSegments(
      'abcdefghij',
      [
        { start: 2, end: 5 },
        { start: 7, end: 9 },
      ],
      { start: 7, end: 9 },
    );
    expect(segs).toEqual([
      { text: 'ab', mark: null },
      { text: 'cde', mark: 'source' },
      { text: 'fg', mark: null },
      { text: 'hi', mark: 'active' },
      { text: 'j', mark: null },
    ]);
  });
});
