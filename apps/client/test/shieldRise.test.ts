import type { ActiveEffect, GameEvent } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { buildTimeline, cardLeadOf } from '../src/director/beats';
import { presentationFromView } from '../src/director/presentation';
import { shieldRising } from '../src/scene/motion';
import { openingUpdate } from './support/fixtures';

// A Shield shows as its card plays, while the camera is on the piece (2026-10-17), not after the card's pause.

const shield: ActiveEffect = { id: 'e1', owner: 'p0', sourceCard: 'shield', sourcePlayer: 'p0', params: { hook: 'beforeAttack' }, lifetime: { rounds: 5, charges: 1 }, createdRound: 1, seq: 1 };
const events: GameEvent[] = [
  { type: 'CardResolved', caster: 'p0', cardId: 'shield', target: 'p0', result: 'hit', visibility: 'public' },
  { type: 'EffectAdded', effect: shield, visibility: 'public' },
];
const timeline = () => buildTimeline(events, presentationFromView(openingUpdate().view), 'p0', 100);

describe('a shield going up (2026-10-17)', () => {
  it("puts a card's new effect in the card's own beat, not after its pause", () => {
    const [card] = timeline();
    expect(card!.kind).toBe('cardResolved');
    expect(card!.events.map((e) => e.type)).toEqual(['CardResolved', 'EffectAdded']);
    expect(card!.after.effects).toContainEqual(shield);
  });

  it('raises the bubble as the piece hops, after the lead-in, only on its owner', () => {
    const [card] = timeline();
    const beat = { ...card!, startedAt: 1000 };
    expect(shieldRising(beat, 'p0', 1000)).toBe(false);
    expect(shieldRising(beat, 'p0', 1000 + cardLeadOf(beat))).toBe(true);
    expect(shieldRising(beat, 'p1', 1000 + cardLeadOf(beat))).toBe(false);
  });

  it("doesn't raise one for an effect that isn't a shield", () => {
    const boots: ActiveEffect = { ...shield, params: { hook: 'diceTotal', op: 'add', value: -3 } };
    const [card] = buildTimeline([events[0]!, { type: 'EffectAdded', effect: boots, visibility: 'public' }], presentationFromView(openingUpdate().view), 'p0', 100);
    expect(shieldRising({ ...card!, startedAt: 0 }, 'p0', 10_000)).toBe(false);
  });
});
