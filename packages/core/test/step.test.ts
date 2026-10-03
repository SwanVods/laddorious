import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { assertInvariants, hashState, InvariantError, step, stableStringify, type Input } from '../src/index';
import { again, choose, makeBoard, pick, play, roll, setup } from './support/fixtures';

describe('step', () => {
  it('never mutates the state it is given', () => {
    const s = setup({ dice: [[5], [5]] });
    const before = JSON.stringify(s);
    const r = step(s, roll('p1')(s));
    expect(r.ok).toBe(true);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('rejects bad inputs with codes and leaves no partial changes', () => {
    const s = setup();
    expect(step(s, roll('zz')(s))).toMatchObject({ ok: false, error: { code: 'UNKNOWN_PLAYER' } });
    expect(step(s, { type: 'timeout', windowId: s.windowId + 5 })).toMatchObject({ ok: false, error: { code: 'STALE_TIMEOUT' } });
    expect(step(s, pick('p1', 0)(s))).toMatchObject({ ok: false, error: { code: 'WRONG_PHASE' } });
    expect(step(s, { type: 'challengePick', player: 'p1', challengeId: 'c1', choice: 'rock', windowId: s.windowId })).toMatchObject({ ok: false, error: { code: 'WRONG_PHASE' } });
  });

  it('rejects a retried timeout for a window that already closed', () => {
    const s = setup({ dice: [[2], [3]] });
    const t = { type: 'timeout', windowId: s.windowId } as const;
    const after = play(s, [t]).state;
    expect(step(after, t)).toMatchObject({ ok: false, error: { code: 'STALE_TIMEOUT' } });
  });

  it('continues identically after the state is persisted as JSON mid-match', () => {
    const s = play(setup({ board: makeBoard(100, [], { 50: 'rare' }), dice: [[4, 2, 6, 3], [5, 3, 1]] }), [roll('p1'), roll('p2')]).state;
    const resumed = JSON.parse(JSON.stringify(s)) as typeof s;
    const next = [roll('p1'), roll('p2'), roll('p1'), again('p1'), roll('p2')];
    expect(hashState(play(resumed, next).state)).toBe(hashState(play(s, next).state));
  });

  it('is deterministic: same state and input give identical results', () => {
    const s = setup();
    const a = step(s, roll('p1')(s));
    const b = step(s, roll('p1')(s));
    expect(stableStringify(a)).toBe(stableStringify(b));
  });
});

describe('hashState / stableStringify', () => {
  it('ignores key order', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
  });
  it('changes when the state changes', () => {
    const s = setup({ dice: [[2], [3]] });
    expect(hashState(play(s, [roll('p1')]).state)).not.toBe(hashState(s));
  });
});

describe('assertInvariants', () => {
  it('throws on a shared tile outside a settle', () => {
    const s = setup({ positions: [10, 10] });
    expect(() => assertInvariants(s)).toThrow(InvariantError);
  });
  it('throws on an out-of-range position', () => {
    const s = setup({ positions: [101, 0] });
    expect(() => assertInvariants(s)).toThrow(InvariantError);
  });
});

describe('malformed input (review I1)', () => {
  it('returns INVALID_INPUT for non-objects, unknown types and wrongly typed fields', () => {
    const s = setup();
    const bad: unknown[] = [
      null,
      undefined,
      42,
      'roll',
      [],
      { type: 'hack', player: 'p1', windowId: 1 },
      { type: 'roll', windowId: 1 },
      { type: 'roll', player: { toString: 1 }, windowId: 1 },
      { type: 'roll', player: 'p1', windowId: '1' },
      { type: 'bonusChoice', player: 'p1', rollAgain: 'no', windowId: 1 },
      { type: 'challengePick', player: 'p1', challengeId: 7, choice: 'rock', windowId: 1 },
      { type: 'challengePick', player: 'p1', challengeId: 'c1', choice: { x: 1 }, windowId: 1 },
      { type: 'reroll', player: 'p1', slot: '1', windowId: 1 },
      { type: 'pickCard', player: 'p1', slot: null, windowId: 1 },
      { type: 'timeout', windowId: '1' },
    ];
    for (const input of bad) {
      expect(step(s, input as Input)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    }
  });

  it('never throws, whatever a client sends', () => {
    const s = setup();
    fc.assert(
      fc.property(fc.anything(), (input) => {
        expect(() => step(s, input as Input)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });
});

describe('retried player inputs (review I2)', () => {
  it('rejects a challenge pick retried into the next pick round of the same challenge', () => {
    let s = play(setup({ dice: [[5], [5]] }), [roll('p1'), roll('p2')]).state;
    const firstPick = choose('p1', 'rock')(s);
    s = play(s, [firstPick, choose('p2', 'rock')]).state; // tie → pick round 2, same challenge id
    expect(step(s, firstPick)).toMatchObject({ ok: false, error: { code: 'STALE_INPUT' } });
  });

  it('rejects a roll retried into the next round', () => {
    const s = setup({ dice: [[2, 3], [4, 5]] });
    const firstRoll = roll('p1')(s);
    const round2 = play(s, [firstRoll, roll('p2')]).state;
    expect(round2.round).toBe(2);
    expect(step(round2, firstRoll)).toMatchObject({ ok: false, error: { code: 'STALE_INPUT' } });
  });

  it('requires every player input to say which window it answers', () => {
    expect(step(setup(), { type: 'roll', player: 'p1' } as Input)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });
});
