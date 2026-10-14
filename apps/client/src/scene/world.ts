import { PAIR_COLORS, WORLD_COLORS } from '../app/theme';
import type { SlotName } from '../assets/slotFiles';
import { COURSE, MENU_PLATFORM, PLATFORM, TILE_THICKNESS, type Vec3 } from './layout';

// The world round the board (board theme spec §3, §4): the platform, the props on its wings, the obstacle
// course floating round it, the stepping pads and the clouds, as placements of Blender models. Pure, so
// the idle motion can be tested; World.tsx draws them, one instanced mesh per model.

export interface Motion {
  /** Up and down: how far, how fast (radians a second) and where in the swing it starts. */
  bob?: { amp: number; speed: number; phase: number };
  /** Turning round its own vertical, radians a second. */
  spin?: number;
  /** Rocking round its own vertical: how far (radians) and how fast. */
  sway?: { amp: number; speed: number };
  /** Squashing on its base like a bouncy mushroom: how fast, and where it starts. */
  squash?: { speed: number; phase: number };
  /** Drifting round the world's centre, radians a second (the clouds). */
  orbit?: number;
}

export interface Placement {
  slot: SlotName;
  /** Where the model's base stands. */
  at: Vec3;
  /** Its turn about the vertical (radians). */
  turn?: number;
  /** Its lean (radians) about x and z: the rotation is Euler XYZ [tilt x, turn, tilt z], so a z tilt leans it in its own plane first. */
  tilt?: readonly [x: number, z: number];
  scale?: number;
  /** The colour of a Tint model. */
  color?: string;
  motion?: Motion;
}

