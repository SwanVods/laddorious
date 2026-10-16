import type { GameEvent } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { LoggedEvent } from '../src/director/director';
import { cardListRecord } from '../src/hud/record';

// The card list keeps last round's cards until the next round's first die roll (the user, 2026-10-16).

const ev = (e: object): GameEvent => ({ visibility: 'public', ...e }) as GameEvent;
const log = (events: object[]): LoggedEvent[] => events.map((e, i) => ({ seq: i + 1, event: ev(e) }));
const round1 = [
  { type: 'RoundStarted', round: 1 },
  { type: 'DieRolled', player: 'p0', natural: 3, face: 3, forced: false, auto: false },
  { type: 'CardSelected', player: 'p0', cardId: 'sprint', cardType: 'movement', rarity: 'common', auto: false },
  { type: 'CardResolved', caster: 'p0', cardId: 'sprint', target: 'p0', result: 'hit' },
  { type: 'RoundEnded', round: 1 },
];

describe('which round the card list shows (2026-10-16)', () => {
  it("keeps last round's cards through the break and the next round's opening", () => {
    const record = cardListRecord(log([...round1, { type: 'RoundStarted', round: 2 }, { type: 'WindowOpened', windowId: 5, window: 'dice', players: ['p0'], durationMs: 12_000 }]));
    expect(record.round).toBe(1);
    expect(record.cards).toEqual({ p0: { cardId: 'sprint', result: 'hit' } });
  });

  it('lets them go at the next round\'s first die roll', () => {
    const record = cardListRecord(log([...round1, { type: 'RoundStarted', round: 2 }, { type: 'DieRolled', player: 'p1', natural: 2, face: 2, forced: false, auto: false }]));
    expect(record.round).toBe(2);
    expect(record.cards).toEqual({});
  });

  it("shows this round's cards once there are some", () => {
    const record = cardListRecord(log([...round1.slice(0, 3)]));
    expect(record.cards).toEqual({ p0: { cardId: 'sprint', result: null } });
  });
});
