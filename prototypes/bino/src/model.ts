// Formes du site. L'API reste la source des patients ; ces types décrivent ce que l'écran affiche.

export type Level = 'critique' | 'eleve' | 'moyen' | 'stable';
export type NewsLevel = 'critique' | 'eleve' | 'moyen';

export type Vitals = {
  fr: number;
  spo2: number;
  o2: boolean;
  pas: number;
  pad: number;
  fc: number;
  temp: number;
  cons: string;
  at?: string;
  src?: string;
};

export type NewsParts = {
  fr: number;
  spo2: number;
  o2: number;
  pas: number;
  fc: number;
  temp: number;
  cons: number;
};

export type NewsScore = {
  p: NewsParts;
  total: number;
  level: NewsLevel;
};

export type SourceRef = { cr: string; q: string };
export type Point = { t: string; src: SourceRef[] };

export type Cible = {
  c: string;
  D?: Point;
  A?: Point;
  R?: Point;
};

export type Synth = {
  points?: Point[];
  resume: Point | null;
  cibles: Cible[];
  todo: Point[];
  soins?: string[];
  engine?: string;
  ver?: number;
  crIds?: string[];
  at?: string;
  t?: string;
};

export type Cr = {
  id: string;
  pid: string;
  text: string;
  at: string;
  t: string;
  byName: string;
  nurseId: string;
  review: string;
  pending?: boolean;
};

export type Device = { l: string; j: number };
export type Rx = { t: string; at: string };

export type Patient = {
  id: string;
  ch: string;
  nom: string;
  age: number;
  motif: string;
  atcd: string;
  allergies: string;
  precautions: string;
  famille: string;
  taches: string[];
  disp: Device[];
  rx: Rx | null;
  v: Vitals;
};

export type Ward = { patients: Patient[] };

export type PrioItem = { id: string; niveau?: string; level?: string; raison?: string };

export type PrioAI = { order: PrioItem[]; engine: string; sig: string };

export type PrioState = { ai: PrioAI | null; manual: Record<string, string> };

export type Snapshot = {
  cr: Cr[];
  syn: Record<string, Synth>;
  prio: PrioState;
};

export type Example = { label: string; text: string; pid?: string };

export type Staff = { matricule: string; password: string; name: string };

export type Settings = {
  name: string;
  matricule: string;
  sortBy: string;
  trSort: string;
};

export type Tab = 'patients' | 'transmissions';
export type TrScope = 'mine' | 'all';
export type SortKey = 'chambre' | 'nom' | 'prio';

export type Ui = {
  tab: Tab;
  pid: string | null;
  sub: 'vitals' | null;
  draft: string;
  foldOpen: boolean;
  listening: string | null;
  capture: 'server' | null;
  saving: boolean;
  syncing: boolean;
  trScope: TrScope;
  lvlOpen: string | null;
  docBusy: string;
  sumBusy: string;
  triBusy: boolean;
  sortBy: 'chambre' | 'nom';
  trSort: SortKey;
  trQuery: string;
  loginError: string;
  loginId: string;
  justIn: boolean;
};

export type DocMeta = {
  date: string;
  time: string;
  author: string;
  service: string;
  authorOf: (c: Cr) => string;
};

export type DocInput = {
  p: Patient;
  v: Vitals;
  level?: string;
  crs: Cr[];
  syn: Synth | null;
};

export type DocRow = DocInput & { n: NewsScore; lv: Level };

export type DocModel = DocMeta & {
  rows: DocRow[];
  crCount: number;
  nurses: string[];
  attention: DocRow[];
};

export type TriageItem = { p: Patient; v: Vitals; crs?: Cr[] };
export type TriageRow = { id: string; niveau: Level; raison: string };
