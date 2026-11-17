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
  onSpeak = null,
  want = false;

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
    want = true;
    listen();
    return Promise.resolve();
  }
  return Promise.reject({ code: 'unavailable' });
}

// Chrome coupe la session tout seul. On la relance tant que le bouton reste allumé,
// et on garde la phrase entendue même si elle n'a pas été marquée finale.
function listen() {
  if (!want || !SR) return;
  const current = new SR();
  rec = current;
  let interim = '';
  current.lang = 'fr-FR';
  current.interimResults = true;
  current.continuous = true;
  current.onresult = (e) => {
    let pending = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const text = r[0].transcript.trim();
      if (!text) continue;
      if (r.isFinal) {
        interim = '';
        h?.onFinal?.(text);
      } else pending += `${text} `;
    }
    interim = pending.trim();
    if (interim) h?.onPartial?.(interim);
  };
  current.onerror = (e) => {
    const code = e.error;
    if (code === 'no-speech' || code === 'aborted') return;
    want = false;
    h?.onError?.({ code: code === 'not-allowed' ? 'not_granted' : code });
  };
  current.onend = () => {
    const pending = interim.trim();
    interim = '';
    if (pending) h?.onFinal?.(pending);
    if (rec !== current) return;
    if (want) {
      setTimeout(() => {
        if (want && rec === current) listen();
      }, 250);
      return;
    }
    h?.onEnd?.();
  };
  try {
    current.start();
  } catch (e) {
    want = false;
    h?.onError?.(e);
  }
}

export function stop() {
  want = false;
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
