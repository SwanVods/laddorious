import { describe, expect, it } from 'vitest';
import { runBatch } from '../src/batch';
import { makeBots } from '@laddorious/bots';
import { aggregate, formatReport, matchMetrics, quantile } from '../src/metrics';
import { runMatch } from '../src/runner';

const seats = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }];

describe('metrics', () => {
  it('quantile picks nearest-rank values', () => {
    expect(quantile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(quantile([5, 1, 3, 2, 4], 0)).toBe(1);
    expect(quantile([5, 1, 3, 2, 4], 1)).toBe(5);
    expect(quantile([], 0.5)).toBeNaN();
  });

  it('summarises a match consistently with its events', () => {
    const run = runMatch({ seed: 'm1' }, seats, makeBots(seats, 'heuristic', 'm1', 0));
    const m = matchMetrics(run);
    expect(m.rounds).toBe(run.state.round);
    expect(m.encounters).toBe(run.events.filter((e) => e.type === 'MysteryOffered').length);
    expect(Object.values(m.picksByType).reduce((a, b) => a + b, 0)).toBe(run.events.filter((e) => e.type === 'CardSelected').length);
    expect(m.estimatedSeconds).toBeGreaterThan(m.rounds * 9);
  });

  it('aggregates a reproducible batch', () => {
    const a = runBatch({ matches: 20, players: 4, policy: 'heuristic', baseSeed: 'agg', afkPercent: 0 });
    const b = runBatch({ matches: 20, players: 4, policy: 'heuristic', baseSeed: 'agg', afkPercent: 0 });
    expect(a.report).toEqual(b.report);
    expect(a.report.winRateBySeat.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 10);
    expect(aggregate(a.metrics, 4, a.generation)).toEqual(a.report);
    expect(a.report.generator.boards).toBe(20);
    expect(a.report.generator.attemptsMean).toBeGreaterThanOrEqual(1);
    expect(formatReport(a.report)).toContain('Rounds (p10/med/p90)');
    expect(formatReport(a.report)).toContain('Board generation:     20 boards');
  });
});
