import type { GameEvent } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { LoggedEvent } from '../src/director/director';
import { feedLines } from '../src/hud/feed';
import { targetLine } from '../src/hud/labels';
import { bannerFor } from '../src/hud/model';
import { roundRecord } from '../src/hud/record';
import { shieldBlocking } from '../src/scene/motion';

const ev = (e: object): GameEvent => ({ visibility: 'public', ...e }) as GameEvent;
const quake = ev({ type: 'CardResolved', caster: 'p1', cardId: 'earthquake', target: null, targets: ['p2', 'p4'], blocked: ['p3'], roll: 4, result: 'hit' });
const logged = (e: GameEvent, seq = 1): LoggedEvent => ({ seq, event: e });
const text = (log: LoggedEvent[]) => feedLines(log, 10).map((l) => l.parts.map((p) => (typeof p === 'string' ? p : `{${p.player}}`)).join(''));
const beat = { kind: 'cardResolved', durationMs: 1000, startedAt: 0, events: [quake], after: {} } as never;

describe('the game shows a card roll and every target (2026-10-15)', () => {
  it('writes one feed line with the roll, who was hit and who blocked it', () => {
    expect(text([logged(quake)])).toEqual(['{p1} used Earthquake: rolled 4, hit {p2} and {p4}, {p3} blocked it']);
  });

  it('puts the roll in a one-target line', () => {
    const shot = ev({ type: 'CardResolved', caster: 'p1', cardId: 'long-shot', target: 'p2', roll: 5, result: 'hit' });
    expect(text([logged(shot)])).toEqual(['Long Shot rolled 5 and hit {p2}']);
  });

  it("keeps the roll in the round's record", () => {
    const picked = ev({ type: 'CardSelected', player: 'p1', cardId: 'earthquake', cardType: 'attack', rarity: 'common', auto: false });
    expect(roundRecord([logged(picked, 1), logged(quake, 2)]).cards.p1).toEqual({ cardId: 'earthquake', result: 'hit', roll: 4 });
  });

  it('flares the shield of every blocker', () => {
    expect(shieldBlocking(beat, 'p3', 10_000)).toBe(true);
    expect(shieldBlocking(beat, 'p2', 10_000)).toBe(false);
  });

  it('tells each player hit or blocked', () => {
    expect(bannerFor(beat, 'p2', [])).toMatchObject({ text: 'HIT!' });
    expect(bannerFor(beat, 'p3', [])).toMatchObject({ text: 'BLOCKED!' });
  });

  it('names who a several-player card hits', () => {
    expect(targetLine({ condition: 'other', pick: 'all', tieBreak: 'lowest-seat' })).toBe('Each opponent');
    expect(targetLine({ condition: 'everyone', pick: 'all', tieBreak: 'lowest-seat' })).toBe('EVERYONE');
  });
});
