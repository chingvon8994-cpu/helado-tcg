import type { Element, SceneKey } from './types';

export interface ElementMeta {
  label: string;
  color: string; // primary UI colour
  dark: string;
  light: string;
  glyph: string; // single-character fallback glyph
  scene: SceneKey; // default illustration scene
  /** Default weakness used when building cards of this element. */
  weakTo?: Element;
}

export const ELEMENT_META: Record<Element, ElementMeta> = {
  verdant: { label: 'Verdant', color: '#3fbf4a', dark: '#1d6b2a', light: '#c9f5b8', glyph: '❦', scene: 'meadow', weakTo: 'blaze' },
  blaze: { label: 'Blaze', color: '#ff6a1f', dark: '#9b2a08', light: '#ffd2a8', glyph: '✹', scene: 'volcano', weakTo: 'tide' },
  tide: { label: 'Tide', color: '#2d8cff', dark: '#103f8f', light: '#bfe1ff', glyph: '≋', scene: 'reef', weakTo: 'volt' },
  volt: { label: 'Volt', color: '#ffc21a', dark: '#946300', light: '#fff0b0', glyph: 'ϟ', scene: 'storm', weakTo: 'brawl' },
  psyche: { label: 'Psyche', color: '#e04fd8', dark: '#6f1a7b', light: '#f7c8f4', glyph: '◉', scene: 'aurora', weakTo: 'shade' },
  brawl: { label: 'Brawl', color: '#c4692d', dark: '#5f2c10', light: '#f3cfa9', glyph: '✊', scene: 'canyon', weakTo: 'psyche' },
  shade: { label: 'Shade', color: '#6c4bb5', dark: '#2a1a52', light: '#d3c6f2', glyph: '☾', scene: 'grotto', weakTo: 'brawl' },
  alloy: { label: 'Alloy', color: '#7f9aa6', dark: '#34474f', light: '#dde8ec', glyph: '⬢', scene: 'foundry', weakTo: 'blaze' },
  wyrm: { label: 'Wyrm', color: '#c99a2e', dark: '#5a3f0b', light: '#f5e2a8', glyph: '⟁', scene: 'skyruins' },
  neutral: { label: 'Neutral', color: '#cfc6b8', dark: '#6d6457', light: '#f5f0e8', glyph: '✦', scene: 'parlor', weakTo: 'brawl' },
};
