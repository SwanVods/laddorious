import type { GameEvent, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { cuesForBeat } from '../src/audio/cues';
import { BEAT_MS, buildTimeline, cardLeadOf, cardRollAt } from '../src/director/beats';
import type { PlayingBeat } from '../src/director/director';
import { presentationFromView, type PresentationState } from '../src/director/presentation';
import { projectileAt, shieldBlocking } from '../src/scene/motion';
import { openingUpdate } from './support/fixtures';

// A card's own die shows (the user, 2026-10-16): after the camera's lead-in it tumbles above the caster and lands
// on the roll, and only then does the card play.

const from: PresentationState = (() => {
  const shown = presentationFromView(openingUpdate().view);
  return { ...shown, positions: { ...shown.positions, p0: 10, p1: 20 } };
})();
const resolved = (over: object): GameEvent => ({ type: 'CardResolved', caster: 'p1', cardId: 'long-shot', target: 'p0', result: 'hit', visibility: 'public', ...over }) as GameEvent;
const beatOf = (e: GameEvent): PlayingBeat => ({ ...buildTimeline([e], from, 'p0', 100)[0]!, startedAt: 1000 });
const seatOf = (id: PlayerId) => Number(id.slice(1));
const shot = beatOf(resolved({ roll: 4 }));
const plain = beatOf(resolved({}));

describe("a card's die roll on screen (2026-10-16)", () => {
  it('makes the card wait for the tumble, only when it rolls', () => {
    expect(BEAT_MS.cardRoll).toBeGreaterThanOrEqual(400);
    expect(cardLeadOf(shot)).toBe(BEAT_MS.cardLead + BEAT_MS.cardRoll);
    expect(cardLeadOf(plain)).toBe(BEAT_MS.cardLead);
    expect(shot.durationMs).toBe(plain.durationMs + BEAT_MS.cardRoll);
  });

  it("tumbles the caster's die after the lead-in, landing on the roll", () => {
    expect(cardRollAt(shot)).toEqual({ player: 'p1', face: 4, startedAt: 1000 + BEAT_MS.cardLead, durationMs: BEAT_MS.cardRoll });
    expect(cardRollAt(plain)).toBeNull();
  });

  it('throws the projectile only once the die has landed', () => {
    const landed = 1000 + BEAT_MS.cardLead + BEAT_MS.cardRoll;
    expect(projectileAt(shot, from, seatOf, landed - 10)).toBeNull();
    expect(projectileAt(shot, from, seatOf, landed + 10)).not.toBeNull();
  });

  it('flares a blocking shield only after the die has landed', () => {
    const blocked = beatOf(resolved({ roll: 3, result: 'blocked' }));
    const landed = 1000 + BEAT_MS.cardLead + BEAT_MS.cardRoll;
    expect(shieldBlocking(blocked, 'p0', landed)).toBe(false);
    expect(shieldBlocking(blocked, 'p0', blocked.startedAt + blocked.durationMs)).toBe(true);
  });

  it('plays a die sound as it tumbles, and the hit as it lands', () => {
    expect(cuesForBeat(shot, { me: 'p1', boardSize: 100 })).toEqual([
      { id: 'D2', atMs: BEAT_MS.cardLead, soft: false },
      { id: 'C5', atMs: BEAT_MS.cardLead + BEAT_MS.cardRoll, soft: false },
    ]);
    expect(cuesForBeat(shot, { me: 'p3', boardSize: 100 }).map((c) => [c.id, c.soft])).toEqual([['D3', true], ['C5', true]]);
  });
});
