import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '../src/protocol';
import { BOT_NAMES, buildSeats, randomHex } from '../src/seats';
import { PIECES } from '../src/types';

describe('buildSeats (spec #4 §4)', () => {
  it('seats one human, then Mochi, Pip and Juno on the pieces the human left, in picker order', () => {
    expect(buildSeats([{ nickname: 'Ari', piece: 'meeple' }])).toEqual([
      { playerId: 'p0', nickname: 'Ari', piece: 'meeple', bot: false },
      { playerId: 'p1', nickname: 'Mochi', piece: 'knight', bot: true },
      { playerId: 'p2', nickname: 'Pip', piece: 'pawn', bot: true },
      { playerId: 'p3', nickname: 'Juno', piece: 'dragon', bot: true },
    ]);
  });

  it('keeps humans in join order, lets their pieces repeat, and gives the bots unused pieces (M10)', () => {
    const seats = buildSeats([
      { nickname: 'Ari', piece: 'knight' },
      { nickname: 'Bo', piece: 'knight' },
      { nickname: 'Cy', piece: 'pawn' },
    ]);
    expect(seats.map((s) => [s.playerId, s.nickname, s.piece, s.bot])).toEqual([
      ['p0', 'Ari', 'knight', false],
      ['p1', 'Bo', 'knight', false],
      ['p2', 'Cy', 'pawn', false],
      ['p3', 'Mochi', 'meeple', true],
    ]);
  });

  it('seats four humans with no bots', () => {
    const four = ['A', 'B', 'C', 'D'].map((nickname) => ({ nickname, piece: 'dragon' as const }));
    expect(buildSeats(four).map((s) => s.bot)).toEqual([false, false, false, false]);
    expect(BOT_NAMES).toEqual(['Mochi', 'Pip', 'Juno']);
  });
});

describe('randomHex', () => {
  it('makes 128 random bits as 32 hex characters', () => {
    const a = randomHex();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(randomHex()).not.toBe(a);
  });
});

describe('the seven pieces (spec #5 §4.1)', () => {
  it('lists the new pieces after the four, and bots still take free pieces in that order', () => {
    expect(PIECES).toEqual(['knight', 'pawn', 'meeple', 'dragon', 'rook', 'hat', 'duck']);
    const seats = buildSeats([
      { nickname: 'Ari', piece: 'rook' },
      { nickname: 'Bo', piece: 'duck' },
    ]);
    expect(seats.map((s) => s.piece)).toEqual(['rook', 'duck', 'knight', 'pawn']);
  });

  it('is protocol 3 since private rooms (2026-10-16), so older builds ask to reload', () => {
    expect(PROTOCOL_VERSION).toBe(3);
  });
});
