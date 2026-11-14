// Score NEWS2 (Royal College of Physicians, 2017), échelle SpO2 n°1.
// Démo hackathon : l'infirmier garde toujours le dernier mot.

export const LV = {
  faible: { l: 'Faible', bg: '#13804A', fg: '#fff', bar: '#1E9E5A' },
  moyen: { l: 'Moyen', bg: '#F5B700', fg: '#002244', bar: '#F5B700' },
  eleve: { l: 'Élevé', bg: '#C2410C', fg: '#fff', bar: '#F07C00' },
  critique: { l: 'Critique', bg: '#C8102E', fg: '#fff', bar: '#E00000' },
};

export function news2(v) {
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
  const any3 = Object.values(p).some((x) => x === 3);
  // Convention de la démo : ≥7 critique, 5-6 élevé, 3-4 ou un paramètre à 3 moyen, sinon faible.
  const level =
    total >= 7 ? 'critique' : total >= 5 ? 'eleve' : total >= 3 || any3 ? 'moyen' : 'faible';
  return { p, total, level };
}
