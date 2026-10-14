import type { GameEvent, Jump, PlayerId } from '@laddorious/core';
import { BEAT_MS, hopSchedule, landsOnStack } from '../director/beats';
import type { DirectorState, PlayingBeat } from '../director/director';
import { stackOn, type PresentationState } from '../director/presentation';
import { faceOffSpots, pieceOf, sizeOf } from './footprint';
import { arcPoint, slideCurve, tileCell, tilePath, tileToWorld, type Vec3 } from './layout';

/** Where a piece is and how it is turned and squashed. `orb` swaps the piece for a glowing orb (inside a slide). */
export interface Pose {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  orb: boolean;
}

/** About how far a stacked piece rises: name tags beside a stack use it (stacks themselves use each piece's height). */
export const STACK_HEIGHT = 1.05;
const HOP_HEIGHT = 0.55;
const STEP_HEIGHT = 0.15;

type MovedEvent = Extract<GameEvent, { type: 'Moved' }>;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const still = (position: Vec3, rotation: Vec3 = [0, 0, 0]): Pose => ({ position, rotation, scale: [1, 1, 1], orb: false });

/** Where a piece stands between beats: on its tile, on top of earlier arrivals, or side by side facing its opponents in a face-off. */
/**
 * Pieces face along their row, the way the serpentine runs (+X on even rows, −X on odd ones):
 * the camera looks along −Z, so it sees their profiles, which is how a knight reads (Phase 5).
 */
export function headingOf(tile: number): number {
  return tile <= 0 || tileCell(tile).row % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
}

/** On a flag's or a rocket's tile, pieces stand this far toward the camera, clear of it in its corner (2026-10-14). */
export const END_TILE_FORWARD = 0.25;

/**
 * Where a piece stands between beats (2026-10-14: nothing overlaps): on its tile, on the head of the piece
 * under it, or in a face-off, nose to nose with its opponent. On a rocket's or a flag's tile, a little
 * toward the camera, clear of the end in its corner.
 */
export function restPose(state: PresentationState, player: PlayerId, seat: number): Pose {
  const tile = state.positions[player] ?? 0;
  const at = tileToWorld(tile, seat);
  const facing: Vec3 = [0, headingOf(tile), 0];
  if (tile === 0) return still(at, facing);
  const forward = state.jumps.some((j) => j.to > j.from && (j.from === tile || j.to === tile)) ? END_TILE_FORWARD : 0;
  const faceOff = state.faceOffs.find((f) => f.tile === tile && f.players.includes(player));
  if (faceOff) {
    const spot = faceOffSpots(faceOff.players)[faceOff.players.indexOf(player)]!;
    return still([at[0] + spot.dx, at[1], at[2] + spot.dz + forward], [0, spot.heading, 0]);
  }
  const stack = stackOn(state, tile);
  const lift = stack.slice(0, Math.max(0, stack.indexOf(player))).reduce((sum, id) => sum + sizeOf(pieceOf(id)).height, 0);
  return still([at[0], at[1] + lift, at[2] + forward], facing);
}

/** How a rocket or a flag is moving: a sway (radians), a squash (height scale) and a pop (overall scale). */
export interface EndMotion {
  sway: number;
  squash: number;
  pop: number;
}

export const STILL_END: EndMotion = { sway: 0, squash: 1, pop: 1 };
/** A rocket shakes for this long as a piece launches; a flag waves for this long up to the landing. */
const ROCKET_SHAKE_MS = 500;
const FLAG_WAVE_MS = 600;

/**
 * How a ladder's rocket and flag react `nowMs` into a beat (round 5): the rocket shakes and squashes as a
 * piece launches from it, and the flag waves and pops as the piece comes down onto it. Still otherwise.
 */
