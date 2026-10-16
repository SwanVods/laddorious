import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOARD_CONFIG,
  GenerationError,
  LANE_CLEARANCE,
  boardViolations,
  generateBoard,
  jumpKind,
  jumpLength,
  laneCenterline,
  laneGap,
  structuralViolations,
  type BoardConfig,
} from '../src/index';
import { makeBoard } from './support/fixtures';

const cfg = DEFAULT_BOARD_CONFIG;

describe('generateBoard', () => {
  it('is deterministic: same seed, same board', () => {
    expect(generateBoard('daily-2026-10-03', cfg)).toEqual(generateBoard('daily-2026-10-03', cfg));
  });

  it('gives different boards for different seeds and generator versions', () => {
    const a = generateBoard('a', cfg).board;
    expect(generateBoard('b', cfg).board.jumps).not.toEqual(a.jumps);
    expect(generateBoard('a', { ...cfg, generatorVersion: cfg.generatorVersion + 1 }).board.jumps).not.toEqual(a.jumps);
  });

  it('accepts boards in under 2 attempts on average under the one-die model', () => {
    let attempts = 0;
    for (let i = 0; i < 200; i++) attempts += generateBoard(`calib-${i}`, cfg).report.attempts;
    expect(attempts / 200).toBeLessThan(2);
  });

  it('is generator version 4, the one that lets slide lanes cross (2026-10-16; version 3 kept them apart)', () => {
    expect(cfg.generatorVersion).toBe(4);
  });

  it('lets slide lanes cross: trails only show for a moment (the user, 2026-10-16)', () => {
    let crossing = 0;
    for (let i = 0; i < 100; i++) {
      const lanes = generateBoard(`lanes-${i}`, cfg)
        .board.jumps.filter((j) => jumpKind(j) === 'snake')
        .map((j) => laneCenterline(j.from, j.to));
      for (let a = 0; a < lanes.length; a++) for (let b = a + 1; b < lanes.length; b++) if (laneGap(lanes[a]!, lanes[b]!) < LANE_CLEARANCE) crossing++;
    }
    expect(crossing).toBeGreaterThan(0);
  });

  it('only produces boards that satisfy every hard and generator rule', () => {
    for (let i = 0; i < 40; i++) {
      const { board, report } = generateBoard(`seed-${i}`, cfg);
      expect(boardViolations(board)).toEqual([]);
      expect(structuralViolations(board, cfg)).toEqual([]);
      const snakes = board.jumps.filter((j) => jumpKind(j) === 'snake');
      const ladders = board.jumps.filter((j) => jumpKind(j) === 'ladder');
      expect(snakes.length).toBeGreaterThanOrEqual(8);
      expect(snakes.length).toBeLessThanOrEqual(10);
      expect(ladders.length).toBeGreaterThanOrEqual(8);
      expect(ladders.length).toBeLessThanOrEqual(10);
      for (const j of board.jumps) {
        expect(jumpLength(j)).toBeGreaterThanOrEqual(4);
        expect(jumpLength(j)).toBeLessThanOrEqual(30);
      }
      expect(Object.keys(board.mystery)).toHaveLength(18);
      expect(report.analysis.median4p).toBeGreaterThanOrEqual(15);
      expect(report.analysis.median4p).toBeLessThanOrEqual(30);
      expect(report.analysis.tail2p).toBeLessThan(0.01);
    }
  });

  it('assigns Mystery rarities roughly by weight (70/25/5)', () => {
    const counts = { common: 0, rare: 0, epic: 0 };
    for (let i = 0; i < 60; i++) for (const r of Object.values(generateBoard(`r-${i}`, cfg).board.mystery)) counts[r]++;
    const total = counts.common + counts.rare + counts.epic;
    expect(counts.common / total).toBeGreaterThan(0.6);
    expect(counts.epic / total).toBeLessThan(0.1);
    expect(counts.epic).toBeGreaterThan(0);
  });

  it('throws GenerationError naming the seed when no candidate can pass', () => {
    const impossible: BoardConfig = { ...cfg, maxAttempts: 5, analysis: { ...cfg.analysis, median4pRounds: [1, 1] } };
    expect(() => generateBoard('nope', impossible)).toThrow(GenerationError);
    try {
      generateBoard('nope', impossible);
    } catch (e) {
      expect((e as GenerationError).seed).toBe('nope');
      const rejections = (e as GenerationError).rejections;
      expect(Object.values(rejections).reduce((sum, n) => sum + (n ?? 0), 0)).toBe(5);
      expect(rejections['analysis-median']).toBeGreaterThan(0);
    }
  });
});

describe('structuralViolations', () => {
  const base: Array<[number, number]> = [
    [5, 20], [12, 35], [25, 40], [33, 50], [45, 60], [52, 70], [63, 80], [71, 85],
    [30, 10], [38, 22], [48, 28], [58, 41], [67, 54], [76, 61], [86, 74], [95, 88],
  ];
  const mysteryTiles = [2, 8, 13, 18, 23, 29, 35, 40, 46, 51, 56, 62, 68, 73, 79, 85, 90, 96];
  const mystery = Object.fromEntries(mysteryTiles.map((t) => [t, 'common' as const]));
  const valid = makeBoard(100, base, mystery);

  it('accepts a hand-built valid board', () => {
    expect(structuralViolations(valid, cfg)).toEqual([]);
  });

  it('lets slide lanes cross (2026-10-16)', () => {
    // 83 -> 72 crosses 76 -> 61.
    expect(structuralViolations(makeBoard(100, [...base, [83, 72]], mystery), cfg)).not.toContain('lane-crossing');
  });

  it('flags chains', () => {
    expect(structuralViolations(makeBoard(100, [...base, [20, 26]], mystery), cfg)).toContain('chain');
  });

  it('flags the finish zone (two snakes in 91..99)', () => {
    expect(structuralViolations(makeBoard(100, [...base, [97, 90]], mystery), cfg)).toContain('finish-zone');
  });

  it('flags a long snake in the finish zone', () => {
    const board = makeBoard(100, base.map(([f, t]) => (f === 95 ? [95, 70] : [f, t])), mystery);
    expect(structuralViolations(board, cfg)).toContain('finish-zone');
  });

  it('flags 6 consecutive snake heads', () => {
    const run: Array<[number, number]> = [14, 15, 16, 17, 18, 19].map((t) => [t, t - 10]);
    expect(structuralViolations(makeBoard(100, [...base, ...run], mystery), cfg)).toContain('snake-run');
  });

  it('flags lengths and counts out of range', () => {
    expect(structuralViolations(makeBoard(100, [...base.slice(1), [5, 40]], mystery), cfg)).toContain('length');
    expect(structuralViolations(makeBoard(100, base.slice(2), mystery), cfg)).toContain('count');
  });

  it('flags Mystery clusters and gaps', () => {
    const clustered = { ...mystery, 3: 'rare' as const, 4: 'rare' as const, 6: 'rare' as const, 8: 'rare' as const };
    expect(structuralViolations(makeBoard(100, base, clustered), cfg)).toContain('mystery-spacing');
    expect(structuralViolations(makeBoard(100, base, { 2: 'common', 50: 'common' }), cfg)).toContain('mystery-spacing');
  });
});
