import type { PlayerId, WindowKind } from '@laddorious/core';
import { tuning } from '../app/tuning';
import { heldBeat, type Beat } from '../director/beats';
import { BOARD_SCALE, TILE_SIZE, tileToWorld, type Vec3 } from './layout';
import type { Pan } from './pan';

export type ShotMode = 'overview' | 'follow' | 'swoop';

export interface Shot {
  mode: ShotMode;
  position: Vec3;
  target: Vec3;
  /** Jump straight there instead of easing (reduced motion). */
  cut: boolean;
}

export interface ShotInput {
  /** The beat on stage. */
  beat: Beat | null;
  /** The settled window, or null before the first update. */
  window: WindowKind | null;
  /** My own Mystery pick is open. */
  myPick: boolean;
  me: PlayerId;
  /** Watch mode: follow this piece instead of mine (spec #2 §5.3). */
  watch: PlayerId | null;
  /** A piece's world position right now. */
  piece: (player: PlayerId) => Vec3;
  reducedMotion: boolean;
  nowMs: number;
  /** I'm peeking at the board from my card pick: show all of it (2026-10-14). */
  peeking?: boolean;
  /** The face-offs on the board (the presentation's), so the camera can watch other players' (2026-10-15). */
  faceOffs?: ReadonlyArray<{ tile: number; players: readonly PlayerId[] }>;
  /** The overview's zoom from the wheel or a pinch: 1 as set, lower is closer (2026-10-15). */
  zoom?: number;
  /** The overview's pan when zoomed in (board theme spec B5): the look-at point's offset, already kept over the board. */
  pan?: Pan;
}

const FOLLOW: Vec3 = [0, 7.5, 8.5];
const SWOOP: Vec3 = [0, 3.4, 4.6];
/** The overview looks a little toward the start row, so the bottom dock never hides it, even 390 px tall (Phase 5). */
export const OVERVIEW_TARGET_Z = 4 * BOARD_SCALE;

const offset = (at: Vec3, by: Vec3): Vec3 => [at[0] + by[0], at[1] + by[1], at[2] + by[2]];
const follow = (at: Vec3): Shot => ({ mode: 'follow', position: offset(at, FOLLOW), target: at, cut: false });

/** The camera rules of spec #2 §5.3. */
export function cameraShot(shown: ShotInput): Shot {
  // A pause holds the shot of the moment it follows (2026-10-14).
  const input = shown.beat ? { ...shown, beat: heldBeat(shown.beat) } : shown;
  const { beat, me } = input;
  const won = beat?.kind === 'victory' ? beat.events.find((e) => e.type === 'MatchWon') : undefined;
  if (won?.type === 'MatchWon') return won.winner === me ? swoop(input.piece(me), input) : follow(input.piece(won.winner));
  // After the winner cam, the whole board while the other places are revealed (polish spec §4.5).
  if (beat?.kind === 'ranks') return overview(input);
  if (input.peeking) return overview(input);
  if (input.watch) return follow(input.piece(input.watch));
  const card = cardShot(input);
  if (card) return card;
  const mine = input.piece(me);
  if (isMyMoment(input)) return swoop(mine, input);
  const resolving = resolvingPiece(input);
  if (resolving) return follow(input.piece(resolving));
  const watching = othersFaceOff(input);
  if (watching !== null) return follow(tileToWorld(watching));
  const busy = beat !== null && beat.kind !== 'roll' && beat.kind !== 'info';
  if (busy || input.window === 'challenge' || input.window === 'mystery') return follow(mine);
  // Everyone rolls: the whole board.
  return overview(input);
}

/**
 * Cards resolve one at a time (2026-10-14): the camera frames each card's caster, or the caster and its
 * target together, pulled back as they stand further apart, then follows the piece the card moves.
 */
function cardShot(input: ShotInput): Shot | null {
  const { beat } = input;
  if (beat?.kind === 'cardMove') {
    const move = beat.events.find((e) => e.type === 'Moved');
    return move?.type === 'Moved' ? { ...follow(input.piece(move.player)), cut: input.reducedMotion } : null;
  }
  const card = beat?.kind === 'cardResolved' ? beat.events.find((e) => e.type === 'CardResolved') : undefined;
  if (card?.type !== 'CardResolved') return null;
  const a = input.piece(card.caster);
  const b = card.target && card.target !== card.caster ? input.piece(card.target) : a;
  const at: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const back = 1 + Math.hypot(b[0] - a[0], b[2] - a[2]) / 10;
  return { mode: 'follow', position: offset(at, [FOLLOW[0] * back, FOLLOW[1] * back, FOLLOW[2] * back]), target: at, cut: input.reducedMotion };
}

/**
 * Whose moment a beat is (2026-10-14: the camera follows each player's resolution): the piece that slides,
 * launches or dodges a slide, and the piece knocked back from a face-off, unless I won that face-off, when
 * the camera stays with me on the tile, as in the mockup.
 */
function resolvingPiece({ beat, me, piece }: ShotInput): PlayerId | null {
  if (!beat) return null;
  if (beat.kind === 'slide' || beat.kind === 'launch' || beat.kind === 'snakeBlocked') {
    const e = beat.events.find((ev) => ev.type === 'Moved' || ev.type === 'SnakeBlocked');
    return e?.type === 'Moved' || e?.type === 'SnakeBlocked' ? e.player : null;
  }
  if (beat.kind === 'knockback') {
    const e = beat.events.find((ev) => ev.type === 'Moved');
    if (e?.type !== 'Moved') return null;
    const [x, , z] = tileToWorld(e.from);
    const [mx, , mz] = piece(me);
    return Math.hypot(mx - x, mz - z) < TILE_SIZE / 2 ? me : e.player;
  }
  return null;
}

/**
 * When I'm not in a face-off but others are (2026-10-15), the camera watches theirs: from the collision,
 * through the picks, to the result. The first, if there are two.
 */
function othersFaceOff({ beat, me, faceOffs = [] }: ShotInput): number | null {
  if (faceOffs.some((f) => f.players.includes(me))) return null;
  const quiet = beat === null || beat.kind === 'info' || beat.kind === 'faceOff' || beat.kind === 'faceOffResult';
  return quiet && faceOffs.length > 0 ? faceOffs[0]!.tile : null;
}

function overview(input: ShotInput): Shot {
  // How far back and how high come from tuning.json (2026-10-15). It never turns; zoomed in, it pans (board theme spec B5).
  const { overview } = tuning().camera;
  const zoom = input.zoom ?? 1;
  const [x, z] = input.pan ?? [0, 0];
  const aim = OVERVIEW_TARGET_Z + z;
  return { mode: 'overview', position: [x, overview.height * zoom, overview.distance * zoom + aim], target: [x, 0, aim], cut: false };
}

function swoop(at: Vec3, input: ShotInput): Shot {
  return { mode: 'swoop', position: offset(at, SWOOP), target: at, cut: input.reducedMotion };
}

/** Swoops are only for your own moments: your collision, your slide or launch, your Mystery pick (cards get their own shot). */
function isMyMoment({ beat, me, myPick, window }: ShotInput): boolean {
  if (myPick && window === 'mystery') return true;
  return (
    beat?.events.some(
      (e) =>
        (e.type === 'ChallengeStarted' && e.players.includes(me)) ||
        (e.type === 'Moved' && e.player === me && (e.cause === 'snake' || e.cause === 'ladder')) ||
        (e.type === 'CardResolved' && e.target === me),
    ) ?? false
  );
}
