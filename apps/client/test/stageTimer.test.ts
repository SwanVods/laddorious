import { describe, expect, it } from 'vitest';
import type { Beat } from '../src/director/beats';
import type { PlayingBeat } from '../src/director/director';
import { presentationFromView } from '../src/director/presentation';
import { STAGES, stageIndex, stageTimer } from '../src/hud/model';
import { openingUpdate } from './support/fixtures';

// The top bar's timer (the user, 2026-10-16): a window's countdown shows only in that window's own stage, never
// through the moves or the cards that play before it; and the break between rounds is a stage with its own countdown.

const after = presentationFromView(openingUpdate().view);
const beat = (kind: Beat['kind'], startedAt = 0, durationMs = 1000): PlayingBeat => ({ kind, durationMs, events: [], after, startedAt });
const dice = { endsAt: 20_000 };

describe('the stage bar timer (2026-10-16)', () => {
  it('has a Break stage after the cards', () => {
    expect(STAGES.map((s) => s.label)).toEqual(['Dice', 'Move', 'Face-off', 'Mystery', 'Cards', 'Break']);
    expect(stageIndex(beat('roundBreak'), 'dice', 4)).toBe(5);
  });

  it("counts a window down in its own stage, other players' rolls included", () => {
    expect(stageTimer({ beat: null, stage: 0, window: 'dice', timer: dice, durationMs: 12_000, nowMs: 14_000, timeScale: 1 })).toEqual({ seconds: 6, fraction: 0.5 });
    expect(stageTimer({ beat: beat('roll'), stage: 0, window: 'dice', timer: dice, durationMs: 12_000, nowMs: 14_000, timeScale: 1 })).not.toBeNull();
  });

  it('shows no countdown while the moves or the cards play out', () => {
    expect(stageTimer({ beat: beat('move'), stage: 1, window: 'mystery', timer: dice, durationMs: 30_000, nowMs: 14_000, timeScale: 1 })).toBeNull();
    expect(stageTimer({ beat: beat('cardResolved'), stage: 4, window: 'dice', timer: dice, durationMs: 12_000, nowMs: 14_000, timeScale: 1 })).toBeNull();
  });

  it('counts the break down', () => {
    const pause = beat('roundBreak', 1000, 3500);
    expect(stageTimer({ beat: pause, stage: 5, window: 'dice', timer: null, durationMs: 12_000, nowMs: 2000, timeScale: 1 })).toEqual({ seconds: 3, fraction: 2500 / 3500 });
  });
});
