// Dictée et lecture à voix haute.
// Dans Claude : capacités « dictation » et « tts ». Ailleurs : Web Speech API du navigateur
// (Chrome Android/ordinateur, Safari iOS). Toujours une saisie au clavier en secours.

export type MicHandlers = {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onEnd?: () => void;
  onError?: (err: { code?: string; name?: string }) => void;
};

let cd: BinoDictation | null = null;
let ctts: BinoTts | null = null;
const Rec =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
    : undefined;
let h: MicHandlers | null = null;
let rec: BinoRec | null = null;
let wired = false;
let wiredT = false;
let speaking = false;
let onSpeak: ((on: boolean) => void) | null = null;
let want = false;

function isDictation(v: BinoDictation | BinoTts | null): v is BinoDictation {
  return !!v && 'onPartial' in v;
}
function isTts(v: BinoDictation | BinoTts | null): v is BinoTts {
  return !!v && 'speak' in v;
}
function asError(e: unknown): { code?: string; name?: string } {
  if (!e || typeof e !== 'object') return {};
  const err = e as { code?: unknown; name?: unknown };
  return {
    code: typeof err.code === 'string' ? err.code : undefined,
    name: typeof err.name === 'string' ? err.name : undefined,
  };
}

export async function init(): Promise<void> {
  if (window.claude?.use) {
    const [d, t] = await Promise.all([
      window.claude.use('dictation').catch(() => null),
      window.claude.use('tts').catch(() => null),
    ]);
    if (isDictation(d)) cd = d;
    if (isTts(t)) ctts = t;
  }
}

export const canDictate = (): boolean => !!(cd || Rec);

// Safari et l'iPhone transcrivent avec Apple. Chrome sur Mac envoie l'audio à Google,
// qui ne répond pas ici : on enregistre et le serveur transcrit.
export function useBrowserDictation(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|OPR\/|Android/.test(ua);
}

export const canRecord = (): boolean =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined';

let recorder: MediaRecorder | null = null;
let recStream: MediaStream | null = null;
let recChunks: Blob[] = [];
let opening: Promise<void> | null = null;

export function startRecording(): Promise<void> {
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) return Promise.reject(new Error('micro indisponible'));
  opening = devices
    .getUserMedia({ audio: true })
    .then((stream) => {
      recStream = stream;
      recChunks = [];
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const current = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorder = current;
      current.ondataavailable = (e) => {
        if (e.data.size) recChunks.push(e.data);
      };
      current.start();
    })
    .finally(() => {
      opening = null;
    });
  return opening;
}

export async function stopRecording(): Promise<Blob | null> {
  if (opening) {
    try {
      await opening;
    } catch {
      return null;
    }
  }
  const current = recorder;
  if (!current) return null;
  const blob = await new Promise<Blob | null>((resolve) => {
    current.onstop = () => {
      const type = current.mimeType || 'audio/webm';
      resolve(new Blob(recChunks, { type }));
    };
    if (current.state === 'inactive') {
      resolve(null);
      return;
    }
    current.stop();
  });
  recChunks = [];
  for (const track of recStream?.getTracks() ?? []) track.stop();
  recStream = null;
  recorder = null;
  return blob;
}

function cancelRecording(): void {
  const current = recorder;
  recorder = null;
  recChunks = [];
  for (const track of recStream?.getTracks() ?? []) track.stop();
  recStream = null;
  if (current && current.state !== 'inactive') {
    current.onstop = null;
    try {
      current.stop();
    } catch {
      /* déjà arrêté */
    }
  }
}
export const canSpeak = (): boolean =>
  !!(ctts || (typeof window !== 'undefined' && 'speechSynthesis' in window));

// À appeler directement depuis le clic (rien d'attendu avant).
export function start(handlers: MicHandlers): Promise<void> {
  h = handlers;
  if (cd) {
    if (!wired) {
      cd.onPartial(({ text }) => h?.onPartial?.(text ?? ''));
      cd.onFinal(({ text }) => h?.onFinal?.(text ?? ''));
      cd.onState(({ state }) => {
        if (state === 'idle' && h?.onEnd) h.onEnd();
      });
      wired = true;
    }
    return cd.start().catch((e: unknown) => {
      h?.onError?.(asError(e));
      h?.onEnd?.();
    });
  }
  if (Rec) {
    want = true;
    listen();
    return Promise.resolve();
  }
  return Promise.reject({ code: 'unavailable' });
}

// Chrome coupe la session tout seul. On la relance tant que le bouton reste allumé,
// et on garde la phrase entendue même si elle n'a pas été marquée finale.
function listen(): void {
  if (!want || !Rec) return;
  const current = new Rec();
  rec = current;
  let interim = '';
  current.lang = 'fr-FR';
  current.interimResults = true;
  current.continuous = true;
  current.onresult = (e) => {
    let pending = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      const alt = result?.[0];
      const text = alt?.transcript.trim() ?? '';
      if (!text || !result) continue;
      if (result.isFinal) {
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
    h?.onError?.(asError(e));
  }
}

export function stop(): Promise<void> {
  want = false;
  cancelRecording();
  if (cd) return cd.stop().catch(() => undefined);
  if (rec) {
    try {
      rec.stop();
    } catch {
      /* déjà arrêté */
    }
  }
  return Promise.resolve();
}

export function onSpeakingChange(fn: (on: boolean) => void): void {
  onSpeak = fn;
}
export const isSpeaking = (): boolean => speaking;
const setSpeaking = (s: boolean): void => {
  speaking = s;
  onSpeak?.(s);
};

export function speak(text: string): Promise<void> {
  if (ctts) {
    if (!wiredT) {
      ctts.onState(({ state }) => setSpeaking(state === 'speaking' || state === 'paused'));
      wiredT = true;
    }
    return ctts.speak(text, { language: 'fr' }).catch(() => {
      setSpeaking(false);
    });
  }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith('fr'));
    if (v) u.voice = v;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
    setSpeaking(true);
  }
  return Promise.resolve();
}

export function stopSpeaking(): void {
  if (ctts) ctts.stop();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  setSpeaking(false);
}
