import type { GameEvent } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { LoggedEvent } from '../src/director/director';
import { feedLines } from '../src/hud/feed';
import { cardPickModel, dockModel, statusText } from '../src/hud/model';
import { openingUpdate } from './support/fixtures';

const ev = (e: object): GameEvent => ({ visibility: 'public', ...e }) as GameEvent;
const text = (e: object) => feedLines([{ seq: 1, event: ev(e) } as LoggedEvent], 10).map((l) => l.parts.map((p) => (typeof p === 'string' ? p : `{${p.player}}`)).join(''));
const base = openingUpdate().view;

describe('the game shows 4d effects (2026-10-16)', () => {
  it('writes an extra roll, a guarded tile and a face-off lost forward', () => {
    expect(text({ type: 'ExtraRoll', players: ['p1'] })).toEqual(['{p1} rolls again']);
    expect(text({ type: 'ExtraRoll', players: ['p1', 'p2'] })).toEqual(['{p1} and {p2} roll again']);
    expect(text({ type: 'TileGuarded', tile: 20, guard: 'p1', knocked: ['p2'] })).toEqual(["{p2} was knocked off {p1}'s tile"]);
    expect(text({ type: 'Moved', player: 'p1', from: 20, to: 23, cause: 'knockback', bounced: false })).toEqual(['{p1} lost the face-off: forward to 23']);
  });

  it('shows who is waiting during an extra roll', () => {
    const view = { ...base, phase: { kind: 'dice', seqs: { p0: { faces: [], status: 'out' }, p1: { faces: [], status: 'ready' } } }, awaiting: { ...base.awaiting, window: 'dice', players: ['p1'] } } as never;
    expect(statusText(view, 'p0', 'p1')).toBe('Waiting');
    expect(dockModel({ beat: null, view, record: { round: 1, dice: {}, cards: {} }, me: 'p0' } as never)).toMatchObject({ kind: 'wait', parts: ['Waiting for ', { player: 'p1' }, ' to roll again'] });
  });

  it("uses a hand's own reroll limits", () => {
    const view = {
      ...base,
      phase: { kind: 'mysterySelect', picked: { p0: false } },
      myOffer: { player: 'p0', tile: 9, rarity: 'common', cards: ['sprint', 'moonwalk', 'buckler'], rerolled: [false, false, false], rerollsUsed: 1, seen: [], picked: null, autoPicked: false, perSlot: 2, maxRerolls: 5, slotRerolls: [1, 0, 0] },
      awaiting: { windowId: 7, window: 'mystery', players: ['p0'], durationMs: 15_000 },
    } as never;
    const model = cardPickModel(view)!;
    expect(model.rerollsLeft).toBe(4);
    expect(model.perSlot).toBe(2);
    expect(model.slots[0]!.canReroll).toBe(true);
  });
});
