import type { News2Tone } from '@/lib/vitals';

/**
 * DESIGN TOKENS — identité « Bino » (prototype `.reference/demo/prototypes/bino`, valeurs effectives).
 * Thème clair uniquement. Magenta = marque et action principale ; rouge / jaune / vert réservés
 * à la priorité (onglet Transmissions › Tous), toujours doublés du libellé « Priorité n ».
 */
export const colors = {
  navy: '#002244',
  magenta: '#FF0066',
  magentaPress: '#D6005A',
  sky: '#5BB8F0',
  skyLight: 'rgba(91,184,240,0.18)',
  white: '#FFFFFF',
  /** Texte secondaire. */
  sec: '#5F5F5F',
  line: 'rgba(0,34,68,0.1)',
  fieldBorder: '#C3CCD5',
  focus: '#9FD3F6',
  tableLine: '#EEF1F4',
  chip: '#EDF0F3',
  disabled: '#C9CED4',
  pressed: '#F5F7F9',
  iconPressed: '#E8EBEE',
  overlay: 'rgba(0,20,40,0.45)',
  success: '#13804A',
  successSoft: 'rgba(34,181,115,0.14)',
  footLine: 'rgba(0,34,68,0.08)',
  shellLine: 'rgba(0,34,68,0.06)',
  /** Ton « question » (manque à préciser, bandeaux d'avertissement). */
  warn: '#9A4A06',
  warnSoft: '#FDF1E3',
  error: '#DC0000',
} as const;

/** Points NEWS2 : 0 gris, 1 jaune, 2 orange, 3 rouge (aide au calcul, pas un verdict). */
export const NEWS2_COLORS: Record<News2Tone, string> = {
  none: colors.sec,
  low: '#F5B700',
  mid: '#F57C00',
  high: '#DC0000',
};

/** Couleurs de priorité (« Priorité 1 » à « Priorité 4 »). P1 et P2 partagent le rouge du prototype. */
export const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, { fill: string; text: string; ink: string }> = {
  1: { fill: '#DC0000', text: '#FFFFFF', ink: '#DC0000' },
  2: { fill: '#DC0000', text: '#FFFFFF', ink: '#DC0000' },
  3: { fill: '#F5B700', text: '#1A1A1A', ink: '#8A6500' },
  4: { fill: '#1B8A4A', text: '#FFFFFF', ink: '#1B8A4A' },
};

export const fonts = {
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_500Medium',
  bodyBold: 'Nunito_700Bold',
  displaySemi: 'PlusJakartaSans_600SemiBold',
  display: 'PlusJakartaSans_700Bold',
} as const;

/** Échelle typographique (tailles / interlignes du prototype). */
export const type = {
  h1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.56 },
  listTitle: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 22, letterSpacing: -0.36 },
  hello: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30 },
  patientName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24 },
  sheetName: { fontFamily: fonts.display, fontSize: 20, lineHeight: 30 },
  popupTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  composer: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25 },
  field: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  button: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  buttonSm: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 22 },
  bullet: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  toast: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21 },
  sub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  table: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  tableStrong: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  chip: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  foot: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  source: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  tiny: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14 },
  tab: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 13 },
} as const;

export type TypeVariant = keyof typeof type;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

/** Colonne centrée de l'app sur grand écran (pas de vue « PC » distincte). */
export const COLUMN_MAX_WIDTH = 440;
/** Cible tactile minimale. */
export const MIN_TOUCH = 44;
