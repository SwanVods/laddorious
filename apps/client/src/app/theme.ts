// Tangerine Dusk colours used from TypeScript (spec #2 §7.4). HUD colours are CSS custom
// properties in theme.css; the board and the 3D world around it take their colours from here.

/** Seat colours in seat order: pink, blue, lime, purple (spec #4 M10). Offline, you're always seat 0. */
export const SEAT_COLORS = ['#ff5470', '#3b82f6', '#a3e635', '#8b5cf6'] as const;

/** The board (spec #2 §6.1): classic squares repeating diagonally, purple "?" squares with a rarity glyph, a gold last tile, dark slides. */
export const BOARD_COLORS = {
  squares: ['#ff5a5f', '#ffa22e', '#ffd83b', '#4fd16a', '#4a9dff'],
  mystery: '#8f4dff',
  /** Rare gold, epic cyan (the user, 2026-10-17: swapped). */
  rarity: { common: '#ffffff', rare: '#ffcc33', epic: '#6ff3ff' },
  /** An epic "?" is a gradient, top to bottom, like an epic card's frame (2026-10-17). */
  epicGlyph: ['#6ff3ff', '#8f4dff'],
  goal: '#ffcc33',
  slide: '#2a2140',
} as const;

/** The 3D world around the board (spec #2 §6.1, §7.4): all values come from the Tangerine Dusk palette. */
export const WORLD_COLORS = {
  sky: ['#0b4a5a', '#2f8f8a', '#ffc184'],
  fog: '#ffc79a',
  /** Snakes and ladders while they're switched off (2026-10-16): stone grey. */
  jumpsOff: '#8f8a84',
  /** The platform's deck and the course's pads (board theme spec §3). */
  deck: '#fff7ec',
  /** The big brush strokes painted over the platform's deck and rim (the user, 2026-10-16). */
  paint: ['#ff7a1a', '#5ff0c5', '#ff5470', '#ffcc33', '#8f4dff', '#33d6ff', '#4a9dff', '#4fd16a'],
  /** The soft cushions under the platform and the pads. */
  cushion: '#ff9a3d',
  /** The platform's rim stripes, pink and cream. */
  rim: ['#ff5470', '#fff7ec'],
  /** The obstacle pads' rims. */
  course: '#5ff0c5',
  /** The hemisphere light's ground colour (was the island's rock). */
  groundLight: '#0f5d63',
  cloud: '#fff7ec',
  ink: '#0f2e36',
  crown: '#ffcc33',
  chevron: '#ff5470',
  die: '#fff7ec',
  pip: '#0f2e36',
  orb: '#5ff0c5',
  shield: '#6ff3ff',
  ring: '#ffcc33',
  /** A pad trail's base under its pair colour: the colour multiplies it, so the cream lights stay brighter. */
} as const;

/**
 * Pair colours (spec #5 A13, A16): a jump's start and end share one, with a matching symbol. All light and
 * from the Tangerine Dusk family, nothing near black (the user, Step 2 review 4); cream is left out so the
 * cream caps, portholes and symbols always stand out on them.
 */
const PAIR = { pink: '#ff4f9a', cyan: '#33d6ff', lime: '#b8f03c', peach: '#ffc184', violet: '#b48cff' } as const;
export const PAIR_COLORS = {
  all: PAIR,
  /** In the order pairs take them. */
  ladder: [PAIR.pink, PAIR.cyan, PAIR.lime, PAIR.peach, PAIR.violet],
  portal: [PAIR.pink, PAIR.cyan, PAIR.lime, PAIR.peach, PAIR.violet],
  /** The cap in a whirlpool's eye, under its symbol, and the splat's symbol. */
  cap: '#fff7ec',
  /** Round the cap's side: a warm edge, not ink. */
  capSide: '#ffc184',
  /** A part's deep side (the whirlpool's bowl, art/lib/palette.py SHADE): the pair colour makes it a deeper shade of itself. */
  shade: '#9a9a9a',
} as const;

/** The menu podium and its floating island (spec #2 §7.4 Podium tokens). */
export const PODIUM_COLORS = {
  top: '#fff3e3',
  band: '#ff9a3d',
  base: '#147676',
  ring: '#ff5470',
} as const;
