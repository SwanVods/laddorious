import { describe, expect, it } from 'vitest';
import { analyzeBoard, createStream, landingTile, rollDie } from '../src/index';
import { makeBoard } from './support/fixtures';

describe('landingTile', () => {
  const b = makeBoard(100, [[10, 30], [50, 20]]);
  it('moves, bounces off N, floors at 0 and follows jumps', () => {
    expect(landingTile(b, 0, 5)).toBe(5);
    expect(landingTile(b, 5, 5)).toBe(30); // ladder 10→30
    expect(landingTile(b, 98, 5)).toBe(97); // 103 bounces to 97
    expect(landingTile(b, 45, 5)).toBe(20); // snake 50→20
  });
});

describe('analyzeBoard', () => {
  it('matches the closed form on a 2-tile board: each round wins with p = 1/6', () => {
    // From tile 0 or 1 exactly one total (2 or 1) lands on tile 2; every other total ends on 0 or 1.
    const a = analyzeBoard(makeBoard(2));
    for (const r of [1, 2, 3, 10]) expect(a.cdf[r]).toBeCloseTo(1 - (5 / 6) ** r, 12);
    expect(a.medianFirstFinish[4]).toBe(1); // 1 - (5/6)^4 = 0.518
    expect(a.medianFirstFinish[2]).toBe(2); // 1 - (5/6)^2 = 0.306 < 0.5; (5/6)^4 → 0.518
    expect(a.tailAfter(2, 1)).toBeCloseTo((5 / 6) ** 2, 12);
  });

  it('models one die per round: a 6-tile board is finished in round 1 only by rolling a 6', () => {
    // Under the old bonus-roll model no round-1 total could land exactly on 6, so cdf[1] was 0.
    expect(analyzeBoard(makeBoard(6)).cdf[1]).toBeCloseTo(1 / 6, 12);
  });

  it('produces a non-decreasing CDF that approaches 1', () => {
    const a = analyzeBoard(makeBoard(100, [[10, 30], [50, 20]]));
    for (let r = 1; r < a.cdf.length; r++) expect(a.cdf[r]!).toBeGreaterThanOrEqual(a.cdf[r - 1]!);
    expect(a.cdf.at(-1)!).toBeGreaterThan(0.999);
  });

  it('gets faster with a ladder and slower with a snake', () => {
    const plain = analyzeBoard(makeBoard(100)).medianFirstFinish[4];
    expect(analyzeBoard(makeBoard(100, [[3, 60]])).medianFirstFinish[4]).toBeLessThan(plain);
    expect(analyzeBoard(makeBoard(100, [[60, 2]])).medianFirstFinish[4]).toBeGreaterThan(plain);
  });

  it('agrees with a Monte-Carlo dice-only simulation (spec §11 cross-check)', () => {
    const board = makeBoard(100, [
      [4, 25], [13, 46], [33, 49], [42, 63], [50, 69], [62, 81], [74, 92],
      [27, 5], [40, 3], [43, 18], [54, 31], [66, 45], [76, 58], [89, 53], [99, 41],
    ]);
    const a = analyzeBoard(board);
    let expected = 0; // E[T] = Σ_{r≥1} P(T ≥ r) = Σ (1 − F(r−1))
    for (let r = 1; r < a.cdf.length; r++) expected += 1 - a.cdf[r - 1]!;
    const rng = createStream('mc');
    const runs = 20_000;
    let total = 0;
    for (let i = 0; i < runs; i++) {
      let pos = 0;
      let rounds = 0;
      while (pos !== board.size) {
        rounds++;
        pos = landingTile(board, pos, rollDie(rng));
      }
      total += rounds;
    }
    expect(total / runs).toBeGreaterThan(expected * 0.97);
    expect(total / runs).toBeLessThan(expected * 1.03);
  });
});