export function endReaction(beat: PlayingBeat | null, jump: Jump, nowMs: number, reducedMotion = false): { rocket: EndMotion; flag: EndMotion } {
  const still = { rocket: STILL_END, flag: STILL_END };
  if (reducedMotion || beat?.kind !== 'launch') return still;
  if (!beat.events.some((e) => e.type === 'Moved' && e.from === jump.from && e.to === jump.to)) return still;
  const elapsed = nowMs - beat.startedAt;
  const shake = elapsed / ROCKET_SHAKE_MS;
  const wave = (elapsed - (beat.durationMs - FLAG_WAVE_MS)) / FLAG_WAVE_MS;
  const bump = (k: number) => Math.sin(Math.PI * k);
  return {
    rocket: shake > 0 && shake < 1 ? { sway: 0.1 * Math.sin(6 * Math.PI * shake) * (1 - shake), squash: 1 - 0.12 * bump(shake), pop: 1 + 0.12 * bump(shake) } : STILL_END,
    flag: wave > 0 && wave < 1 ? { sway: 0.35 * Math.sin(3 * Math.PI * wave) * bump(wave), squash: 1, pop: 1 + 0.12 * bump(wave) } : STILL_END,
  };
}

/**
 * A piece's pose `nowMs` into a beat (spec #2 §5.1). Pieces the beat moves hop, slide,
 * launch, fly back or leap; others ease from their old spot to their new one.
 */
