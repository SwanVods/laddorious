import type { PlayerId, WindowKind } from '@laddorious/core';
import type { Beat } from '../director/beats';
import type { Vec3 } from './layout';

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
}

const FOLLOW: Vec3 = [0, 7.5, 8.5];
const SWOOP: Vec3 = [0, 3.4, 4.6];
const OVERVIEW_RADIUS = 22;
const OVERVIEW_HEIGHT = 23;
/** The overview looks a little toward the start row, so the bottom dock never hides it, even 390 px tall (Phase 5). */
const OVERVIEW_TARGET_Z = 4;

const offset = (at: Vec3, by: Vec3): Vec3 => [at[0] + by[0], at[1] + by[1], at[2] + by[2]];
const follow = (at: Vec3): Shot => ({ mode: 'follow', position: offset(at, FOLLOW), target: at, cut: false });

/** The camera rules of spec #2 §5.3. */
export function cameraShot(input: ShotInput): Shot {
  const { beat, me } = input;
  const won = beat?.kind === 'victory' ? beat.events.find((e) => e.type === 'MatchWon') : undefined;
  if (won?.type === 'MatchWon') return won.winner === me ? swoop(input.piece(me), input) : follow(input.piece(won.winner));
  if (input.watch) return follow(input.piece(input.watch));
  const mine = input.piece(me);
  if (isMyMoment(input)) return swoop(mine, input);
  const busy = beat !== null && beat.kind !== 'roll' && beat.kind !== 'info';
  if (busy || input.window === 'challenge' || input.window === 'mystery') return follow(mine);
  // Everyone rolls: the whole board, drifting gently.
  const angle = input.reducedMotion ? 0 : Math.sin(input.nowMs / 9000) * 0.12;
  return {
    mode: 'overview',
    position: [Math.sin(angle) * OVERVIEW_RADIUS, OVERVIEW_HEIGHT, Math.cos(angle) * OVERVIEW_RADIUS + OVERVIEW_TARGET_Z],
    target: [0, 0, OVERVIEW_TARGET_Z],
    cut: false,
  };
}

function swoop(at: Vec3, input: ShotInput): Shot {
  return { mode: 'swoop', position: offset(at, SWOOP), target: at, cut: input.reducedMotion };
}

/** Swoops are only for your own moments: your collision, your slide or launch, a card aimed at you, your Mystery pick. */
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
