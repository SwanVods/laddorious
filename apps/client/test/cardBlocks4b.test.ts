import type { ActiveEffect, GameEvent } from '@laddorious/core';
import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import type { LoggedEvent } from '../src/director/director';
import { feedLines } from '../src/hud/feed';
import { effectChip, nextRollMods } from '../src/hud/labels';
import { dockModel, statusText } from '../src/hud/model';
import { OFF_TINT, offTone } from '../src/scene/pairs';
import { openingUpdate } from './support/fixtures';

const ev = (e: object): GameEvent => ({ visibility: 'public', ...e }) as GameEvent;
const logged = (e: GameEvent, seq = 1): LoggedEvent => ({ seq, event: e });
const text = (log: LoggedEvent[]) => feedLines(log, 10).map((l) => l.parts.map((p) => (typeof p === 'string' ? p : `{${p.player}}`)).join(''));
const fx = (hook: string, owner = 'p0', lifetime: ActiveEffect['lifetime'] = { charges: 1 }): ActiveEffect =>
  ({ id: `e-${hook}`, owner, sourceCard: 'red-light', sourcePlayer: 'p1', params: { hook } as never, lifetime, createdRound: 1, seq: 1 });

describe('the game shows 4b effects (2026-10-16)', () => {
  it('writes a skip and a backward roll in the feed', () => {
    expect(text([logged(ev({ type: 'RollSkipped', player: 'p1', effectId: 'e1' }))])).toEqual(['{p1} skips this roll']);
    expect(text([logged(ev({ type: 'DiceTotaled', player: 'p1', faces: [4], total: -4 }))])).toEqual(['{p1} moves back 4']);
  });

  it('lists a skip and a backward roll under NEXT ROLL', () => {
    expect(nextRollMods([fx('skipRoll'), fx('reverseRoll')], 'p0')).toEqual(['Skip', 'Backward']);
  });

  it('names the new effects on their chips', () => {
    const names = new Map([['p1', 'Juno']]);
    expect(effectChip(fx('skipRoll'), names)).toMatchObject({ icon: 'lock', description: 'Skips the next roll, from Juno' });
    expect(effectChip(fx('reverseRoll'), names)).toMatchObject({ icon: 'back', description: 'Next roll moves back, from Juno' });
    expect(effectChip(fx('beforeSnakeOrAttack', 'p1'), names)).toMatchObject({ icon: 'aegis', description: 'Blocks the next whirlpool or attack' });
    expect(effectChip(fx('jumpsOff', 'p1', { rounds: 1 }), names)).toMatchObject({ icon: 'slide', description: 'Rockets and whirlpools do nothing, for everyone' });
  });

  it('greys the snakes and ladders while they are off', () => {
    const red = new Color('#ff0000');
    expect(offTone(red.clone(), false).equals(red)).toBe(true);
    expect(offTone(red.clone(), true).equals(red.clone().lerp(OFF_TINT, 0.75))).toBe(true);
  });

  it("shows who skips, and tells me when it's me", () => {
    const update = openingUpdate();
    const view = {
      ...update.view,
      phase: { kind: 'dice', seqs: { p0: { faces: [], status: 'skipped' }, p1: { faces: [], status: 'ready' } } },
      awaiting: { ...update.view.awaiting, window: 'dice', players: ['p1'] },
    } as never;
    expect(statusText(view, 'p0', 'p1')).toBe('Skips this roll');
    expect(dockModel({ beat: null, view, record: { round: 1, dice: {}, cards: {} }, me: 'p0' } as never)).toMatchObject({
      kind: 'wait',
      parts: ['You skip this roll. Waiting for ', { player: 'p1' }, ' to roll'],
    });
  });
});
