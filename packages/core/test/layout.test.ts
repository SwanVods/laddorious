import { describe, expect, it } from 'vitest';
import { BOARD_COLUMNS, LANE_CLEARANCE, createStream, intBetween, laneCenterline, laneGap, lanesTouch, tileCell } from '../src/index';

describe('board layout', () => {
  it('lays tiles out in a serpentine, ten to a row', () => {
    expect(BOARD_COLUMNS).toBe(10);
    expect(tileCell(1)).toEqual({ col: 0, row: 0 });
    expect(tileCell(10)).toEqual({ col: 9, row: 0 });
    expect(tileCell(11)).toEqual({ col: 9, row: 1 });
    expect(tileCell(20)).toEqual({ col: 0, row: 1 });
    expect(tileCell(100)).toEqual({ col: 0, row: 9 });
  });
});

describe('slide lanes', () => {
  it('runs from the head tile to the tail tile, samples + 1 points', () => {
    const line = laneCenterline(57, 32);
    expect(line).toHaveLength(25);
    expect(line[0]).toEqual([tileCell(57).col, tileCell(57).row]);
    expect(line.at(-1)).toEqual([tileCell(32).col, tileCell(32).row]);
    expect(laneCenterline(57, 32, 10)).toHaveLength(11);
  });

  it('bends into a gentle S: a third of the way along it is pushed to one side, two thirds to the other', () => {
    // 20 (col 0, row 1) to 11 (col 9, row 1): along +x, so the first bend goes to -y by min(0.75, 0.12 × 9).
    const line = laneCenterline(20, 11, 24);
    expect(line[8]![0]).toBeCloseTo(3, 9);
    expect(line[8]![1]).toBeCloseTo(0.25, 9);
    expect(line[16]![0]).toBeCloseTo(6, 9);
    expect(line[16]![1]).toBeCloseTo(1.75, 9);
  });

  it('measures the gap between lanes: zero when they cross, positive when they run apart', () => {
    // 91 (col 9, row 9) to 1 (col 0, row 0) and 100 (col 0, row 9) to 10 (col 9, row 0) cross mid-board.
    expect(laneGap(laneCenterline(91, 1), laneCenterline(100, 10))).toBe(0);
    // Two lanes along rows 1 and 3.
    const apart = laneGap(laneCenterline(20, 11), laneCenterline(40, 31));
    expect(apart).toBeGreaterThan(LANE_CLEARANCE);
    expect(laneGap(laneCenterline(20, 11), laneCenterline(20, 11))).toBe(0);
  });

  it('lanesTouch, the generator\'s fast check, agrees with laneGap under the clearance', () => {
    const rng = createStream('lanes-touch');
    const lane = () => {
      const from = intBetween(rng, 12, 99);
      return laneCenterline(from, from - intBetween(rng, 4, Math.min(30, from - 2)));
    };
    let touching = 0;
    for (let i = 0; i < 400; i++) {
      const [a, b] = [lane(), lane()];
      const expected = laneGap(a, b) < LANE_CLEARANCE;
      expect(lanesTouch(a, b)).toBe(expected);
      if (expected) touching++;
    }
    expect(touching).toBeGreaterThan(40);
    expect(touching).toBeLessThan(360);
  });
});
