import type { EventBody, GameEvent } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { LoggedEvent } from '../src/director/director';
import { FEED_LINES, feedLines } from '../src/hud/feed';
import { roundRecord } from '../src/hud/record';

const pub = (body: EventBody): GameEvent => ({ ...body, visibility: 'public' });
const mine = (body: EventBody): GameEvent => ({ ...body, visibility: { private: 'p0' } });
const logOf = (events: GameEvent[]): LoggedEvent[] => events.map((event, i) => ({ seq: i + 1, event }));

describe('the round record', () => {
  it("keeps only this round's dice and cards", () => {
    const record = roundRecord(
      logOf([
        pub({ type: 'RoundStarted', round: 6 }),
        pub({ type: 'DieRolled', player: 'p1', natural: 2, face: 2, forced: false, auto: false }),
        pub({ type: 'CardSelected', player: 'p1', cardId: 'shove', cardType: 'attack', rarity: 'common', auto: false }),
        pub({ type: 'RoundStarted', round: 7 }),
        pub({ type: 'DieRolled', player: 'p0', natural: 3, face: 6, forced: true, auto: false }),
        pub({ type: 'DieRolled', player: 'p3', natural: 5, face: 5, forced: false, auto: true }),
        pub({ type: 'DiceTotaled', player: 'p3', faces: [5], total: 2 }),
        pub({ type: 'CardSelected', player: 'p2', cardId: 'sprint', cardType: 'movement', rarity: 'common', auto: false }),
        pub({ type: 'CardResolved', caster: 'p2', cardId: 'sprint', target: 'p2', result: 'hit' }),
      ]),
    );
    expect(record.round).toBe(7);
    expect(record.dice).toEqual({
      p0: { faces: [6], forced: [true], total: null },
      p3: { faces: [5], forced: [false], total: 2 },
    });
    expect(record.cards).toEqual({ p2: { cardId: 'sprint', result: 'hit' } });
  });

  it('starts at the beginning of the log in round 1', () => {
    const record = roundRecord(logOf([pub({ type: 'DieRolled', player: 'p1', natural: 4, face: 4, forced: false, auto: false })]));
    expect(record.round).toBeNull();
    expect(record.dice.p1?.faces).toEqual([4]);
  });
});

describe('feed lines (spec #2 §7.2)', () => {
  it('writes the newest line first, with names as parts and private lines marked', () => {
    const lines = feedLines(
      logOf([
        pub({ type: 'RoundStarted', round: 7 }),
        pub({ type: 'DieRolled', player: 'p1', natural: 4, face: 4, forced: false, auto: false }),
        pub({ type: 'ChallengeStarted', challengeId: 'c9', tile: 23, players: ['p0', 'p1', 'p2'], kind: 'minority', theme: ['Sun', 'Moon'] }),
        mine({ type: 'ChallengePickEcho', challengeId: 'c9', player: 'p0', choice: 'B' }),
      ]),
    );
    expect(lines).toEqual([
      { seq: 4, parts: ['You picked ', 'Moon'], private: true },
      { seq: 3, parts: ['Face-off on tile 23: ', { player: 'p0' }, ', ', { player: 'p1' }, ' and ', { player: 'p2' }], private: false },
      { seq: 2, parts: [{ player: 'p1' }, ' rolled 4'], private: false },
      { seq: 1, parts: ['Round 7 started'], private: false },
    ]);
  });

  it('describes moves, face-offs, cards and the win', () => {
    const text = (e: GameEvent) =>
      feedLines(logOf([e]))[0]?.parts.map((p) => (typeof p === 'string' ? p : `<${p.player}>`)).join('') ?? null;
    expect(text(pub({ type: 'Moved', player: 'p2', from: 40, to: 12, cause: 'snake', bounced: false }))).toBe('<p2> slid down to 12');
    expect(text(pub({ type: 'Moved', player: 'p2', from: 4, to: 26, cause: 'ladder', bounced: false }))).toBe('<p2> launched up to 26');
    expect(text(pub({ type: 'Moved', player: 'p2', from: 20, to: 17, cause: 'knockback', bounced: false }))).toBe('<p2> was knocked back to 17');
    expect(text(pub({ type: 'Moved', player: 'p2', from: 3, to: 6, cause: 'dice', bounced: false }))).toBeNull();
    expect(text(pub({ type: 'DiceTotaled', player: 'p3', faces: [5], total: 2 }))).toBe('<p3> moves 2 instead of 5');
    expect(text(pub({ type: 'DiceTotaled', player: 'p3', faces: [5], total: 5 }))).toBeNull();
    expect(text(pub({ type: 'ChallengeResolved', challengeId: 'c1', pickRound: 1, picks: { p0: 'rock', p1: 'rock' }, winner: null, losers: [], outcome: 'replay' }))).toBe('A tie! The face-off goes again');
    expect(text(pub({ type: 'ChallengeResolved', challengeId: 'c1', pickRound: 2, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win' }))).toBe('<p1> wins the face-off');
    expect(text(mine({ type: 'MysteryOffered', player: 'p0', tile: 9, rarity: 'epic', cards: ['aegis', 'aegis', 'jackpot'] }))).toBe('You landed on an Epic ? square');
    expect(text(mine({ type: 'CardRerolled', player: 'p0', slot: 1, from: 'shove', to: 'sprint' }))).toBe('You rerolled Shove into Sprint');
    expect(text(pub({ type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p2', result: 'hit' }))).toBe('Shove hit <p2>');
    expect(text(pub({ type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p2', result: 'blocked' }))).toBe('<p2> blocked Shove');
    expect(text(pub({ type: 'CardResolved', caster: 'p1', cardId: 'switcheroo', target: null, result: 'fizzled' }))).toBe("<p1>'s Switcheroo fizzled");
    expect(text(pub({ type: 'CardResolved', caster: 'p2', cardId: 'sprint', target: 'p2', result: 'hit' }))).toBe('<p2> used Sprint');
    expect(text(pub({ type: 'MatchWon', winner: 'p2', rankings: [] }))).toBe('<p2> wins the match!');
  });

  it(`keeps at most ${FEED_LINES} lines`, () => {
    const many = Array.from({ length: 9 }, (_, i) => pub({ type: 'RoundStarted', round: i + 1 }));
    const lines = feedLines(logOf(many));
    expect(lines).toHaveLength(FEED_LINES);
    expect(lines[0]!.parts).toEqual(['Round 9 started']);
  });
});
