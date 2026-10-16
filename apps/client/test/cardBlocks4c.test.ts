import type { ActiveEffect, GameEvent } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { LoggedEvent } from '../src/director/director';
import { feedLines } from '../src/hud/feed';
import { effectChip, nextRollMods } from '../src/hud/labels';

const ev = (e: object): GameEvent => ({ visibility: 'public', ...e }) as GameEvent;
const text = (e: object) => feedLines([{ seq: 1, event: ev(e) } as LoggedEvent], 10).map((l) => l.parts.map((p) => (typeof p === 'string' ? p : `{${p.player}}`)).join(''));
const checked = (met: boolean, check: object) => text({ type: 'RollChecked', player: 'p1', effectId: 'e1', met, check: { hook: 'rollCheck', ...check } });
const fx = (params: object): ActiveEffect => ({ id: 'e1', owner: 'p0', sourceCard: 'odd-luck', sourcePlayer: 'p0', params: params as never, lifetime: { charges: 1 }, createdRound: 1, seq: 1 });

describe('the game shows 4c effects (2026-10-16)', () => {
  it('writes what a roll check did', () => {
    expect(checked(true, { when: 'odd', then: { multiply: 2 } })).toEqual(['{p1} rolled odd: doubled!']);
    expect(checked(true, { when: 'odd', then: { multiply: 3 } })).toEqual(['{p1} rolled odd: tripled!']);
    expect(checked(true, { when: 'even', then: { shield: { charges: 1, rounds: 2 } } })).toEqual(['{p1} rolled even: shielded']);
    expect(checked(true, { when: 'over3', then: { toLadder: true }, otherwise: 'stay' })).toEqual(['{p1} rolled over 3: off to the nearest rocket']);
    expect(checked(false, { when: 'over3', then: { toLadder: true }, otherwise: 'stay' })).toEqual(['{p1} rolled 3 or less: stays put']);
    expect(checked(false, { when: 'odd', then: { multiply: 2 } })).toEqual([]);
  });

  it('lists a roll check under NEXT ROLL', () => {
    expect(nextRollMods([fx({ hook: 'rollCheck', when: 'odd', then: { multiply: 2 } })], 'p0')).toEqual(['If odd ×2']);
    expect(nextRollMods([fx({ hook: 'rollCheck', when: 'over3', then: { toLadder: true }, otherwise: 'stay' })], 'p0')).toEqual(['If over 3 rocket']);
  });

  it('names the "when" effects on their chips', () => {
    const names = new Map<string, string>();
    expect(effectChip(fx({ hook: 'afterMove', cause: 'dice', condition: 'climbedLadder', amount: 5 }), names)).toMatchObject({ icon: 'pad', description: 'After your next launch, you move +5' });
    expect(effectChip(fx({ hook: 'afterMove', cause: 'dice', condition: 'landedOnSnakeHead', amount: -2, who: 'others' }), names)).toMatchObject({ icon: 'slide', description: 'When you hit a whirlpool, everyone else moves −2' });
    expect(effectChip(fx({ hook: 'afterMove', cause: 'dice', condition: 'climbedLadder', amount: 2, who: 'others' }), names)).toMatchObject({ icon: 'pad', description: 'When you ride a rocket, everyone else moves +2' });
    expect(effectChip(fx({ hook: 'rollCheck', when: 'even', then: { shield: { charges: 1, rounds: 2 } } }), names)).toMatchObject({ icon: 'aegis', badge: 'even' });
  });
});
