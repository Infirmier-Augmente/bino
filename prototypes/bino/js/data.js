// Comptes de démo. Les patients viennent de l'API, jamais d'une liste locale.
export const NURSES = ['Martine Dubois · IDE', 'Sophie Lemoine · IDE', 'Karim Haddad · IDE'];
export const DEFAULT_NURSE = NURSES[0];

export const EXAMPLES = [
  {
    label: 'M. Durand, extubation',
    text: 'Box 12, monsieur Durand. Il a été extubé vers 10h, sous lunettes à 3 litres, sécrétions sèches. Vers 16h il était agité, il a arraché sa sonde, l’interne est prévenu.',
  },
  {
    label: 'Mme Bernard, fièvre',
    text: 'Box 10, madame Bernard. Toujours intubée, FiO2 à 40. Elle a fait 38,9 à 8h, hémocultures prélevées, l’interne est prévenu.',
  },
];

export function seed() {
  return { patients: [] };
}
