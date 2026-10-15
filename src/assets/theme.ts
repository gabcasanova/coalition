/**
 * The look of the 3D table: colours and fonts. (Interface colours live in the CSS variables of styles/base.css;
 * the colours of squares, decks and parties live with their data in src/data.)
 */
export const THEME = {
  /** Fonts used when text is painted onto textures. */
  font: '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
  emojiFont: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',

  background: 0x0a0e16,
  tableWood: 0x2a1c14,
  tableFelt: 0x15301f,
  /** The gold ring the squares sit on. */
  ring: 0x8a6d2b,
  /** Gold trim: wheel rim, frames, deck borders, handrails. */
  gold: 0xe8c35a,
  benches: 0x2b3446,
  carpet: 0x7a1424,
  /** Seat colour of an empty / unassigned MP. */
  emptySeat: 0x5a6273,
  /** Positive and negative numbers (popularity changes, passed/vetoed headlines). */
  good: 0x4cd185,
  bad: 0xff6b6b,
};
