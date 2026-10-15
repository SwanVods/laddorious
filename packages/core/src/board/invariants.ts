import { laneCenterline, lanesTouch } from './layout';
import type { Board } from './types';

/**
 * Hard board invariants (spec §5.7). They hold for generated boards and
 * after every card edit. Returns human-readable violations; empty = valid.
 */
export function boardViolations(board: Board): string[] {
  const out: string[] = [];
  const N = board.size;
  const starts = new Set<number>();

  for (const j of board.jumps) {
    if (j.from === j.to) out.push(`${j.id}: from equals to (${j.from})`);
    if (j.from < 1 || j.from > N - 1) out.push(`${j.id}: from ${j.from} outside 1..${N - 1}`);
    if (j.to < 1 || j.to > N - 1) out.push(`${j.id}: to ${j.to} outside 1..${N - 1}`);
    if (starts.has(j.from)) out.push(`${j.id}: second jump starting on tile ${j.from}`);
    starts.add(j.from);
    if (board.mystery[j.from] !== undefined) out.push(`${j.id}: starts on Mystery tile ${j.from}`);
  }

  // No tile holds two jump ends, generated or edited by a card (2026-10-15, amending D16): never a flag
  // on a whirlpool, a splat on a rocket, two flags on one tile, or a chain of jumps.
  const ends = new Map<number, string>();
  for (const j of board.jumps) {
    for (const tile of [j.from, j.to]) {
      const other = ends.get(tile);
      if (other !== undefined && other !== j.id) out.push(`${j.id}: shares tile ${tile} with ${other}`);
      else ends.set(tile, j.id);
    }
  }

  for (const key of Object.keys(board.mystery)) {
    const tile = Number(key);
    if (!Number.isInteger(tile) || tile < 1 || tile > N - 1) out.push(`mystery tile ${key} outside 1..${N - 1}`);
  }

  // Acyclic: following jumps from any start must terminate.
  const next = new Map(board.jumps.map((j) => [j.from, j.to] as const));
  for (const j of board.jumps) {
    const seen = new Set<number>([j.from]);
    let tile = j.to;
    while (next.has(tile)) {
      if (seen.has(tile)) {
        out.push(`cycle through tile ${tile}`);
        break;
      }
      seen.add(tile);
      tile = next.get(tile)!;
    }
  }
  // Slides never cross: their lanes stay a clearance apart, on generated boards and after a card's edit (2026-10-15).
  const snakes = board.jumps.filter((j) => j.to < j.from);
  const lanes = snakes.map((j) => laneCenterline(j.from, j.to));
  lanes.forEach((a, i) =>
    lanes.slice(i + 1).forEach((b, k) => {
      if (lanesTouch(a, b)) out.push(`${snakes[i]!.id}: lane touches ${snakes[i + 1 + k]!.id}'s`);
    }),
  );
  return [...new Set(out)];
}
