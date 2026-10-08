import type { GameEvent, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { BeatKind } from '../src/director/beats';
import type { PlayingBeat } from '../src/director/director';
import type { PresentationState } from '../src/director/presentation';
import { BUBBLE_LINGER_MS, bubbleLevels, bubbleStep, visibleBubbles } from '../src/hud/bubbles';

const selected = (player: PlayerId, cardId: string): GameEvent => ({ type: 'CardSelected', player, cardId, cardType: 'movement', rarity: 'common', auto: false, visibility: 'public' });
const resolved = (caster: PlayerId, cardId: string): GameEvent => ({ type: 'CardResolved', caster, cardId, target: null, result: 'hit', visibility: 'public' });
const beat = (kind: BeatKind, events: GameEvent[], startedAt = 0, durationMs = 1000): PlayingBeat => ({
  kind,
  events,
  startedAt,
  durationMs,
  after: {} as PresentationState,
});

describe('card bubbles (polish spec §4.4)', () => {
  it('pops a bubble over each caster when the cards are revealed', () => {
    const b = bubbleStep({}, beat('cardReveal', [selected('p0', 'sprint'), selected('p2', 'shove')]), 0, 1);
    expect(b).toEqual({ p0: { cardId: 'sprint', leaveAt: null }, p2: { cardId: 'shove', leaveAt: null } });
  });

  it("lets a caster's bubble go 0.8 s after their card's beat ends; the others stay", () => {
    const shown = bubbleStep({}, beat('cardReveal', [selected('p0', 'sprint'), selected('p2', 'shove')]), 0, 1);
    const b = bubbleStep(shown, beat('cardResolved', [resolved('p2', 'shove')], 2000, 1400), 2000, 1);
    expect(b.p2).toEqual({ cardId: 'shove', leaveAt: 2000 + 1400 + BUBBLE_LINGER_MS });
    expect(b.p0).toEqual({ cardId: 'sprint', leaveAt: null });
    expect(Object.keys(visibleBubbles(b, 4199))).toEqual(['p0', 'p2']);
    expect(Object.keys(visibleBubbles(b, 4200))).toEqual(['p0']);
  });

  it('scales the linger with the time scale', () => {
    const shown = bubbleStep({}, beat('cardReveal', [selected('p0', 'sprint')]), 0, 0.05);
    expect(bubbleStep(shown, beat('cardResolved', [resolved('p0', 'sprint')], 100, 70), 100, 0.05).p0!.leaveAt).toBe(100 + 70 + BUBBLE_LINGER_MS * 0.05);
  });

  it('sends every waiting bubble off once the timeline ends, so a skipped resolution leaves none behind', () => {
    const shown = bubbleStep({}, beat('cardReveal', [selected('p0', 'sprint'), selected('p1', 'cleanse')]), 0, 1);
    const b = bubbleStep(shown, null, 5000, 1);
    expect(b.p0!.leaveAt).toBe(5000 + BUBBLE_LINGER_MS);
    expect(visibleBubbles(b, 5000 + BUBBLE_LINGER_MS)).toEqual({});
  });

  it('clears every bubble for the victory', () => {
    const shown = bubbleStep({}, beat('cardReveal', [selected('p0', 'sprint')]), 0, 1);
    expect(bubbleStep(shown, beat('victory', []), 100, 1)).toEqual({});
  });

  it('stacks the bubbles of pieces sharing a tile, in seat order', () => {
    const levels = bubbleLevels({ p0: { cardId: 'a', leaveAt: null }, p2: { cardId: 'b', leaveAt: null }, p3: { cardId: 'c', leaveAt: null } }, { p0: 12, p1: 12, p2: 12, p3: 30 }, ['p0', 'p1', 'p2', 'p3']);
    expect(levels).toEqual({ p0: 0, p2: 1, p3: 0 });
  });
});
