import type { Amount, Templated } from './catalogFile';
import type { EffectOp, Lifetime, TargetRule } from './types';

// The card editor's steps (2026-10-15): each kind of step a card can take, with the fields the editor shows,
// and how it maps to the engine's op. A new building block adds its kind here and appears in the editor.

type Op = Templated<EffectOp>;
export type FieldKind = 'amount' | 'count' | 'choice';
export interface StepField {
  key: string;
  label: string;
  kind: FieldKind;
  min?: number;
  max?: number;
  choices?: Array<[string, string]>;
  /** The field may be the card's own die (2026-10-15). */
  die?: boolean;
}
export interface StepKind {
  id: string;
  label: string;
  fields: StepField[];
  make(): Op;
  read(op: Op): Record<string, unknown> | null;
  write(values: Record<string, unknown>): Op;
}

const USES: StepField = { key: 'charges', label: 'uses (0 = no limit)', kind: 'count', min: 0 };
const ROUNDS: StepField = { key: 'rounds', label: 'rounds (0 = no limit)', kind: 'count', min: 0 };

const lifeOf = (l: Templated<Lifetime>): { charges: Amount; rounds: Amount } =>
  l === 'permanent' ? { charges: 0, rounds: 0 } : { charges: l.charges ?? 0, rounds: l.rounds ?? 0 };
const lifeFrom = (v: Record<string, unknown>): Templated<Lifetime> => {
  const out: { charges?: Amount; rounds?: Amount } = {};
  if (v.charges !== 0) out.charges = v.charges as Amount;
  if (v.rounds !== 0) out.rounds = v.rounds as Amount;
  return out.charges === undefined && out.rounds === undefined ? 'permanent' : out;
};

/** An addEffect step whose params are fixed but for one number field. */
function effectKind(id: string, label: string, hook: string, extra: Record<string, unknown>, field: StepField | null, start: Record<string, unknown>): StepKind {
  return {
    id,
    label,
    fields: [...(field ? [field] : []), USES, ROUNDS],
    make: () => writeOp({ ...start }),
    read(op) {
      if (op.op !== 'addEffect') return null;
      const p = op.template.params as Record<string, unknown>;
      if (p.hook !== hook || !Object.entries(extra).every(([k, v]) => p[k] === v)) return null;
      return { ...(field ? { [field.key]: p[field.key] } : {}), ...lifeOf(op.template.lifetime) };
    },
    write: (v) => writeOp(v),
  };
  function writeOp(v: Record<string, unknown>): Op {
    return { op: 'addEffect', template: { params: { hook, ...extra, ...(field ? { [field.key]: v[field.key] } : {}) } as never, lifetime: lifeFrom(v) } };
  }
}

function boardKind(id: string, label: string, kind: 'snake' | 'ladder', length: number): StepKind {
  return {
    id,
    label,
    fields: [
      { key: 'minAhead', label: 'nearest tile ahead', kind: 'amount', min: 1 },
      { key: 'maxAhead', label: 'furthest tile ahead', kind: 'amount', min: 1 },
      { key: 'length', label: 'length', kind: 'amount', min: 1 },
      { key: 'rounds', label: 'rounds (0 = rest of the match)', kind: 'count', min: 0 },
    ],
    make: () => ({ op: 'boardEdit', action: 'create', kind, minAhead: 1, maxAhead: 6, length, lifetime: { rounds: 3 } }),
    read: (op) =>
      op.op === 'boardEdit' && op.action === 'create' && op.kind === kind
        ? { minAhead: op.minAhead, maxAhead: op.maxAhead, length: op.length, rounds: op.lifetime === 'permanent' ? 0 : op.lifetime.rounds }
        : null,
    write: (v) => ({ op: 'boardEdit', action: 'create', kind, minAhead: v.minAhead as Amount, maxAhead: v.maxAhead as Amount, length: v.length as Amount, lifetime: v.rounds === 0 ? 'permanent' : { rounds: v.rounds as Amount } }),
  };
}

