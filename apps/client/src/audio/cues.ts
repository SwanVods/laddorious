import type { GameEvent, PlayerId } from '@laddorious/core';
import { BEAT_MS, hopSchedule, landsOnStack, tilesTravelled, type Beat } from '../director/beats';
import type { LoggedEvent } from '../director/director';
import { stackOn } from '../director/presentation';
import type { Cue } from './engine';

// What plays when (spec #3 §5): pure mappings from the director's beats, and from the
// zero-length events that only reach its log, to sounds. Times are unscaled.

export interface CueContext {
  me: PlayerId;
  boardSize: number;
}

export const FACE_OFF_DUCK_S = 1.2;
export const OTHER_ROLL_STAGGER_MS = 60;

type MovedEvent = Extract<GameEvent, { type: 'Moved' }>;

const movesIn = (beat: Beat) => beat.events.filter((e): e is MovedEvent => e.type === 'Moved');
const tilesOf = (e: MovedEvent, size: number) => (e.bounced ? size - e.from + (size - e.to) : Math.abs(e.to - e.from));
const cue = (id: Cue['id'], atMs: number, soft: boolean, extra: Partial<Cue> = {}): Cue => ({ id, atMs, soft, ...extra });

export function cuesForBeat(beat: Beat, { me, boardSize }: CueContext): Cue[] {
  const moves = movesIn(beat);
  const mineMoving = moves.some((e) => e.player === me);
  const longest = moves.length > 0 ? moves.reduce((a, b) => (tilesOf(b, boardSize) > tilesOf(a, boardSize) ? b : a)) : null;
  const tiles = longest ? tilesOf(longest, boardSize) : 0;

  switch (beat.kind) {
    case 'roll': {
      const cues: Cue[] = [];
      let others = 0;
      for (const e of beat.events) {
        if (e.type !== 'DieRolled') continue;
        if (e.player === me) {
          cues.push(cue('D2', 0, false));
          if (e.forced) cues.push(cue('D5', 850, false));
        } else {
          cues.push(cue('D3', OTHER_ROLL_STAGGER_MS * others++, true));
        }
      }
      return cues;
    }
    case 'move': {
      const soft = !mineMoving;
      const cues = Array.from({ length: tiles }, (_, i) => cue('H1', i * BEAT_MS.hopPerTile, soft, { arg: i }));
      const stacked = moves.some((e) => stackOn(beat.after, e.to).length > 1);
      // The landing sound comes as the last hop lands, later when that hop climbs onto a stack.
      const landing = Math.max(...moves.map((e) => hopSchedule(tilesTravelled(e, boardSize), landsOnStack(beat.after, e), BEAT_MS.hopPerTile).total));
      cues.push(cue(stacked ? 'H3' : 'H2', landing, soft));
      return cues;
    }
    case 'cardMove': {
      const soft = !mineMoving;
      const forward = longest ? longest.to > longest.from : true;
      const gap = BEAT_MS.cardMove / (tiles + 1);
      const cues = Array.from({ length: tiles }, (_, i) => cue(forward ? 'H1' : 'B1', Math.round(i * gap), soft, { arg: i }));
      cues.push(cue('H2', BEAT_MS.cardMove - BEAT_MS.landing, soft));
      return cues;
    }
    case 'stepBack':
      return Array.from({ length: tiles }, (_, i) => cue('B1', i * BEAT_MS.stepBackPerTile, !mineMoving, { arg: i }));
    case 'slide':
      return [cue('S1', 0, !mineMoving)];
    case 'launch':
      return [cue('L1', 0, !mineMoving)];
    case 'knockback':
      return [cue('K1', 0, !mineMoving)];
    case 'snakeBlocked':
      return [cue('B2', 0, !beat.events.some((e) => e.type === 'SnakeBlocked' && e.player === me))];
    case 'faceOff': {
      const mine = beat.events.some((e) => e.type === 'ChallengeStarted' && e.players.includes(me));
      return [cue('F1', 0, !mine, { duck: FACE_OFF_DUCK_S })];
    }
    case 'faceOffResult': {
      const result = beat.events.find((e) => e.type === 'ChallengeResolved');
      if (result?.type !== 'ChallengeResolved' || !(me in result.picks)) return [];
      if (result.losers.includes(me)) return [cue('F4', 0, false)];
      if (result.winner === me) return [cue('F3', 0, false)];
      return [cue('F5', 0, false)];
    }
    case 'cardReveal':
      return [cue('C4', 0, false, { arg: beat.events.filter((e) => e.type === 'CardSelected').length })];
    case 'cardResolved': {
      const e = beat.events[0];
      if (e?.type !== 'CardResolved') return [];
      const id = e.result === 'hit' ? 'C5' : e.result === 'blocked' ? 'B2' : 'C6';
      const involved = e.caster === me || e.target === me || (e.targets?.includes(me) ?? false) || (e.blocked?.includes(me) ?? false);
      return [cue(id, 0, !involved)];
    }
    case 'clash': {
      const e = beat.events.find((x) => x.type === 'Clash');
      const mine = e?.type === 'Clash' && (e.players.includes(me) || e.casters.includes(me));
      return [cue('C7', 0, !mine)];
    }
    case 'boardEdit':
      return beat.events.flatMap((e) => (e.type === 'BoardEdited' ? [cue('C8', 0, false)] : e.type === 'BoardEditExpired' ? [cue('C9', 0, false)] : []));
    case 'victory': {
      const e = beat.events.find((x) => x.type === 'MatchWon');
      return e?.type === 'MatchWon' ? [cue(e.winner === me ? 'W1' : 'W2', 0, false, { musicOut: true })] : [];
    }
    case 'ranks': {
      const e = beat.events.find((x) => x.type === 'MatchWon');
      if (e?.type !== 'MatchWon') return [];
      const order = [...new Set(e.rankings.filter((r) => r.player !== e.winner).map((r) => r.rank))].sort((a, b) => b - a);
      return order.map((rank, i) => cue('W3', i * BEAT_MS.rankStep, false, { arg: rank }));
    }
    default:
      return [];
  }
}

/** Cues for new log entries: the events that play as zero-length beats. */
export function cuesForLog(entries: readonly LoggedEvent[], me: PlayerId, myFace: number | null): Cue[] {
  const cues: Cue[] = [];
  for (const { event: e } of entries) {
    if (e.type === 'MysteryOffered' && e.player === me) cues.push(cue('B3', 0, false));
    else if (e.type === 'DiceTotaled' && e.player === me && myFace !== null && e.total !== myFace) cues.push(cue(e.total > myFace ? 'D6' : 'D7', 0, false));
    else if (e.type === 'EffectAdded' && e.effect.owner === me) cues.push(cue('C10', 0, false));
  }
  return cues;
}
