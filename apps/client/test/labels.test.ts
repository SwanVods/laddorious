import { STARTER_CARDS, type ActiveEffect, type EffectParams, type Lifetime, type PlayerView } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { cardInfo, effectChip, fizzleWarning, nextRollMods, rejectionText, targetLine } from '../src/hud/labels';
import { openingUpdate } from './support/fixtures';

const names = new Map([['p0', 'You'], ['p1', 'Mochi']]);

function effect(params: EffectParams, lifetime: Lifetime, extra: Partial<ActiveEffect> = {}): ActiveEffect {
  return { id: 'e1', owner: 'p0', sourceCard: 'shield', sourcePlayer: 'p0', params, lifetime, createdRound: 5, seq: 1, ...extra };
}

/** The opening view with these tile positions. */
function viewAt(positions: Record<string, number>): PlayerView {
  const { view } = openingUpdate();
  return { ...view, players: view.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })) };
}

describe('card labels (spec #2 §7.2)', () => {
  it('reads name, text, type, rarity and icon from the starter set', () => {
    expect(cardInfo('heavy-boots')).toEqual({
      id: 'heavy-boots',
      name: 'Heavy Boots',
      text: "The leader's next dice total is reduced by 3.",
      type: 'attack',
      rarity: 'rare',
      targetLine: 'The leader',
      icon: 'boot',
      summary: 'Leader: −3 on next roll', // it doesn't move anyone now (2026-10-15)
    });
  });

  it('gives every starter card a short one-line summary for its bubble (polish pass)', () => {
    for (const card of STARTER_CARDS) {
      const { summary } = cardInfo(card.id);
      expect(summary, card.id).not.toBe(card.text);
      expect(summary.length, card.id).toBeLessThanOrEqual(40);
    }
    expect(cardInfo('shield').summary).toBe('Block the next attack');
  });

  it('writes the target line from the targeting rule', () => {
    expect(targetLine({ condition: 'self', pick: 'self', tieBreak: 'lowest-seat' })).toBe('You');
    expect(targetLine({ condition: 'ahead-of-caster', pick: 'nearest', tieBreak: 'random' })).toBe('Nearest player ahead');
    expect(targetLine({ condition: 'ahead-of-caster', pick: 'furthest', tieBreak: 'random' })).toBe('Furthest player ahead');
    expect(targetLine({ condition: 'other', pick: 'last', tieBreak: 'random' })).toBe('The player in last place');
    expect(targetLine({ condition: 'section', section: [40, 60], pick: 'nearest', tieBreak: 'random' })).toBe('A player on tiles 40–60');
  });

  it('warns when a card would fizzle on the board as it is', () => {
    expect(fizzleWarning('shove', viewAt({ p0: 50, p1: 10, p2: 20, p3: 30 }))).toBe('Nobody is ahead of you right now. If that holds, it fizzles.');
    expect(fizzleWarning('shove', viewAt({ p0: 5, p1: 10 }))).toBeNull();
    expect(fizzleWarning('sprint', viewAt({ p0: 50 }))).toBeNull();
    const noPads = { ...viewAt({ p0: 95 }) };
    expect(fizzleWarning('ladder-warp', { ...noPads, board: { ...noPads.board, jumps: [] } })).toBe('No launch pad ahead of you right now. If that holds, it fizzles.');
  });
});

describe('effect chips (spec #2 §7.2)', () => {
  it('shows dice modifiers as badges, saying who cast them', () => {
    expect(effectChip(effect({ hook: 'diceTotal', op: 'add', value: -3 }, { charges: 1 }, { sourceCard: 'heavy-boots', sourcePlayer: 'p1' }), names)).toEqual({
      id: 'e1',
      icon: 'boot',
      badge: '−3',
      name: 'Heavy Boots',
      description: 'Next dice total −3, from Mochi',
      life: '1 use',
    });
    expect(effectChip(effect({ hook: 'diceTotal', op: 'multiply', value: 2 }, { charges: 1 }, { sourceCard: 'overdrive' }), names).badge).toBe('×2');
    expect(effectChip(effect({ hook: 'diceFace', die: 'first', set: 6 }, { charges: 1 }, { sourceCard: 'loaded-die' }), names).description).toBe('Next die shows 6');
  });

  it('shows shields with their uses and the round they end', () => {
    const chip = effectChip(effect({ hook: 'beforeAttack' }, { rounds: 3, charges: 1 }), names);
    expect(chip).toMatchObject({ icon: 'shield', badge: '×1', name: 'Shield', description: 'Blocks the next attack', life: '1 use · until round 8' });
    expect(effectChip(effect({ hook: 'beforeSnake' }, { rounds: 2 }, { sourceCard: 'aegis' }), names).badge).toBe('2r');
  });
});

describe('next roll modifiers', () => {
  it('lists my modifiers in the order the engine applies them: face, newest Replace, Multiply, Add', () => {
    const effects = [
      effect({ hook: 'diceTotal', op: 'add', value: -3 }, { charges: 1 }, { id: 'a', seq: 1 }),
      effect({ hook: 'diceTotal', op: 'replace', value: 4 }, { charges: 1 }, { id: 'b', seq: 2 }),
      effect({ hook: 'diceTotal', op: 'replace', value: 5 }, { charges: 1 }, { id: 'c', seq: 3 }),
      effect({ hook: 'diceTotal', op: 'multiply', value: 2 }, { charges: 1 }, { id: 'd', seq: 4 }),
      effect({ hook: 'diceFace', die: 'first', set: 6 }, { charges: 1 }, { id: 'e', seq: 5 }),
      effect({ hook: 'diceTotal', op: 'add', value: 2 }, { charges: 1 }, { id: 'f', seq: 6, owner: 'p1' }),
    ];
    expect(nextRollMods(effects, 'p0')).toEqual(['Die = 6', 'Total = 5', 'Total ×2', 'Total −3']);
    expect(nextRollMods([], 'p0')).toEqual([]);
  });
});

describe('rejected actions (spec #2 §8)', () => {
  it('explains a late or doubled action in a few words', () => {
    expect(rejectionText('STALE_INPUT')).toBe('Too late, that window closed');
    expect(rejectionText('NOT_AWAITED')).toBe('Too late, that window closed');
    expect(rejectionText('ALREADY_PICKED')).toBe('You already picked');
    expect(rejectionText('REROLL_LIMIT')).toBe('No rerolls left');
    expect(rejectionText('SLOT_ALREADY_REROLLED')).toBe('That card was already rerolled');
    expect(rejectionText('MATCH_FINISHED')).toBe('The match is over');
    expect(rejectionText('INVALID_INPUT')).toBe("That didn't work. Try again.");
  });
});
