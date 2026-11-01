import type { ExpansionDef } from './types';

export const EXPANSIONS: ExpansionDef[] = [
  {
    id: 'genesis', code: 'GEN', name: 'Genesis', releaseOrder: 1, packPrice: 100,
    tagline: 'Where every scoop begins — the founding creatures of the Helado Region.',
    theme: { primary: '#ff7fb6', secondary: '#7a3d1d', accent: '#ffe0a3' },
    packArt: { featured: ['axoplazma', 'sabrine', 'spinoscope'], scene: 'sunburst' },
  },
  {
    id: 'wildfront', code: 'WLD', name: 'Wildfront', releaseOrder: 2, packPrice: 100,
    tagline: 'Untamed beasts from the jungle canopy to the scorched badlands.',
    theme: { primary: '#5fe3b5', secondary: '#1f4d3a', accent: '#ffcf5a' },
    packArt: { featured: ['mochattoa', 'antonarch', 'zangdrill'], scene: 'canyon' },
  },
  {
    id: 'celestial', code: 'CEL', name: 'Celestial', releaseOrder: 3, packPrice: 120,
    tagline: 'Legends of frost, stars and the endless night sky.',
    theme: { primary: '#8fb5ff', secondary: '#1a1d4a', accent: '#f3e6ff' },
    packArt: { featured: ['cipaclysm', 'gloomorgue', 'predtempest'], scene: 'starfield' },
  },
];
