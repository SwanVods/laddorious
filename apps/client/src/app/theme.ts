// Tangerine Dusk colours used from TypeScript (spec #2 §7.4). HUD colours are CSS custom
// properties in theme.css; the rest of the 3D world's tokens join this file in Phase 4.

/** Seat colours: coral for you, then the three bots in seat order. */
export const SEAT_COLORS = {
  you: '#ff5470',
  bots: ['#3b82f6', '#a3e635', '#8b5cf6'],
} as const;

/** The board (spec #2 §6.1): classic squares repeating diagonally, purple "?" squares with a rarity glyph, a gold last tile, dark slides. */
export const BOARD_COLORS = {
  squares: ['#ff5a5f', '#ffa22e', '#ffd83b', '#4fd16a', '#4a9dff'],
  mystery: '#8f4dff',
  rarity: { common: '#ffffff', rare: '#6ff3ff', epic: '#ffcc33' },
  goal: '#ffcc33',
  slide: '#2a2140',
} as const;
