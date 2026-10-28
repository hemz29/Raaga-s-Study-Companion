import type { WorldId } from '../types';

export interface World {
  id: WorldId;
  name: string;
  tagline: string;
  description: string;
  home: string; // name of the creature's home
  eggWord: string;
  palette: { body: string; belly: string; accent: string; egg: string; eggSpots: string };
}

export const WORLDS: Record<WorldId, World> = {
  emberwick: {
    id: 'emberwick',
    name: 'Emberwick Academy',
    tagline: 'Cosy and mysterious',
    description: 'A hidden school in an old clock tower. Candlelit libraries, creaking stairs and a creature nursery in the cellar.',
    home: 'the cellar nursery',
    eggWord: 'ember-egg',
    palette: { body: '#d9774b', belly: '#f6d7a7', accent: '#7a2e3a', egg: '#f3d9a4', eggSpots: '#b5652e' },
  },
  lumenwood: {
    id: 'lumenwood',
    name: 'Lumenwood Sanctuary',
    tagline: 'Gentle and wondrous',
    description: 'A glowing forest where creatures are born from light-seeds, among fireflies and lantern trees.',
    home: 'the lantern grove',
    eggWord: 'light-seed',
    palette: { body: '#5fbf9f', belly: '#e6f7c8', accent: '#2c6e63', egg: '#e9f8d2', eggSpots: '#7fcf8f' },
  },
  drift: {
    id: 'drift',
    name: 'The Drift Isles',
    tagline: 'Adventurous and open',
    description: 'Floating islands linked by rope bridges, drifting through a pastel sky.',
    home: 'the cloud nest',
    eggWord: 'sky-egg',
    palette: { body: '#8fa8ff', belly: '#fde7f1', accent: '#5b4bb5', egg: '#fdeaf3', eggSpots: '#a7b8ff' },
  },
};
