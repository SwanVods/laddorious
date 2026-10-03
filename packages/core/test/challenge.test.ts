import { describe, expect, it } from 'vitest';
import { scriptedStream, type Challenge } from '../src/index';
import { resolvePickRound } from '../src/engine/challenge';

function challenge(players: string[], picks: Record<string, Challenge['picks'][string]>, pickRound = 1): Challenge {
  return {
    id: 'c1',
    tile: 10,
    participants: [...players],
    contesting: [...players],
    kind: players.length === 2 ? 'rps' : 'minority',
    theme: players.length === 2 ? null : ['Sun', 'Moon'],
    pickRound,
    picks,
    losers: [],
    winner: null,
  };
}
const noRandom = () => scriptedStream([]);

describe('resolvePickRound — RPS', () => {
  it('rock beats scissors, scissors beats paper, paper beats rock', () => {
    for (const [a, b, winner] of [['rock', 'scissors', 'x'], ['scissors', 'rock', 'y'], ['paper', 'rock', 'x'], ['scissors', 'paper', 'x']] as const) {
      const ch = challenge(['x', 'y'], { x: a, y: b });
      expect(resolvePickRound(ch, [], noRandom(), 4)).toBe('win');
      expect(ch.winner).toBe(winner);
      expect(ch.losers).toEqual([winner === 'x' ? 'y' : 'x']);
    }
  });

  it('replays a tie and clears the picks', () => {
    const ch = challenge(['x', 'y'], { x: 'rock', y: 'rock' });
    expect(resolvePickRound(ch, [], noRandom(), 4)).toBe('replay');
    expect(ch.pickRound).toBe(2);
    expect(ch.picks).toEqual({});
    expect(ch.winner).toBeNull();
  });

  it('a timed-out player loses immediately', () => {
    const ch = challenge(['x', 'y'], { x: 'rock' });
    expect(resolvePickRound(ch, ['y'], noRandom(), 4)).toBe('win');
    expect(ch.winner).toBe('x');
  });

  it('if everyone times out, misc picks the winner', () => {
    const ch = challenge(['x', 'y'], {});
    expect(resolvePickRound(ch, ['x', 'y'], scriptedStream([1]), 4)).toBe('random');
    expect(ch.winner).toBe('y');
    expect(ch.losers).toEqual(['x']);
  });

  it('after the last allowed pick round, a tie is decided by misc', () => {
    const ch = challenge(['x', 'y'], { x: 'paper', y: 'paper' }, 4);
    expect(resolvePickRound(ch, [], scriptedStream([0]), 4)).toBe('random');
    expect(ch.winner).toBe('x');
  });
});

describe('resolvePickRound — Minority', () => {
  it('the single odd one out wins (2–1 and 3–1)', () => {
    const three = challenge(['a', 'b', 'c'], { a: 'A', b: 'B', c: 'A' });
    expect(resolvePickRound(three, [], noRandom(), 4)).toBe('win');
    expect(three.winner).toBe('b');
    expect(three.losers.sort()).toEqual(['a', 'c']);
    const four = challenge(['a', 'b', 'c', 'd'], { a: 'B', b: 'B', c: 'A', d: 'B' });
    expect(resolvePickRound(four, [], noRandom(), 4)).toBe('win');
    expect(four.winner).toBe('c');
  });

  it('replays all-same and even splits', () => {
    expect(resolvePickRound(challenge(['a', 'b', 'c'], { a: 'A', b: 'A', c: 'A' }), [], noRandom(), 4)).toBe('replay');
    expect(resolvePickRound(challenge(['a', 'b', 'c', 'd'], { a: 'A', b: 'B', c: 'A', d: 'B' }), [], noRandom(), 4)).toBe('replay');
  });

  it('timeouts lose; two survivors continue as RPS', () => {
    const ch = challenge(['a', 'b', 'c', 'd'], { a: 'A', b: 'B' });
    expect(resolvePickRound(ch, ['c', 'd'], noRandom(), 4)).toBe('continue');
    expect(ch.kind).toBe('rps');
    expect(ch.contesting).toEqual(['a', 'b']);
    expect(ch.losers).toEqual(['c', 'd']);
    expect(ch.picks).toEqual({});
  });

  it('three survivors of a 4-player challenge are judged on their picks', () => {
    const ch = challenge(['a', 'b', 'c', 'd'], { a: 'A', b: 'B', c: 'A' });
    expect(resolvePickRound(ch, ['d'], noRandom(), 4)).toBe('win');
    expect(ch.winner).toBe('b');
    expect(ch.losers.sort()).toEqual(['a', 'c', 'd']);
  });
});
