// Dictée et lecture à voix haute.
// Dans Claude : capacités « dictation » et « tts ». Ailleurs : Web Speech API du navigateur
// (Chrome Android/ordinateur, Safari iOS). Toujours une saisie au clavier en secours.

let cd = null,
  ctts = null;
const SR =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
let h = null,
  rec = null,
  wired = false,
  wiredT = false,
  speaking = false,
  onSpeak = null;

export async function init() {
  if (window.claude?.use) {
    const [d, t] = await Promise.all([
      window.claude.use('dictation').catch(() => null),
      window.claude.use('tts').catch(() => null),
    ]);
    cd = d;
    ctts = t;
  }
}

export const canDictate = () => !!(cd || SR);
export const canSpeak = () =>
  !!(ctts || (typeof window !== 'undefined' && 'speechSynthesis' in window));

// À appeler directement depuis le clic (rien d'attendu avant).
export function start(handlers) {
  h = handlers;
  if (cd) {
    if (!wired) {
      cd.onPartial(({ text }) => h?.onPartial?.(text));
      cd.onFinal(({ text }) => h?.onFinal?.(text));
      cd.onState(({ state }) => {
        if (state === 'idle' && h && h.onEnd) h.onEnd();
      });
      wired = true;
    }
    return cd.start().catch((e) => {
      h?.onError?.(e);
      h?.onEnd?.();
    });
  }
  if (SR) {
    rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) h?.onFinal?.(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      h?.onPartial?.(interim);
    };
    rec.onerror = (e) =>
      h?.onError?.({ code: e.error === 'not-allowed' ? 'not_granted' : e.error });
    rec.onend = () => h?.onEnd?.();
    try {
      rec.start();
    } catch (e) {
      h?.onError?.(e);
    }
    return Promise.resolve();
  }
  return Promise.reject({ code: 'unavailable' });
}

export function stop() {
  if (cd) return cd.stop().catch(() => {});
  if (rec) {
    try {
      rec.stop();
    } catch (_e) {
      /* déjà arrêté */
    }
  }
  return Promise.resolve();
}

export function onSpeakingChange(fn) {
  onSpeak = fn;
}
export const isSpeaking = () => speaking;
const setSpeaking = (s) => {
  speaking = s;
  onSpeak?.(s);
};

export function speak(text) {
  if (ctts) {
    if (!wiredT) {
      ctts.onState(({ state }) => setSpeaking(state === 'speaking' || state === 'paused'));
      wiredT = true;
    }
    return ctts.speak(text, { language: 'fr' }).catch(() => setSpeaking(false));
  }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith('fr'));
    if (v) u.voice = v;
    u.onend = u.onerror = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setSpeaking(true);
  }
  return Promise.resolve();
}

export function stopSpeaking() {
  if (ctts) ctts.stop();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  setSpeaking(false);
}