export function beatPose(beat: PlayingBeat, from: PresentationState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Pose {
  const elapsed = Math.max(0, nowMs - beat.startedAt);
  const t = beat.durationMs > 0 ? clamp01(elapsed / beat.durationMs) : 1;
  const start = restPose(from, player, seat);
  const end = restPose(beat.after, player, seat);
  const move = beat.events.find((e): e is MovedEvent => e.type === 'Moved' && e.player === player);
  if (move) {
    switch (beat.kind) {
      case 'move':
        return hops(move, start, end, elapsed, BEAT_MS.hopPerTile, HOP_HEIGHT, boardSize, true, landsOnStack(beat.after, move));
      case 'stepBack':
        return hops(move, start, end, elapsed, BEAT_MS.stepBackPerTile, STEP_HEIGHT, boardSize, false, false);
      case 'slide':
        return slide(move, end, t);
      case 'launch':
        return flight(start, end, t, 1.6 + reach(start, end) * 0.22, -1);
      case 'knockback':
        return knockedBack(start, end, elapsed);
      case 'cardMove':
        return flight(start, end, t, 0.9 + reach(start, end) * 0.08, 0);
    }
  }
  // A face-off's intro (2026-10-14, as in the mockup): the pieces stay stacked through the collision, then
  // the top one hops down beside the other as both turn to face each other.
  const started = beat.kind === 'faceOff' ? beat.events.find((e) => e.type === 'ChallengeStarted' && e.players.includes(player)) : undefined;
  if (started) {
    const hold = Math.max(0, beat.durationMs - BEAT_MS.unstack);
    if (elapsed < hold) return start;
    const u = clamp01((elapsed - hold) / BEAT_MS.unstack);
    const k = easeInOut(u);
    const hop = start.position[1] > end.position[1] + 0.01 ? UNSTACK_HOP * 4 * u * (1 - u) : 0;
    const [x, y, z] = lerp3(start.position, end.position, k);
    return { ...end, position: [x, y + hop, z], rotation: [0, lerpAngle(start.rotation[1], end.rotation[1], k), 0] };
  }
  // The winner of a face-off keeps its spot until the loser lands, then settles into the middle.
  if (beat.kind === 'knockback') {
    const k = easeOut(clamp01((elapsed - BEAT_MS.knockback - BEAT_MS.knockbackLand) / BEAT_MS.knockbackSettle));
    return { ...end, position: lerp3(start.position, end.position, k), rotation: [0, lerpAngle(start.rotation[1], end.rotation[1], k), 0] };
  }
  if (beat.kind === 'victory' && beat.events.some((e) => e.type === 'MatchWon' && e.winner === player)) {
    return { ...end, position: [end.position[0], end.position[1] + Math.abs(Math.sin(t * Math.PI * 3)) * 0.9, end.position[2]], rotation: [0, t * Math.PI * 4, 0] };
  }
  if (beat.kind === 'cardResolved' && beat.events.some((e) => e.type === 'CardResolved' && e.target === player && e.result === 'hit')) {
    const k = clamp01((elapsed - BEAT_MS.cardLead) / (beat.durationMs - BEAT_MS.cardLead));
    return { ...start, position: [start.position[0], start.position[1] + Math.sin(k * Math.PI) * 0.35, start.position[2]] };
  }
  const k = easeInOut(t);
  return { ...end, position: lerp3(start.position, end.position, k), rotation: lerp3(start.rotation, end.rotation, k) };
}

/** How high the hop up onto a stack arcs (2026-10-14, as in the mockup). */
const STACK_HOP_HEIGHT = 0.9;

/**
 * Tile-by-tile hops (2026-10-14, as in the mockup): each takes `perTile` ms, first in the air, easing in and
 * out along the ground and stretching, then landing with a short squash. The hop up onto a stack is slower
 * and higher. A step back squashes less.
 */
function hops(move: MovedEvent, start: Pose, end: Pose, elapsed: number, perTile: number, height: number, boardSize: number, bouncy: boolean, stacked: boolean): Pose {
  const path = tilePath(move.from, move.to, move.bounced, boardSize);
  const legs = path.length - 1;
  const plan = hopSchedule(legs, stacked, perTile);
  if (legs <= 0 || elapsed >= plan.total) return end;
  let leg = 0;
  while (leg + 1 < legs && elapsed >= plan.legStart(leg + 1)) leg++;
  const local = elapsed - plan.legStart(leg);
  const ms = plan.legMs(leg);
  const air = ms * (BEAT_MS.hopAir / BEAT_MS.hopPerTile);
  const a = leg === 0 ? start.position : tileToWorld(path[leg]!);
  const b = leg + 1 === legs ? end.position : tileToWorld(path[leg + 1]!);
  if (local >= air) {
    const s = 1 - (bouncy ? 0.18 : 0.1) * Math.sin(((local - air) / (ms - air)) * Math.PI);
    const wide = 1 + (1 - s) * 0.7;
    return { position: b, rotation: end.rotation, scale: [wide, s, wide], orb: false };
  }
  const f = local / air;
  const k = easeInOut(f);
  const arc = stacked && leg + 1 === legs ? STACK_HOP_HEIGHT : height;
  const stretch = 1 + 0.12 * Math.sin(f * Math.PI);
  const across = 1 / Math.sqrt(stretch);
  return {
    position: [lerp(a[0], b[0], k), lerp(a[1], b[1], k) + arc * 4 * f * (1 - f), lerp(a[2], b[2], k)],
    rotation: end.rotation,
    scale: [across, stretch, across],
    orb: false,
  };
}

/** How high the top piece hops as it comes down off the stack into a face-off. */
const UNSTACK_HOP = 0.5;
/** How high a face-off's loser flies as it is knocked back. */
const KNOCKBACK_HEIGHT = 1.8;

/** The way from one heading to another, the short way round. */
function lerpAngle(a: number, b: number, k: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

/**
 * A face-off's loser knocked back (2026-10-14, as in the mockup): still facing the winner, it flies a high
 * arc backwards, turning over nose up about its own side, lands with a squash, then turns to face its way.
 */
function knockedBack(start: Pose, end: Pose, elapsed: number): Pose {
  const fly = BEAT_MS.knockback;
  if (elapsed < fly) {
    const k = easeInOut(elapsed / fly);
    return { position: arcPoint(start.position, end.position, k, KNOCKBACK_HEIGHT), rotation: [-Math.PI * 2 * k, start.rotation[1], 0], scale: [1, 1, 1], orb: false };
  }
  const land = elapsed - fly;
  if (land < BEAT_MS.knockbackLand) {
    const s = 1 - 0.2 * Math.sin((land / BEAT_MS.knockbackLand) * Math.PI);
    const wide = 1 + (1 - s) * 0.7;
    return { position: end.position, rotation: [0, start.rotation[1], 0], scale: [wide, s, wide], orb: false };
  }
  const k = easeOut(clamp01((land - BEAT_MS.knockbackLand) / BEAT_MS.knockbackSettle));
  return { ...end, rotation: [0, lerpAngle(start.rotation[1], end.rotation[1], k), 0] };
}

/** The vacuum: sucked into the head, an orb rides the chute, the piece pops out at the tail. */
function slide(move: MovedEvent, end: Pose, t: number): Pose {
  const curve = slideCurve(move.from, move.to);
  if (t < 0.2) {
    const k = t / 0.2;
    const head = curve.getPoint(0);
    const s = 1 - 0.9 * k;
    return { position: [head.x, head.y, head.z], rotation: [0, k * Math.PI * 4, 0], scale: [s, s, s], orb: false };
  }
  if (t < 0.85) {
    const p = curve.getPoint((t - 0.2) / 0.65);
    return { position: [p.x, p.y + 0.25, p.z], rotation: [0, 0, 0], scale: [1, 1, 1], orb: true };
  }
  const s = 0.1 + 0.9 * easeOutBack((t - 0.85) / 0.15);
  return { ...end, scale: [s, s, s] };
}

/** One arc through the air: launch pads somersault forward (flip −1), knockbacks backflip (+1), card leaps don't flip. */
function flight(start: Pose, end: Pose, t: number, height: number, flip: number): Pose {
  const k = easeInOut(t);
  return { position: arcPoint(start.position, end.position, k, height), rotation: [flip * Math.PI * 2 * k, end.rotation[1], 0], scale: [1, 1, 1], orb: false };
}

const reach = (a: Pose, b: Pose) => Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]);

