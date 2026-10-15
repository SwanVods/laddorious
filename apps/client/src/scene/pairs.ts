import type { Jump } from '@laddorious/core';
import { PAIR_COLORS } from '../app/theme';

/** The symbols that pair a jump's start with its end (spec #5 A13), drawn by `symbolGeometry`. */
export const SYMBOLS = ['circle', 'triangle', 'square', 'diamond', 'heart', 'plus', 'moon', 'bolt'] as const;
export type SymbolName = (typeof SYMBOLS)[number];

export interface PairStyle {
  colour: string;
  symbol: SymbolName;
}

/** Creation order: the board's own jumps (j1, j2…), then card-made ones (x1, x2…). */
function rank(id: string): [number, number, string] {
  const match = /^([a-z]+)(\d+)$/.exec(id);
  return match ? [match[1] === 'j' ? 0 : 1, Number(match[2]), id] : [2, 0, id];
}

function byCreation(a: Jump, b: Jump): number {
  const [ka, na, ia] = rank(a.id);
  const [kb, nb, ib] = rank(b.id);
  return ka - kb || na - nb || (ia < ib ? -1 : ia > ib ? 1 : 0);
}

/** A small, stable string hash (FNV-1a), so each jump starts its search somewhere of its own. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * Each jump's colour and symbol (spec #5 A13): unique on the board while combinations last, portals
 * (slides) only on the light colours. Jumps take their style in creation order, so a card adding a
 * jump never changes the others'; the same jumps always get the same styles. Jumps in `known` (the styles
 * already shown) keep theirs, so a card removing a jump never shifts another (2026-10-15).
 */
export function pairStyles(jumps: readonly Jump[], known: ReadonlyMap<string, PairStyle> = new Map()): Map<string, PairStyle> {
  const taken = new Set<string>();
  const styles = new Map<string, PairStyle>();
  const ordered = [...jumps].sort(byCreation);
  for (const jump of ordered) {
    const style = known.get(jump.id);
    if (!style || taken.has(`${style.colour} ${style.symbol}`)) continue;
    taken.add(`${style.colour} ${style.symbol}`);
    styles.set(jump.id, style);
  }
  for (const jump of ordered) {
    if (styles.has(jump.id)) continue;
    const colours = jump.to < jump.from ? PAIR_COLORS.portal : PAIR_COLORS.ladder;
    const count = colours.length * SYMBOLS.length;
    const start = hash(jump.id) % count;
    let style: PairStyle | null = null;
    for (let step = 0; step < count && !style; step++) {
      // Walk symbols first, so neighbouring picks differ in colour as well as shape.
      const n = (start + step) % count;
      const candidate = { colour: colours[n % colours.length]!, symbol: SYMBOLS[Math.floor(n / colours.length) % SYMBOLS.length]! };
      if (!taken.has(`${candidate.colour} ${candidate.symbol}`)) style = candidate;
    }
    // A board with more jumps than combinations repeats one; there's no better answer.
    style ??= { colour: colours[start % colours.length]!, symbol: SYMBOLS[start % SYMBOLS.length]! };
    taken.add(`${style.colour} ${style.symbol}`);
    styles.set(jump.id, style);
  }
  return styles;
}