export const STEP_KINDS: StepKind[] = [
  {
    id: 'move', label: 'Move', fields: [{ key: 'amount', label: 'amount', kind: 'amount', die: true }],
    make: () => ({ op: 'moveRelative', amount: 3 }),
    read: (op) => (op.op === 'moveRelative' ? { amount: op.amount } : null),
    write: (v) => ({ op: 'moveRelative', amount: v.amount as Amount }),
  },
  {
    id: 'toLadder', label: 'Go to the nearest ladder ahead', fields: [],
    make: () => ({ op: 'moveTo', rule: 'nearest-ladder-foot-ahead' }),
    read: (op) => (op.op === 'moveTo' ? {} : null),
    write: () => ({ op: 'moveTo', rule: 'nearest-ladder-foot-ahead' }),
  },
  { id: 'swap', label: 'Swap places', fields: [], make: () => ({ op: 'swap' }), read: (op) => (op.op === 'swap' ? {} : null), write: () => ({ op: 'swap' }) },
  effectKind('dieShows', 'Next die shows', 'diceFace', { die: 'first' }, { key: 'set', label: 'face', kind: 'amount', min: 1, max: 6 }, { set: 6, charges: 1, rounds: 0 }),
  effectKind('rollPlus', 'Next roll + / −', 'diceTotal', { op: 'add' }, { key: 'value', label: 'plus (negative = minus)', kind: 'amount', die: true }, { value: 2, charges: 1, rounds: 0 }),
  effectKind('rollTimes', 'Next roll ×', 'diceTotal', { op: 'multiply' }, { key: 'value', label: 'times', kind: 'amount', min: 0 }, { value: 2, charges: 1, rounds: 0 }),
  effectKind('rollExactly', 'Next roll is exactly', 'diceTotal', { op: 'replace' }, { key: 'value', label: 'total', kind: 'amount', min: 0 }, { value: 4, charges: 1, rounds: 0 }),
  effectKind('blockAttack', 'Block attacks', 'beforeAttack', {}, null, { charges: 1, rounds: 3 }),
  effectKind('blockSnake', 'Ignore snakes', 'beforeSnake', {}, null, { charges: 1, rounds: 3 }),
  {
    id: 'snakeThenMove', label: 'After a snake, move', fields: [{ key: 'amount', label: 'amount', kind: 'amount' }, USES, ROUNDS],
    make: () => ({ op: 'conditional', trigger: { cause: 'dice', condition: 'landedOnSnakeHead' }, amount: 8, lifetime: { charges: 1 } }),
    read: (op) => (op.op === 'conditional' ? { amount: op.amount, ...lifeOf(op.lifetime) } : null),
    write: (v) => ({ op: 'conditional', trigger: { cause: 'dice', condition: 'landedOnSnakeHead' }, amount: v.amount as Amount, lifetime: lifeFrom(v) }),
  },
  boardKind('newSnake', 'New snake', 'snake', 8),
  boardKind('newLadder', 'New ladder', 'ladder', 15),
  {
    id: 'cleanse', label: "Remove others' effects", fields: [],
    make: () => ({ op: 'removeEffects', filter: { createdByOthers: true }, count: 'all' }),
    read: (op) => (op.op === 'removeEffects' && op.filter.createdByOthers && op.count === 'all' ? {} : null),
    write: () => ({ op: 'removeEffects', filter: { createdByOthers: true }, count: 'all' }),
  },
  {
    id: 'gamble', label: 'Gamble', fields: [],
    make: () => ({ op: 'gamble', outcomes: [{ weight: 50, ops: [{ op: 'moveRelative', amount: 4 }] }, { weight: 50, ops: [{ op: 'moveRelative', amount: -4 }] }] }),
    read: (op) => (op.op === 'gamble' ? { outcomes: op.outcomes } : null),
    write: (v) => ({ op: 'gamble', outcomes: v.outcomes as never }),
  },
];

export function stepKindOf(op: Op): StepKind {
  const kind = STEP_KINDS.find((k) => k.read(op) !== null);
  if (!kind) throw new Error(`no editor step reads ${JSON.stringify(op)}`);
  return kind;
}

/** Who a card hits, as the editor offers it. */
export const TARGETS: Array<[string, string, TargetRule]> = [
  ['self', 'You', { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' }],
  ['leader', 'The leader', { condition: 'other', pick: 'leader', tieBreak: 'random' }],
  ['ahead', 'The player just ahead', { condition: 'ahead-of-caster', pick: 'nearest', tieBreak: 'random' }],
  ['furthest', 'The furthest player ahead', { condition: 'ahead-of-caster', pick: 'furthest', tieBreak: 'random' }],
  ['behind', 'The player just behind', { condition: 'behind-of-caster', pick: 'nearest', tieBreak: 'random' }],
  ['last', 'The player in last place', { condition: 'other', pick: 'last', tieBreak: 'random' }],
  ['others', 'Everyone else', { condition: 'other', pick: 'all', tieBreak: 'lowest-seat' }],
  ['everyone', 'Everyone', { condition: 'everyone', pick: 'all', tieBreak: 'lowest-seat' }],
];