/** A card's projectile (spec #2 §5.1): it arcs from the caster to its target over the first half of the beat. */
export function projectileAt(beat: PlayingBeat, from: PresentationState, seatOf: (player: PlayerId) => number, nowMs: number): Vec3 | null {
  if (beat.kind !== 'cardResolved') return null;
  const card = beat.events.find((e) => e.type === 'CardResolved');
  if (card?.type !== 'CardResolved' || card.target === null || card.target === card.caster) return null;
  // It waits for the camera's lead-in (2026-10-14), then flies over the first half of what's left.
  const since = nowMs - beat.startedAt - BEAT_MS.cardLead;
  if (since < 0) return null;
  const t = clamp01(since / ((beat.durationMs - BEAT_MS.cardLead) / 2));
  if (t >= 1) return null;
  const a = restPose(from, card.caster, seatOf(card.caster)).position;
  const b = restPose(from, card.target, seatOf(card.target)).position;
  return arcPoint([a[0], a[1] + 1, a[2]], [b[0], b[1] + 1, b[2]], easeInOut(t), 1.5);
}

/** A piece's pose right now, from the director's state. */
export function poseAt(state: DirectorState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Pose | null {
  if (!state.presentation) return null;
  return state.beat ? beatPose(state.beat, state.presentation, player, seat, nowMs, boardSize) : restPose(state.presentation, player, seat);
}

/** A piece that landed on top of another: who, the piece directly under it, and when (epoch ms). */
export interface Landing {
  player: PlayerId;
  under: PlayerId;
  atMs: number;
}

/** How long a piece that lands on a stack wiggles, and how long the one under it squashes (2026-10-14). */
const WIGGLE_MS = 800;
const SQUASH_MS = 260;

/** The pieces a beat lands on top of others: hops land after their last tile, everything else at the beat's end. */
export function stackLandings(beat: PlayingBeat, boardSize: number): Landing[] {
  const landings: Landing[] = [];
  for (const e of beat.events) {
    if (e.type !== 'Moved' || e.to <= 0) continue;
    const stack = stackOn(beat.after, e.to);
    const under = stack[stack.indexOf(e.player) - 1];
    if (stack.at(-1) !== e.player || under === undefined) continue;
    if (beat.after.faceOffs.some((f) => f.tile === e.to)) continue;
    const perTile = beat.kind === 'move' ? BEAT_MS.hopPerTile : beat.kind === 'stepBack' ? BEAT_MS.stepBackPerTile : 0;
    const legs = tilePath(e.from, e.to, e.bounced, boardSize).length - 1;
    landings.push({ player: e.player, under, atMs: beat.startedAt + (perTile > 0 ? legs * perTile : beat.durationMs) });
  }
  return landings;
}

/** A pose with its landing on top: the lander wobbles side to side (about its own side, which the camera sees), dying away; the piece under it squashes once. */
export function landingPose(pose: Pose, player: PlayerId, landings: readonly Landing[], nowMs: number, reducedMotion: boolean): Pose {
  if (reducedMotion) return pose;
  for (const l of landings) {
    const since = nowMs - l.atMs;
    if (l.player === player && since >= 0 && since < WIGGLE_MS) {
      const t = since / WIGGLE_MS;
      return { ...pose, rotation: [pose.rotation[0] + Math.sin(t * Math.PI * 6) * 0.25 * (1 - t), pose.rotation[1], pose.rotation[2]] };
    }
    if (l.under === player && since >= 0 && since < SQUASH_MS) {
      const s = 1 - 0.22 * Math.sin((since / SQUASH_MS) * Math.PI);
      return { ...pose, scale: [pose.scale[0] * (1 + (1 - s) * 0.7), pose.scale[1] * s, pose.scale[2] * (1 + (1 - s) * 0.7)] };
    }
  }
  return pose;
}

/** Idle bob and sway (spec #2 §6.2); the scene leaves it off with reduced motion. */
export function withIdle(pose: Pose, nowMs: number, phase: number): Pose {
  return {
    ...pose,
    position: [pose.position[0], pose.position[1] + 0.035 * (1 + Math.sin(nowMs / 520 + phase)), pose.position[2]],
    rotation: [pose.rotation[0] + 0.045 * Math.sin(nowMs / 830 + phase), pose.rotation[1], pose.rotation[2]],
  };
}

/** The crown flies from tile 100 to the winner's head for this long, bounces there for this long, and its sparkles burst for this long (round 5). */
export const CROWN_FLY_MS = 1200;
const CROWN_BOUNCE_MS = 600;
export const CROWN_SPARKLE_MS = 800;

/** Who wins: from the victory or ranks beat on stage, or from the finished match's view once they've played. */
export function crownWinner(state: DirectorState): PlayerId | null {
  const won = state.beat?.events.find((e) => e.type === 'MatchWon');
  if (won?.type === 'MatchWon') return won.winner;
  const phase = state.settled?.view.phase;
  return phase?.kind === 'finished' ? phase.winner : null;
}

/**
 * Where the crown is `nowMs` in (round 5): spinning on tile 100 until the win, then flying along an arc onto
 * the winner's head (`head`, where it is right now, so the crown follows a piece that is still moving),
 * bouncing as it lands, and turning slowly there through the ranks and the end screen. `sparkle` is how
 * far its landing burst has gone, 0 to 1, while it shows.
 */
export function crownPose(state: DirectorState, head: Vec3 | null, nowMs: number, reducedMotion = false): { position: Vec3; turn: number; sparkle: number | null } {
  const goal = tileToWorld(100);
  const home: Vec3 = [goal[0], 0.01, goal[2]];
  if (!head || !crownWinner(state)) return { position: home, turn: (nowMs / 1000) * 0.9, sparkle: null };
  const turn = (nowMs / 1000) * 0.4;
  const beat = state.beat;
  if (reducedMotion || beat?.kind !== 'victory') return { position: head, turn, sparkle: null };
  const elapsed = nowMs - beat.startedAt;
  if (elapsed < CROWN_FLY_MS) return { position: arcPoint(home, head, easeInOut(clamp01(elapsed / CROWN_FLY_MS)), 2.5), turn, sparkle: null };
  const landed = elapsed - CROWN_FLY_MS;
  const k = clamp01(landed / CROWN_BOUNCE_MS);
  const bounce = 0.35 * Math.abs(Math.sin(2 * Math.PI * k)) * (1 - k);
  return { position: [head[0], head[1] + bounce, head[2]], turn, sparkle: landed < CROWN_SPARKLE_MS ? landed / CROWN_SPARKLE_MS : null };
}
