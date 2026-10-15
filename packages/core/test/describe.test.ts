import { describe, expect, it } from 'vitest';
import { describeCard, type CatalogCard, type TargetRule } from '../src/index';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const LEADER: TargetRule = { condition: 'other', pick: 'leader', tieBreak: 'random' };
const AHEAD: TargetRule = { condition: 'ahead-of-caster', pick: 'nearest', tieBreak: 'random' };
const make = (effects: CatalogCard['effects'], over: Partial<CatalogCard> = {}): CatalogCard => ({ id: 'x', name: 'X', type: 'movement', rarity: 'common', weight: 1, target: SELF, effects, ...over });

describe('card text from steps (2026-10-15)', () => {
  it.each([
    [make([{ op: 'moveRelative', amount: 3 }]), 'Move forward 3.'],
    [make([{ op: 'moveRelative', amount: -1 }]), 'Move back 1.'],
    [make([{ op: 'moveRelative', amount: -3 }], { target: AHEAD }), 'The player just ahead of you moves back 3.'],
    [make([{ op: 'moveTo', rule: 'nearest-ladder-foot-ahead' }]), 'Move to the nearest ladder ahead of you.'],
    [make([{ op: 'swap' }], { target: LEADER }), 'Swap places with the leader.'],
    [make([{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'multiply', value: 2 }, lifetime: { charges: 1 } } }]), 'Your next roll is doubled.'],
    [make([{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'multiply', value: 3 }, lifetime: { charges: 1 } } }]), 'Your next roll is tripled.'],
    [make([{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'add', value: -3 }, lifetime: { charges: 1 } } }], { target: LEADER }), "The leader's next roll gets −3."],
    [make([{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'replace', value: 4 }, lifetime: { charges: 1 } } }]), 'Your next roll is exactly 4.'],
    [make([{ op: 'addEffect', template: { params: { hook: 'beforeAttack' }, lifetime: { rounds: 3, charges: 1 } } }]), 'Block the next attack on you (3 rounds).'],
    [make([{ op: 'addEffect', template: { params: { hook: 'beforeSnake' }, lifetime: { charges: 1 } } }]), 'Ignore the next snake you land on, any time this match.'],
    [make([{ op: 'addEffect', template: { params: { hook: 'beforeAttack' }, lifetime: { charges: 2 } } }]), 'Block the next 2 attacks on you, any time this match.'],
    [make([{ op: 'removeEffects', filter: { createdByOthers: true }, count: 'all' }]), 'Remove every effect other players put on you.'],
    [make([{ op: 'boardEdit', action: 'create', kind: 'snake', minAhead: 1, maxAhead: 6, length: 8, lifetime: { rounds: 3 } }], { target: LEADER }), 'A new snake, 8 tiles long, appears 1–6 tiles ahead of the leader (3 rounds).'],
    [make([{ op: 'gamble', outcomes: [{ weight: 40, ops: [{ op: 'moveRelative', amount: 15 }] }, { weight: 60, ops: [{ op: 'moveRelative', amount: -8 }] }] }]), '40%: move forward 15. 60%: move back 8.'],
    [make([{ op: 'conditional', trigger: { cause: 'dice', condition: 'landedOnSnakeHead' }, amount: 8, lifetime: { charges: 1 } }]), 'Next time you land on a snake head, move forward 8 after sliding.'],
  ])('%#: %s', (card, text) => {
    expect(describeCard(card)).toBe(text);
  });

  it("shows a value's range before the match, and the picked number during it", () => {
    const card = make([{ op: 'addEffect', template: { params: { hook: 'diceFace', die: 'first', set: { value: 'n' } }, lifetime: { charges: 1 } } }], { values: { n: { min: 1, max: 6 } } });
    expect(describeCard(card)).toBe('Your next die shows 1–6.');
    expect(describeCard(card, { n: 4 })).toBe('Your next die shows 4.');
    const flip = make([{ op: 'gamble', outcomes: [{ weight: 50, ops: [{ op: 'moveRelative', amount: { value: 'n' } }] }, { weight: 50, ops: [{ op: 'moveRelative', amount: { value: 'n', negate: true } }] }] }], { values: { n: { min: 1, max: 6 } } });
    expect(describeCard(flip, { n: 5 })).toBe('50%: move forward 5. 50%: move back 5.');
  });

  it('uses the hand-written text when the card has one', () => {
    expect(describeCard(make([{ op: 'moveRelative', amount: 3 }], { text: 'Zoom!' }))).toBe('Zoom!');
  });
});
