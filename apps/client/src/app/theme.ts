// Tangerine Dusk colours used from TypeScript (spec #2 §7.4). HUD colours are CSS custom
// properties in theme.css; the board and the 3D world around it take their colours from here.

/** Seat colours in seat order: pink, blue, lime, purple (spec #4 M10). Offline, you're always seat 0. */
export const SEAT_COLORS = ['#ff5470', '#3b82f6', '#a3e635', '#8b5cf6'] as const;

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
  /** A pad trail's base under its pair colour: the colour multiplies it, so the cream lights stay brighter. */
  trailMask: '#a3a3a3',
} as const;

/**
 * Pair colours (spec #5 A13): a jump's start and end share one, with a matching symbol. Each reads on
 * every square colour with a dark rim. The dark ones are for ladders only: they vanish on a portal's dark bowl.
 */
const PAIR = { pink: '#ff4f9a', cyan: '#33d6ff', lime: '#b8f03c', cream: '#fff7ec', teal: '#0f5d63', plum: '#7a2e6e' } as const;
export const PAIR_COLORS = {
  all: PAIR,
  /** In the order pairs take them. */
  ladder: [PAIR.pink, PAIR.cyan, PAIR.lime, PAIR.cream, PAIR.teal, PAIR.plum],
  portal: [PAIR.pink, PAIR.cyan, PAIR.lime, PAIR.cream],
  /** The cap in a whirlpool's eye, under its symbol. */
  cap: PAIR.cream,
} as const;

/** The menu podium and its floating island (spec #2 §7.4 Podium tokens). */
export const PODIUM_COLORS = {
  top: '#fff3e3',
  band: '#ff9a3d',
  base: '#147676',
  ring: '#ff5470',
  island: '#0f5d63',
  chunk: '#ffb070',
} as const;
