import type { PlayerId, WindowKind } from '@laddorious/core';
import { tuning } from '../app/tuning';
import { heldBeat, type Beat } from '../director/beats';
import { BOARD_SCALE, TILE_SIZE, tileToWorld, type Vec3 } from './layout';
import type { Pan } from './pan';

export type ShotMode = 'overview' | 'follow' | 'swoop';

/** What a close shot is on: a piece, or a tile (another pair's face-off). */
export type Focus = { player: PlayerId } | { tile: number };

export interface Shot {
  mode: ShotMode;
  position: Vec3;
  target: Vec3;
  /** Jump straight there instead of easing (reduced motion). */
  cut: boolean;
  /** What the shot is on, kept while the timeline plays so the camera stays put between events (2026-10-15). */
  focus?: Focus | null;
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
  faceOffs?: ReadonlyArray<{ challengeId?: string; tile: number; players: readonly PlayerId[]; decided?: boolean }>;
  /** The overview's zoom from the wheel or a pinch: 1 as set, lower is closer (2026-10-15). */
  zoom?: number;
  /** The overview's pan when zoomed in (board theme spec B5): the look-at point's offset, already kept over the board. */
  pan?: Pan;
  /** The timeline playing and the beat on stage in it, to see what else happens this round (2026-10-15). */
  timeline?: { beats: readonly Beat[]; index: number } | null;
  /** What the last shot was on: kept through beats with nothing of their own to show (2026-10-15). */
  held?: Focus | null;
}

/** Every close shot sits this far up and back (tuning.json's camera.close): one distance for all (2026-10-15). */
const close = (): Vec3 => [0, tuning().camera.close.height, tuning().camera.close.back];
/** The overview looks a little toward the start row, so the bottom dock never hides it, even 390 px tall (Phase 5). */
export const OVERVIEW_TARGET_Z = 4 * BOARD_SCALE;

const offset = (at: Vec3, by: Vec3): Vec3 => [at[0] + by[0], at[1] + by[1], at[2] + by[2]];
const follow = (at: Vec3, focus: Focus | null = null): Shot => ({ mode: 'follow', position: offset(at, close()), target: at, cut: false, focus });
const onPlayer = (input: ShotInput, player: PlayerId): Shot => follow(input.piece(player), { player });
const onFocus = (input: ShotInput, focus: Focus): Shot => ('player' in focus ? onPlayer(input, focus.player) : follow(tileToWorld(focus.tile), focus));

/**
 * The camera rules of spec #2 §5.3, made lazy (the user, 2026-10-15): once on an event, the camera stays
 * there until the next one; my own jumps in a round come before other players'; and when the timeline is
 * over it goes back to the overview.
 */
export function cameraShot(shown: ShotInput): Shot {
  // A pause holds the shot of the moment it follows (2026-10-14); a card's pause, the card's last moment (2026-10-16).
  const input = shown.beat ? { ...shown, beat: shown.beat.lastMoment ?? heldBeat(shown.beat) } : shown;
  const { beat, me } = input;
  const won = beat?.kind === 'victory' ? beat.events.find((e) => e.type === 'MatchWon') : undefined;
  if (won?.type === 'MatchWon') return won.winner === me ? swoop(input.piece(me), input) : onPlayer(input, won.winner);
  // After the winner cam, the whole board while the other places are revealed (polish spec §4.5).
  if (beat?.kind === 'ranks') return overview(input);
  // The break between rounds (2026-10-16): the whole board, to breathe.
  if (beat?.kind === 'roundBreak') return overview(input);
  if (input.peeking) return overview(input);
  if (input.watch) return onPlayer(input, input.watch);
  const card = cardShot(input);
  if (card) return card;
  if (isMyMoment(input)) return swoop(input.piece(me), input);
  const resolving = resolvingPiece(input);
  // Another player's jump while I jump in the same round: the camera stays with me (2026-10-15).
  if (resolving) return onPlayer(input, resolving !== me && jumpsThisRound(input) ? me : resolving);
  const watching = othersFaceOff(input);
  if (watching !== null) return follow(tileToWorld(watching), { tile: watching });
  // My own face-off's pick: on me.
  if (input.window === 'challenge' && (input.faceOffs ?? []).some((f) => f.players.includes(me))) return onPlayer(input, me);
  // Everyone's dice moves: with my piece, if it moves.
  if (beat?.kind === 'move' && beat.events.some((e) => e.type === 'Moved' && e.player === me)) return onPlayer(input, me);
  // A beat with nothing of its own to show, or the card picks after it: stay on the last event (2026-10-15).
  if ((beat || input.window === 'mystery') && input.held) return onFocus(input, input.held);
  // Everyone rolls, the timeline is over, or nothing to show: the whole board.
  return overview(input);
}