export interface Pose {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

/** Reduced motion keeps the world moving, at this share of its speed and of its size (spec B6). */
export const REDUCED_SHARE = 0.25;

/** Where a placed model is at time t (seconds). */
export function worldPose(p: Placement, t: number, reduced: boolean): Pose {
  const k = reduced ? REDUCED_SHARE : 1;
  const time = t * k;
  const m = p.motion ?? {};
  let [x, y, z] = p.at;
  if (m.orbit) {
    const a = m.orbit * time;
    [x, z] = [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
  }
  if (m.bob) y += m.bob.amp * k * Math.sin(time * m.bob.speed + m.bob.phase);
  const turn = (p.turn ?? 0) + (m.spin ?? 0) * time + (m.sway ? m.sway.amp * k * Math.sin(time * m.sway.speed) : 0);
  const s = p.scale ?? 1;
  const squash = m.squash ? 1 + 0.12 * k * Math.sin(time * m.squash.speed + m.squash.phase) : 1;
  const wide = 1 + (1 - squash) * 0.6;
  return { position: [x, y, z], rotation: [p.tilt?.[0] ?? 0, turn, p.tilt?.[1] ?? 0], scale: [s * wide, s * squash, s * wide] };
}

/** The deck's top, where the tiles stand. */
const DECK = -TILE_THICKNESS;
/** The middle of each wing, either side of the board. */
const WING = 19.5;
/** The obstacles' bob: a slow float, offset by where each is. */
const floatAt = (x: number) => ({ amp: 0.6, speed: 0.6, phase: x });

type Rider = Omit<Placement, 'at' | 'motion'> & { offset: Vec3; motion?: Motion };

/** A floating obstacle: its pad, and what stands on it, bobbing together. */
function obstacle(at: Vec3, padScale: number, riders: Rider[]): Placement[] {
  const bob = floatAt(at[0]);
  const top = at[1] + COURSE.padTop * padScale;
  return [
    { slot: 'course.pad', at, scale: padScale, motion: { bob } },
    ...riders.map(({ offset, motion, ...rest }): Placement => ({ ...rest, at: [at[0] + offset[0], top + offset[1], at[2] + offset[2]], motion: { ...motion, bob } })),
  ];
}

/** The chips' colours, bottom to top. */
const CHIPS = [PAIR_COLORS.all.pink, WORLD_COLORS.deck, WORLD_COLORS.course, WORLD_COLORS.crown, PAIR_COLORS.all.pink];

/** The match's world, with this many clouds (QualityProfile.clouds). */
export function matchWorld(clouds: number): Placement[] {
  return [
    { slot: 'platform', at: [0, DECK - PLATFORM.deckTop, 0] },
    // Props on the wings, like a TFT arena (spec B4). Left, from the back: a rocket (the jump's), a die, chips.
    { slot: 'pad', at: [-WING, DECK + 0.3, -7], scale: 9, turn: 0.4, color: PAIR_COLORS.all.pink, motion: { bob: { amp: 0.25, speed: 1.6, phase: 0 } } },
    { slot: 'prop.die', at: [-WING - 0.5, DECK, 2.5], turn: 0.7 },
    ...CHIPS.map((color, i): Placement => ({ slot: 'prop.chip', at: [-WING - 1 + Math.sin(i) * 0.08, DECK + i * 0.37, 10], turn: i * 0.5, color })),
    { slot: 'prop.chip', at: [-WING + 1.3, DECK + 1.0, 10.6], tilt: [0.2, 1.1], color: WORLD_COLORS.course },
    // Right, from the back: a fan of "?" cards, the crown, a flag (the jump's end).
    ...[-1, 0, 1].map((k): Placement => ({ slot: 'prop.card', at: [WING + k * 0.5, DECK, -7.5 + k * 0.08], turn: -0.35, tilt: [-0.16, k * -0.32], motion: { sway: { amp: 0.12, speed: 0.7 } } })),
    { slot: 'prop.crown', at: [WING, DECK, 2], motion: { spin: 0.4 } },
    { slot: 'pad.target', at: [WING - 0.5, DECK, 10], scale: 4.7, turn: -0.3, color: WORLD_COLORS.cushion, motion: { sway: { amp: 0.08, speed: 2 } } },
    // The obstacle course, floating at the sides and back (spec §4).
    ...obstacle([-40, 3, -30], 1, [{ slot: 'course.sweeper', offset: [0, 0, 0], motion: { spin: 1.1 } }]),
    ...obstacle(
      [42, 1, -26],
      1,
      [0, 1, 2].map((i): Rider => {
        const a = (i / 3) * Math.PI * 2;
        return { slot: 'course.mushroom', offset: [Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4], color: i % 2 ? PAIR_COLORS.all.violet : PAIR_COLORS.all.pink, motion: { squash: { speed: 3, phase: i * 2 } } };
      }),
    ),
    ...obstacle(
      [-54, 6, 4],
      0.9,
      [WORLD_COLORS.crown, PAIR_COLORS.all.cyan, PAIR_COLORS.all.lime].map((color, i): Rider => ({ slot: 'course.hoop', offset: [(i - 1) * 2.8, 0, 0], scale: 0.9, color, motion: { sway: { amp: 0.6, speed: 0.5 } } })),
    ),
    ...obstacle([56, 5, 6], 0.9, [{ slot: 'course.fan', offset: [0, 0, 0], scale: 0.9, motion: { spin: 3 } }]),
    ...obstacle([6, 8, -54], 1.2, [{ slot: 'course.ramp', offset: [0, 0, 0], scale: 1.2, turn: 0.3 }]),
    // Stepping pads leading off behind the board's left corner.
    ...[0, 1, 2, 3, 4].map((i): Placement => ({ slot: 'step', at: [-14 - i * 3.8, -1 + i * 0.7, -24 - i * 3], color: i % 2 ? PAIR_COLORS.all.cyan : PAIR_COLORS.all.lime, motion: { bob: { amp: 0.3, speed: 1.2, phase: i } } })),
    // Clouds below the platform, drifting round it.
    ...Array.from({ length: clouds }, (_, i): Placement => {
      const a = (i / clouds) * Math.PI * 2 + 0.4;
      const r = 50 + (i % 3) * 12;
      return { slot: 'cloud', at: [Math.cos(a) * r, -16 + (i % 2) * 2, Math.sin(a) * r], scale: 2 + (i % 4) * 0.4, turn: a, motion: { orbit: 0.01 } };
    }),
  ];
}

/** The menu's world: the podium on its little platform, and clouds below and behind (spec §3). */
export function menuWorld(clouds: number, podiumX: number): Placement[] {
  // The podium's base, where the code-built one stood.
  const base = -0.2;
  return [
    { slot: 'podium', at: [podiumX, base, 0] },
    { slot: 'menu.platform', at: [podiumX, base - MENU_PLATFORM.deckTop, 0] },
    ...Array.from({ length: clouds }, (_, i): Placement => ({ slot: 'cloud', at: [-9 + i * 2.6, -3.6 + (i % 3) * 0.6, -6 - (i % 2) * 3], scale: 0.45 + (i % 3) * 0.08, turn: i, motion: { bob: { amp: 0.15, speed: 0.4, phase: i } } })),
  ];
}
