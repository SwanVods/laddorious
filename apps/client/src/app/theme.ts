// Tangerine Dusk colours used from TypeScript (spec #2 §7.4). HUD colours are CSS custom
// properties in theme.css; the board and the 3D world around it take their colours from here.

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

/** The 3D world around the board (spec #2 §6.1, §7.4): all values come from the Tangerine Dusk palette. */
export const WORLD_COLORS = {
  sky: ['#0b4a5a', '#2f8f8a', '#ffc184'],
  fog: '#ffc79a',
  islandTop: '#ffb070',
  islandRock: '#0f5d63',
  bumper: ['#ff5470', '#5ff0c5'],
  cloud: '#fff7ec',
  ink: '#0f2e36',
  crown: '#ffcc33',
  pad: '#5ff0c5',
  chevron: '#ff5470',
  die: '#fff7ec',
  pip: '#0f2e36',
  orb: '#5ff0c5',
  shield: '#6ff3ff',
  ring: '#ffcc33',
} as const;
