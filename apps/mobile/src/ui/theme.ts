import type { PriorityLevel } from '@infirmier/domain';

/**
 * DESIGN TOKENS — source unique des couleurs, typo, espacements.
 * Règles (voir docs/DESIGN.md) :
 *  - fond calme, encre très lisible, UN accent (pétrole) pour l'action principale ;
 *  - rouge d'enregistrement réservé au micro ;
 *  - couleurs de triage réservées au triage, toujours doublées d'un libellé ;
 *  - pas de dégradé, pas d'ombre portée large, pas de verre dépoli.
 * Le thème sombre n'est pas cosmétique : il sert l'équipe de nuit.
 */

export interface Palette {
  bg: string;
  surface: string;
  surfaceMuted: string;
  surfacePressed: string;
  border: string;
  borderStrong: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  accent: string;
  accentPressed: string;
  onAccent: string;
  accentSoft: string;
  record: string;
  onRecord: string;
  recordSoft: string;
  question: string;
  questionSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  highlight: string;
  overlay: string;
  triage: Record<PriorityLevel, { fg: string; bg: string; swatch: string }>;
}

export const light: Palette = {
  bg: '#F3F5F4',
  surface: '#FFFFFF',
  surfaceMuted: '#E9EEEC',
  surfacePressed: '#DCE3E1',
  border: '#D3DBD8',
  borderStrong: '#A9B5B1',
  ink: '#14201E',
  inkMuted: '#46534F',
  inkSubtle: '#5F6D69',
  accent: '#0E5E58',
  accentPressed: '#0A4A45',
  onAccent: '#FFFFFF',
  accentSoft: '#DCEDEA',
  record: '#B3261E',
  onRecord: '#FFFFFF',
  recordSoft: '#F9E3E1',
  question: '#7A4A00',
  questionSoft: '#FFF0D4',
  success: '#1F6B36',
  successSoft: '#E1F1E5',
  danger: '#B3261E',
  highlight: '#FFE9A8',
  overlay: 'rgba(20,32,30,0.45)',
  triage: {
    rouge: { fg: '#A51C14', bg: '#FCE6E3', swatch: '#C62A1F' },
    orange: { fg: '#9A3D00', bg: '#FDEBDA', swatch: '#E06A10' },
    jaune: { fg: '#6E5300', bg: '#FFF3C4', swatch: '#E2B400' },
    vert: { fg: '#1F6B36', bg: '#E1F1E5', swatch: '#2E8B47' },
  },
};

export const dark: Palette = {
  bg: '#0E1413',
  surface: '#161F1E',
  surfaceMuted: '#1E2928',
  surfacePressed: '#263432',
  border: '#2A3735',
  borderStrong: '#41524F',
  ink: '#E5ECEA',
  inkMuted: '#AAB8B4',
  inkSubtle: '#8D9C98',
  accent: '#5DBBAF',
  accentPressed: '#4AA397',
  onAccent: '#06201D',
  accentSoft: '#183634',
  record: '#FF6F61',
  onRecord: '#2A0805',
  recordSoft: '#3A1714',
  question: '#F2C477',
  questionSoft: '#33270F',
  success: '#7FD39A',
  successSoft: '#15301F',
  danger: '#FF6F61',
  highlight: '#5A4A12',
  overlay: 'rgba(0,0,0,0.6)',
  triage: {
    rouge: { fg: '#FF9A90', bg: '#3A1714', swatch: '#F0574A' },
    orange: { fg: '#FFB37A', bg: '#3A230F', swatch: '#F08A3C' },
    jaune: { fg: '#F2D36B', bg: '#332A0C', swatch: '#E8C13A' },
    vert: { fg: '#8FD8A6', bg: '#14301E', swatch: '#4DB06C' },
  },
};

export const fonts = {
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  medium: 'AtkinsonHyperlegibleNext_500Medium',
  semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  mono: 'AtkinsonHyperlegibleMono_400Regular',
  monoBold: 'AtkinsonHyperlegibleMono_700Bold',
} as const;

/** Échelle typographique : contrastes nets entre niveaux (pas de hiérarchie plate). */
export const type = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36 },
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 22 },
  monoLarge: { fontFamily: fonts.monoBold, fontSize: 24, lineHeight: 28 },
} as const;

export type TypeVariant = keyof typeof type;

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

/** Largeur à partir de laquelle on passe en mise en page "poste de soins" (PC / tablette). */
export const WIDE_BREAKPOINT = 900;
export const CONTENT_MAX_WIDTH = 760;
/** Cible tactile minimale (gants, mouvement). */
export const MIN_TOUCH = 48;
