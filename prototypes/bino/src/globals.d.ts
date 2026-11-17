// Dictée Claude (capacité de l'app) et Web Speech, absents du lib DOM standard.

interface BinoDictation {
  onPartial(cb: (e: { text?: string }) => void): void;
  onFinal(cb: (e: { text?: string }) => void): void;
  onState(cb: (e: { state?: string }) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}

interface BinoTts {
  onState(cb: (e: { state?: string }) => void): void;
  speak(text: string, opts: { language: string }): Promise<void>;
  stop(): void;
}

interface BinoRec extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: BinoRecEvent) => void) | null;
  onerror: ((ev: BinoRecError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface BinoRecEvent extends Event {
  resultIndex: number;
  results: BinoRecResultList;
}

interface BinoRecResultList {
  length: number;
  [index: number]: BinoRecResult | undefined;
}

interface BinoRecResult {
  isFinal: boolean;
  [index: number]: { transcript: string } | undefined;
}

interface BinoRecError extends Event {
  error: string;
}

interface Window {
  SpeechRecognition?: new () => BinoRec;
  webkitSpeechRecognition?: new () => BinoRec;
  claude?: {
    use(name: string): Promise<BinoDictation | BinoTts | null>;
  };
}
