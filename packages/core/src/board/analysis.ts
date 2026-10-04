import type { Board } from './types';

export interface BoardAnalysis {
  /** cdf[r] = P(a single player, dice only, has finished by the end of round r). cdf[0] = 0. */
  cdf: number[];
  /** Median round in which the first of n independent players finishes (Infinity if never within maxRounds). */
  medianFirstFinish: { 2: number; 3: number; 4: number };
  /** P(first finish happens after round r) for n players. */
  tailAfter(n: number, r: number): number;
}

/**
 * One round of dice-only movement (spec §7.3, amended 2026-10-04): a single
 * die, so totals 1..6 each have p = 1/6.
 */
const ROUND_TOTALS: ReadonlyArray<readonly [total: number, p: number]> = [
  [1, 1 / 6], [2, 1 / 6], [3, 1 / 6], [4, 1 / 6], [5, 1 / 6], [6, 1 / 6],
];

/** Destination tile after moving `total` from `from` with bounce and jump chains. */
export function landingTile(board: Board, from: number, total: number, next = jumpMap(board)): number {
  const N = board.size;
  let to = from + total;
  if (to > N) to = N - (to - N);
  if (to < 0) to = 0;
  let guard = 0;
  while (next.has(to)) {
    to = next.get(to)!;
    if (++guard > board.jumps.length) throw new Error('jump cycle in analysis');
  }
  return to;
}

function jumpMap(board: Board): Map<number, number> {
  return new Map(board.jumps.map((j) => [j.from, j.to] as const));
}

export function analyzeBoard(board: Board, maxRounds = 300): BoardAnalysis {
  const N = board.size;
  const next = jumpMap(board);
  // Precompute transitions per tile.
  const transitions: Array<Array<[number, number]>> = [];
  for (let p = 0; p < N; p++) {
    const row = new Map<number, number>();
    for (const [t, prob] of ROUND_TOTALS) {
      const q = landingTile(board, p, t, next);
      row.set(q, (row.get(q) ?? 0) + prob);
    }
    transitions.push([...row.entries()]);
  }

  let dist = new Float64Array(N + 1);
  dist[0] = 1;
  const cdf: number[] = [0];
  for (let r = 1; r <= maxRounds; r++) {
    const nextDist = new Float64Array(N + 1);
    nextDist[N] = dist[N]!;
    for (let p = 0; p < N; p++) {
      const mass = dist[p]!;
      if (mass === 0) continue;
      for (const [q, prob] of transitions[p]!) nextDist[q] = nextDist[q]! + mass * prob;
    }
    dist = nextDist;
    cdf.push(Math.min(1, dist[N]!));
  }

  const tailAfter = (n: number, r: number): number => {
    const f = cdf[Math.min(r, cdf.length - 1)]!;
    return Math.pow(1 - f, n);
  };
  const median = (n: number): number => {
    for (let r = 1; r < cdf.length; r++) if (1 - tailAfter(n, r) >= 0.5) return r;
    return Infinity;
  };
  return { cdf, medianFirstFinish: { 2: median(2), 3: median(3), 4: median(4) }, tailAfter };
}
