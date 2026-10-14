import { describe, expect, it } from 'vitest';
import { MESH_SLOTS } from '../src/assets/slotFiles';
import { slotsToPreload } from '../src/assets/slotMesh';
import { BOARD_HALF, PLATFORM, TILE_THICKNESS } from '../src/scene/layout';
import { REDUCED_SHARE, matchWorld, menuWorld, worldPose, type Placement } from '../src/scene/world';

// The world round the board (board theme spec §3, §4, B6).

const bob: Placement = { slot: 'step', at: [1, 2, 3], motion: { bob: { amp: 1, speed: 1, phase: 0 } } };

describe('worldPose', () => {
  it('leaves a still part where it was placed, turned and tilted as placed', () => {
    const pose = worldPose({ slot: 'prop.die', at: [4, -0.3, 2], turn: 0.7, tilt: [0.1, 0.2], scale: 2 }, 12.3, false);
    expect(pose).toEqual({ position: [4, -0.3, 2], rotation: [0.1, 0.7, 0.2], scale: [2, 2, 2] });
  });

  it('bobs, spins, sways, squashes and drifts with time', () => {
    expect(worldPose(bob, Math.PI / 2, false).position[1]).toBeCloseTo(3);
    expect(worldPose({ slot: 'course.sweeper', at: [0, 0, 0], motion: { spin: 2 } }, 1, false).rotation[1]).toBeCloseTo(2);
    expect(worldPose({ slot: 'prop.card', at: [0, 0, 0], turn: 1, motion: { sway: { amp: 0.5, speed: 1 } } }, Math.PI / 2, false).rotation[1]).toBeCloseTo(1.5);
    const squashed = worldPose({ slot: 'course.mushroom', at: [0, 0, 0], motion: { squash: { speed: 1, phase: 0 } } }, -Math.PI / 2, false).scale;
    expect(squashed[1]).toBeCloseTo(0.88);
    expect(squashed[0]).toBeGreaterThan(1);
    const drifted = worldPose({ slot: 'cloud', at: [10, 0, 0], motion: { orbit: 0.5 } }, Math.PI, false).position;
    expect(Math.hypot(drifted[0], drifted[2])).toBeCloseTo(10);
    expect(drifted[2]).toBeCloseTo(-10);
  });

  it('keeps moving with reduced motion, at a quarter of the speed and size (spec B6)', () => {
    expect(REDUCED_SHARE).toBe(0.25);
    // A quarter the speed: time t reduced is time t / 4 at full speed. A quarter the size: the swing is 0.25 high.
    const reduced = worldPose(bob, 2 * Math.PI, true).position[1] - 2;
    expect(reduced).toBeCloseTo(0.25 * Math.sin(Math.PI / 2));
    expect(worldPose({ slot: 'course.fan', at: [0, 0, 0], motion: { spin: 4 } }, 1, true).rotation[1]).toBeCloseTo(1);
  });
});

describe('the match world', () => {
  const world = matchWorld(8);

  it('stands the platform so its deck is where the tiles stand', () => {
    const platform = world.filter((p) => p.slot === 'platform');
    expect(platform).toHaveLength(1);
    expect(platform[0]!.at[1] + PLATFORM.deckTop).toBeCloseTo(-TILE_THICKNESS);
  });

  it('puts the props on the wings, never over the board or in front of it (spec B4)', () => {
    const props = world.filter((p) => p.slot.startsWith('prop.') || p.slot === 'pad' || p.slot === 'pad.target');
    expect(props.length).toBeGreaterThanOrEqual(6);
    for (const p of props) {
      expect(Math.abs(p.at[0]), p.slot).toBeGreaterThan(BOARD_HALF + 2);
      expect(Math.abs(p.at[0]), p.slot).toBeLessThan(PLATFORM.halfWidth - 1);
      expect(p.at[2], p.slot).toBeLessThan(PLATFORM.halfDepth - 1);
    }
  });

  it('floats the course off the platform, at the sides and back, never in front (spec §4)', () => {
    const course = world.filter((p) => p.slot.startsWith('course.') || p.slot === 'step');
    expect(course.filter((p) => p.slot === 'course.pad')).toHaveLength(5);
    for (const p of course) {
      const out = Math.abs(p.at[0]) > PLATFORM.halfWidth + 2 || p.at[2] < -(PLATFORM.halfDepth + 2);
      expect(out, `${p.slot} at ${p.at.join(', ')}`).toBe(true);
      expect(p.at[2], p.slot).toBeLessThan(PLATFORM.halfDepth);
    }
  });

  it('bobs each obstacle with its pad', () => {
    const pads = world.filter((p) => p.slot === 'course.pad');
    for (const pad of pads) {
      const riders = world.filter((p) => p.slot.startsWith('course.') && p.slot !== 'course.pad' && Math.hypot(p.at[0] - pad.at[0], p.at[2] - pad.at[2]) < 6);
      expect(riders.length).toBeGreaterThan(0);
      for (const r of riders) expect(r.motion?.bob).toEqual(pad.motion?.bob);
    }
  });

  it('draws as many clouds as the quality asks', () => {
    expect(matchWorld(4).filter((p) => p.slot === 'cloud')).toHaveLength(4);
    expect(world.filter((p) => p.slot === 'cloud')).toHaveLength(8);
  });
});

describe('the menu world', () => {
  it('stands the podium on its little platform, with the clouds', () => {
    const world = menuWorld(8, -0.6);
    const podium = world.find((p) => p.slot === 'podium')!;
    const platform = world.find((p) => p.slot === 'menu.platform')!;
    expect(podium.at[0]).toBe(-0.6);
    expect(platform.at[0]).toBe(-0.6);
    expect(platform.at[1]).toBeLessThan(podium.at[1]);
    expect(world.filter((p) => p.slot === 'cloud')).toHaveLength(8);
  });
});

describe('loading the world', () => {
  it('preloads every world model with the menu, so a match never starts with the world popping in (spec #5 §6)', () => {
    const slots = new Set([...matchWorld(8), ...menuWorld(8, 0)].map((p) => p.slot));
    for (const slot of slots) expect(MESH_SLOTS.has(slot), slot).toBe(true);
  });

  it("preloads the rocket and flag on Low too, for the wings' props, but not the whirlpool and splat (board theme spec B4)", () => {
    const low = slotsToPreload(false);
    expect(low).toContain('pad');
    expect(low).toContain('pad.target');
    expect(low).not.toContain('slide.vortex');
    expect(low).not.toContain('slide.exit');
    expect(slotsToPreload(true)).toEqual([...MESH_SLOTS]);
  });
});
