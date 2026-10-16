import type { CardDef, TargetRule } from './types';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const LEADER: TargetRule = { condition: 'other', pick: 'leader', tieBreak: 'random' };

/** Spec §6 — placeholder content that exercises every framework feature. */
export const STARTER_CARDS: CardDef[] = [
  {
    id: 'sprint', name: 'Sprint', text: 'Move forward 3.',
    type: 'movement', rarity: 'common', weight: 1, target: SELF,
    effects: [{ op: 'moveRelative', amount: 3 }],
  },
  {
    id: 'loaded-die', name: 'Loaded Die', text: 'Your next die shows 6.',
    type: 'movement', rarity: 'rare', weight: 1, target: SELF,
    effects: [{ op: 'addEffect', template: { params: { hook: 'diceFace', die: 'first', set: 6 }, lifetime: { charges: 1 } } }],
  },
  {
    id: 'overdrive', name: 'Overdrive', text: 'Your next dice total is doubled.',
    type: 'movement', rarity: 'epic', weight: 1, target: SELF,
    effects: [{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'multiply', value: 2 }, lifetime: { charges: 1 } } }],
  },
  {
    id: 'ladder-warp', name: 'Ladder Warp', text: 'Move to the nearest ladder foot ahead of you.',
    type: 'movement', rarity: 'epic', weight: 1, target: SELF,
    effects: [{ op: 'moveTo', rule: 'nearest-ladder-foot-ahead' }],
  },
  {
    id: 'snake-charm', name: 'Snake Charm', text: 'Ignore the next snake you land on (3 rounds).',
    type: 'defense', rarity: 'common', weight: 1, target: SELF,
    effects: [{ op: 'addEffect', template: { params: { hook: 'beforeSnake' }, lifetime: { rounds: 3, charges: 1 } } }],
  },
  {
    id: 'shield', name: 'Shield', text: 'Block the next attack against you (3 rounds).',
    type: 'defense', rarity: 'rare', weight: 1, target: SELF,
    effects: [{ op: 'addEffect', template: { params: { hook: 'beforeAttack' }, lifetime: { rounds: 3, charges: 1 } } }],
  },
  {
    id: 'aegis', name: 'Aegis', text: 'Block all attacks and snakes for 2 rounds.',
    type: 'defense', rarity: 'epic', weight: 1, target: SELF,
    effects: [
      { op: 'addEffect', template: { params: { hook: 'beforeAttack' }, lifetime: { rounds: 2 } } },
      { op: 'addEffect', template: { params: { hook: 'beforeSnake' }, lifetime: { rounds: 2 } } },
    ],
  },
  {
    id: 'shove', name: 'Shove', text: 'The nearest player ahead of you moves back 3.',
    type: 'attack', rarity: 'common', weight: 1,
    target: { condition: 'ahead-of-caster', pick: 'nearest', tieBreak: 'random' },
    effects: [{ op: 'moveRelative', amount: -3 }],
  },
  {
    id: 'heavy-boots', name: 'Heavy Boots', text: "The leader's next dice total is reduced by 3.",
    type: 'attack', rarity: 'rare', weight: 1, target: LEADER,
    effects: [{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'add', value: -3 }, lifetime: { charges: 1 } } }],
  },
  {
    id: 'switcheroo', name: 'Switcheroo', text: 'Swap places with the furthest player ahead of you.',
    type: 'attack', rarity: 'epic', weight: 1,
    target: { condition: 'ahead-of-caster', pick: 'furthest', tieBreak: 'random' },
    effects: [{ op: 'swap' }],
  },
  {
    id: 'coin-flip', name: 'Coin Flip', text: '50%: move forward 4. 50%: move back 4.',
    type: 'risky', rarity: 'common', weight: 1, target: SELF,
    effects: [{ op: 'gamble', outcomes: [
      { weight: 50, ops: [{ op: 'moveRelative', amount: 4 }] },
      { weight: 50, ops: [{ op: 'moveRelative', amount: -4 }] },
    ] }],
  },
  {
    id: 'snake-bait', name: 'Snake Bait', text: 'Next time you land on a snake head, move forward 8 after sliding.',
    type: 'risky', rarity: 'rare', weight: 1, target: SELF,
    effects: [{ op: 'conditional', trigger: { cause: 'dice', condition: 'landedOnSnakeHead' }, amount: 8, lifetime: { charges: 1 } }],
  },
  {
    id: 'jackpot', name: 'Jackpot', text: '40%: move forward 15. 60%: move back 8.',
    type: 'risky', rarity: 'epic', weight: 1, target: SELF,
    effects: [{ op: 'gamble', outcomes: [
      { weight: 40, ops: [{ op: 'moveRelative', amount: 15 }] },
      { weight: 60, ops: [{ op: 'moveRelative', amount: -8 }] },
    ] }],
  },
  {
    id: 'steady-hand', name: 'Steady Hand', text: 'Your next dice total becomes exactly 4.',
    type: 'misc', rarity: 'common', weight: 1, target: SELF,
    effects: [{ op: 'addEffect', template: { params: { hook: 'diceTotal', op: 'replace', value: 4 }, lifetime: { charges: 1 } } }],
  },
  {
    id: 'cleanse', name: 'Cleanse', text: 'Remove all effects on you created by other players.',
    type: 'misc', rarity: 'common', weight: 1, target: SELF,
    effects: [{ op: 'removeEffects', filter: { createdByOthers: true }, count: 'all' }],
  },
  {
    id: 'snake-pit', name: 'Snake Pit', text: 'Create a snake (length 8) 2–6 tiles ahead of the leader for 3 rounds.',
    type: 'misc', rarity: 'rare', weight: 1, target: LEADER,
    effects: [{ op: 'boardEdit', action: 'create', kind: 'snake', minAhead: 2, maxAhead: 6, length: 8, lifetime: { rounds: 3 } }],
  },
  {
    id: 'ladder-drop', name: 'Ladder Drop', text: 'Create a ladder (length 15) 2–6 tiles ahead of you for 2 rounds.',
    type: 'misc', rarity: 'epic', weight: 1, target: SELF,
    effects: [{ op: 'boardEdit', action: 'create', kind: 'ladder', minAhead: 2, maxAhead: 6, length: 15, lifetime: { rounds: 2 } }],
  },
];
