import { describe, expect, it } from 'vitest';
import { makeBots } from '@laddorious/bots';
import { replayLog, runMatch } from '../src/runner';

const seats = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }];

describe('runner', () => {
  it('plays a match to the end and the log replays to the same hash', () => {
    const run = runMatch({ seed: 'r1' }, seats, makeBots(seats, 'heuristic', 'r1', 0));
    expect(run.state.phase.kind).toBe('finished');
    expect(run.roundLeaders).toHaveLength(run.state.round);
    expect(replayLog(run.log).ok).toBe(true);
    expect(replayLog({ ...run.log, finalHash: 'deadbeef' }).ok).toBe(false);
  });

  it('copes with AFK players by timing windows out', () => {
    const run = runMatch({ seed: 'afk' }, seats, makeBots(seats, 'random', 'afk', 30));
    expect(run.state.phase.kind).toBe('finished');
    expect(run.log.inputs.some((i) => i.type === 'timeout')).toBe(true);
  });

  it('gives up with a clear error instead of looping forever', () => {
    expect(() => runMatch({ seed: 'r1' }, seats, makeBots(seats, 'heuristic', 'r1', 0), { maxSteps: 5 })).toThrow(/did not finish within 5 steps/);
  });
});
