// Score NEWS2 (Royal College of Physicians, 2017), échelle SpO2 n°1.
// Démo hackathon : l'infirmier garde toujours le dernier mot.

import type { Level, NewsScore, Vitals } from './model.js';

type Palette = { l: string; bg: string; fg: string; bar: string };

// Priorité 1 rouge, 2 orange, 3 jaune, 4 vert.
export const LV: Record<Level, Palette> = {
  critique: { l: 'Critique', bg: '#DC0000', fg: '#fff', bar: '#DC0000' },
  eleve: { l: 'Élevé', bg: '#F57C00', fg: '#fff', bar: '#F57C00' },
  moyen: { l: 'Moyen', bg: '#F5B700', fg: '#1A1A1A', bar: '#F5B700' },
  stable: { l: 'Stable', bg: '#14804a', fg: '#fff', bar: '#14804a' },
};

export function news2(v: Vitals): NewsScore {
  const p = {
    fr: v.fr <= 8 ? 3 : v.fr <= 11 ? 1 : v.fr <= 20 ? 0 : v.fr <= 24 ? 2 : 3,
    spo2: v.spo2 <= 91 ? 3 : v.spo2 <= 93 ? 2 : v.spo2 <= 95 ? 1 : 0,
    o2: v.o2 ? 2 : 0,
    pas: v.pas <= 90 ? 3 : v.pas <= 100 ? 2 : v.pas <= 110 ? 1 : v.pas <= 219 ? 0 : 3,
    fc: v.fc <= 40 ? 3 : v.fc <= 50 ? 1 : v.fc <= 90 ? 0 : v.fc <= 110 ? 1 : v.fc <= 130 ? 2 : 3,
    temp: v.temp <= 35 ? 3 : v.temp <= 36 ? 1 : v.temp <= 38 ? 0 : v.temp <= 39 ? 1 : 2,
    cons: v.cons === 'A' ? 0 : 3,
  };
  const total = Object.values(p).reduce((a, b) => a + b, 0);
  // Trois niveaux : ≥7 critique, 5-6 élevé, le reste moyen.
  const level = total >= 7 ? 'critique' : total >= 5 ? 'eleve' : 'moyen';
  return { p, total, level };
}
