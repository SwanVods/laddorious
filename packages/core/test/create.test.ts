import { describe, expect, it } from 'vitest';
import { ConfigError, awaiting, createMatch, generateBoard, DEFAULT_BOARD_CONFIG } from '../src/index';
import { makeBoard } from './support/fixtures';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));

describe('createMatch', () => {
  it('starts round 1 with everyone on tile 0 and the dice window open', () => {
    const s = createMatch({ seed: 'm' }, seats(4));
    expect(s.round).toBe(1);
    expect(s.players.map((p) => [p.id, p.seat, p.position])).toEqual([['p1', 0, 0], ['p2', 1, 0], ['p3', 2, 0], ['p4', 3, 0]]);
    expect(s.phase.kind).toBe('dice');
    expect(awaiting(s)).toEqual({ windowId: 1, window: 'dice', players: ['p1', 'p2', 'p3', 'p4'], durationMs: 12_000 });
  });

  it('generates the board from the seed when none is given', () => {
    expect(createMatch({ seed: 'm' }, seats(2)).board).toEqual(generateBoard('m', DEFAULT_BOARD_CONFIG).board);
  });

  it('uses a supplied board without aliasing it', () => {
    const board = makeBoard(100, [[10, 30]]);
    const s = createMatch({ seed: 'm' }, seats(2), board);
    expect(s.board).toEqual(board);
    expect(s.board).not.toBe(board);
  });

  it('rejects bad player counts, duplicate ids and invalid boards', () => {
    expect(() => createMatch({ seed: 'm' }, seats(1))).toThrow(ConfigError);
    expect(() => createMatch({ seed: 'm' }, seats(5))).toThrow(ConfigError);
    expect(() => createMatch({ seed: 'm' }, [{ id: 'a' }, { id: 'a' }])).toThrow(ConfigError);
    expect(() => createMatch({ seed: 'm' }, seats(2), makeBoard(100, [[90, 100]]))).toThrow(/invalid board/);
  });

  it('rejects player ids that would collide with Object.prototype keys or are malformed', () => {
    for (const id of ['constructor', '__proto__', 'toString', '', 'has space', 'x'.repeat(33)]) {
      expect(() => createMatch({ seed: 'm' }, [{ id }, { id: 'ok' }])).toThrow(ConfigError);
    }
  });

  it('gives the same board for a seed regardless of player count (daily challenges)', () => {
    expect(createMatch({ seed: 'daily' }, seats(2)).board).toEqual(createMatch({ seed: 'daily' }, seats(4)).board);
  });

  it('derives independent per-seat dice streams from the seed', () => {
    const a = createMatch({ seed: 'm' }, seats(2));
    const b = createMatch({ seed: 'm' }, seats(3));
    expect(b.rng.dice[0]).toEqual(a.rng.dice[0]);
    expect(a.rng.dice[0]).not.toEqual(a.rng.dice[1]);
  });

  it('draws dice, cards and misc from rngSeed, so a public board seed predicts none of them (review C1)', () => {
    const a = createMatch({ seed: 'daily', rngSeed: 'secret-a' }, seats(2));
    const b = createMatch({ seed: 'daily', rngSeed: 'secret-b' }, seats(2));
    expect(a.board).toEqual(b.board);
    expect(a.rng.dice[0]).not.toEqual(b.rng.dice[0]);
    expect(a.rng.cards[0]).not.toEqual(b.rng.cards[0]);
    expect(a.rng.misc).not.toEqual(b.rng.misc);
    // Without an rngSeed the seed drives everything, as before.
    expect(createMatch({ seed: 'daily', rngSeed: 'daily' }, seats(2))).toEqual(createMatch({ seed: 'daily' }, seats(2)));
  });
});
