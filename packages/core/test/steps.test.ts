import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, STARTER_CARDS, STEP_KINDS, stepKindOf, statusOf, type Templated, type EffectOp } from '../src/index';

const allOps = (ops: Templated<EffectOp>[]): Templated<EffectOp>[] => ops.flatMap((op) => (op.op === 'gamble' ? [op, ...op.outcomes.flatMap((o) => allOps(o.ops))] : [op]));

describe('the editor step catalogue (2026-10-15)', () => {
  it('reads and writes back every step of every card, unchanged', () => {
    const cards = [...CARD_CATALOG.cards.filter((c) => statusOf(c) !== 'draft'), ...STARTER_CARDS];
    for (const card of cards) {
      for (const op of allOps(card.effects)) {
        if (op.op === 'gamble') continue;
        const kind = stepKindOf(op);
        expect(kind.write(kind.read(op)!), `${card.id}: ${kind.id}`).toEqual(op);
      }
    }
  });

  it('makes a valid new step of every kind', () => {
    for (const kind of STEP_KINDS) {
      const op = kind.make();
      expect(stepKindOf(op).id).toBe(kind.id);
    }
  });
});
