import { describe, expect, it } from 'vitest';
import { createStream, isValidTarget, scriptedStream, selectTarget, targetCandidates, type TargetRule } from '../src/index';

const players = [
  { id: 'a', seat: 0, position: 20 },
  { id: 'b', seat: 1, position: 30 },
  { id: 'c', seat: 2, position: 40 },
  { id: 'd', seat: 3, position: 10 },
];
const [a] = players as [typeof players[0]];
const misc = () => createStream('t');
const rule = (r: Partial<TargetRule>): TargetRule => ({ condition: 'other', pick: 'leader', tieBreak: 'lowest-seat', ...r });

describe('targetCandidates', () => {
  it('filters by condition relative to the caster', () => {
    const ids = (r: TargetRule) => targetCandidates(players, a, r).map((p) => p.id);
    expect(ids(rule({ condition: 'self' }))).toEqual(['a']);
    expect(ids(rule({ condition: 'other' }))).toEqual(['b', 'c', 'd']);
    expect(ids(rule({ condition: 'ahead-of-caster' }))).toEqual(['b', 'c']);
    expect(ids(rule({ condition: 'behind-of-caster' }))).toEqual(['d']);
    expect(ids(rule({ condition: 'section', section: [25, 45] }))).toEqual(['b', 'c']);
  });
});

describe('selectTarget', () => {
  it('picks nearest, furthest, leader and last', () => {
    expect(selectTarget(players, a, rule({ condition: 'ahead-of-caster', pick: 'nearest' }), misc())).toBe('b');
    expect(selectTarget(players, a, rule({ condition: 'ahead-of-caster', pick: 'furthest' }), misc())).toBe('c');
    expect(selectTarget(players, a, rule({ pick: 'leader' }), misc())).toBe('c');
    expect(selectTarget(players, a, rule({ pick: 'last' }), misc())).toBe('d');
    expect(selectTarget(players, a, rule({ condition: 'self', pick: 'self' }), misc())).toBe('a');
  });

  it('returns null when nobody qualifies', () => {
    const leader = players[2]!;
    expect(selectTarget(players, leader, rule({ condition: 'ahead-of-caster', pick: 'nearest' }), misc())).toBeNull();
  });

  it('breaks ties by lowest seat or by the misc stream', () => {
    const tied = [a, { id: 'b', seat: 1, position: 25 }, { id: 'c', seat: 2, position: 15 }];
    const nearest = rule({ pick: 'nearest' });
    expect(selectTarget(tied, a, nearest, misc())).toBe('b');
    expect(selectTarget(tied, a, { ...nearest, tieBreak: 'random' }, scriptedStream([1]))).toBe('c');
  });
});

describe('isValidTarget', () => {
  it('re-checks the condition only (not the pick)', () => {
    const r = rule({ condition: 'ahead-of-caster', pick: 'nearest' });
    expect(isValidTarget(players, a, r, 'c')).toBe(true);
    expect(isValidTarget(players, a, r, 'd')).toBe(false);
  });
});