/**
 * What the camera stays on next (2026-10-15): the shot's own focus, or the last one while the timeline
 * plays and through the card picks that follow it; nothing once the window moves on. My own pick is a
 * focus too (2026-10-16): once I've picked, the camera stays on me, not on the event before my pick.
 */
export function heldNext({ beat, window, focus, held }: { beat: Beat | null; window: WindowKind | null; focus: Focus | null | undefined; held: Focus | null }): Focus | null {
  if (beat) return focus ?? held;
  return window === 'mystery' ? (focus ?? held) : null;
}

/** Card beats split a round's moments: my jump before a card doesn't hold the camera through it. */
const ROUND_EDGE: ReadonlySet<Beat['kind']> = new Set(['cardReveal', 'cardResolved']);

/** Whether I slide, launch or dodge a slide in the moves around the beat on stage, before or after it (2026-10-15). */
function jumpsThisRound({ timeline, beat, me }: ShotInput): boolean {
  const mine = (b: Beat) => b.events.some((e) => (e.type === 'Moved' && e.player === me && (e.cause === 'snake' || e.cause === 'ladder')) || (e.type === 'SnakeBlocked' && e.player === me));
  if (!timeline) return beat ? mine(beat) : false;
  const { beats, index } = timeline;
  let from = index;
  while (from > 0 && !ROUND_EDGE.has(beats[from - 1]!.kind)) from -= 1;
  let to = index;
  while (to < beats.length - 1 && !ROUND_EDGE.has(beats[to + 1]!.kind)) to += 1;
  return beats.slice(from, to + 1).some((b) => mine(heldBeat(b)));
}

/**
 * Cards resolve one at a time (2026-10-14): the camera frames each card's caster, or the caster and its
 * target together, pulled back as they stand further apart, then follows the piece the card moves.
 */
function cardShot(input: ShotInput): Shot | null {
  const { beat } = input;
  if (beat?.kind === 'cardMove') {
    // A card that moves several players (Retreat!, Earthquake): the whole board, not one of them (2026-10-16).
    if (new Set(beat.events.flatMap((e) => (e.type === 'Moved' ? [e.player] : []))).size > 1) return overview(input);
    const move = beat.events.find((e) => e.type === 'Moved');
    return move?.type === 'Moved' ? onPlayer(input, move.player) : null;
  }
  const card = beat?.kind === 'cardResolved' ? beat.events.find((e) => e.type === 'CardResolved') : undefined;
  if (card?.type !== 'CardResolved') return null;
  const a = input.piece(card.caster);
  const b = card.target && card.target !== card.caster ? input.piece(card.target) : a;
  const at: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const back = 1 + Math.hypot(b[0] - a[0], b[2] - a[2]) / 10;
  const [x, y, z] = close();
  return { mode: 'follow', position: offset(at, [x * back, y * back, z * back]), target: at, cut: false, focus: { player: card.target ?? card.caster } };
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
 * through the picks, to the result. A result beat shows its own face-off; otherwise the first still undecided.
 */
function othersFaceOff({ beat, me, faceOffs = [] }: ShotInput): number | null {
  if (faceOffs.some((f) => f.players.includes(me))) return null;
  const quiet = beat === null || beat.kind === 'info' || beat.kind === 'faceOff' || beat.kind === 'faceOffResult';
  if (!quiet || faceOffs.length === 0) return null;
  const result = beat?.kind === 'faceOffResult' ? beat.events.find((e) => e.type === 'ChallengeResolved') : undefined;
  const shown = result && faceOffs.find((f) => f.challengeId === result.challengeId);
  return (shown ?? faceOffs.find((f) => !f.decided) ?? faceOffs[0]!).tile;
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
  return { mode: 'swoop', position: offset(at, close()), target: at, cut: false, focus: { player: input.me } };
}

/**
 * Whether the game waits on my Mystery pick (2026-10-15): my offer is open and I haven't picked in this window.
 * The settled view only says so once the reveal arrives, so the screen tells which window I picked in.
 */
export function myPickPending(offer: { picked: unknown } | null | undefined, windowId: number | null, pickedWindow: number | null): boolean {
  return !!offer && offer.picked === null && windowId !== pickedWindow;
}

/** Swoops are only for your own moments: your collision, your slide or launch, your Mystery pick (cards get their own shot). */
function isMyMoment({ beat, me, myPick, window }: ShotInput): boolean {
  if (myPick && window === 'mystery') return true;
  return (
    beat?.events.some(
      (e) =>
        (e.type === 'ChallengeStarted' && e.players.includes(me)) ||
        (e.type === 'Moved' && e.player === me && (e.cause === 'snake' || e.cause === 'ladder')) ||
        (e.type === 'CardResolved' && (e.target === me || (e.targets?.includes(me) ?? false) || (e.blocked?.includes(me) ?? false))),
    ) ?? false
  );
}
