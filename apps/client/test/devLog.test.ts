import { describe, expect, it } from 'vitest';
import { formatEvent } from '../src/app/devLog';

const NAMES = new Map([
  ['p0', 'You'],
  ['p1', 'Mochi'],
]);

describe('formatEvent', () => {
  it('writes the event type, then each field, with player ids as nicknames', () => {
    const line = formatEvent({ type: 'DieRolled', player: 'p1', natural: 4, face: 4, forced: false, auto: false, visibility: 'public' }, NAMES);
    expect(line).toBe('DieRolled player=Mochi natural=4 face=4 forced=false auto=false');
  });

  it('renames ids inside lists and records', () => {
    const line = formatEvent(
      { type: 'ChallengeResolved', challengeId: 'c3', pickRound: 1, picks: { p0: 'rock', p1: null }, winner: 'p0', losers: ['p1'], outcome: 'win', visibility: 'public' },
      NAMES,
    );
    expect(line).toBe('ChallengeResolved challengeId=c3 pickRound=1 picks={"You":"rock","Mochi":null} winner=You losers=["Mochi"] outcome=win');
  });

  it('marks private events', () => {
    const line = formatEvent({ type: 'ChallengePickEcho', challengeId: 'c3', player: 'p0', choice: 'rock', visibility: { private: 'p0' } }, NAMES);
    expect(line).toBe('ChallengePickEcho (private) challengeId=c3 player=You choice=rock');
  });
});
