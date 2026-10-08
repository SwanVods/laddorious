import type { CardResult, GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { applyEvent, type PresentationState } from './presentation';

export type BeatKind =
  | 'roll'
  | 'move'
  | 'slide'
  | 'launch'
  | 'knockback'
  | 'cardMove'
  | 'stepBack'
  | 'snakeBlocked'
  | 'faceOff'
  | 'faceOffResult'
  | 'cardReveal'
  | 'cardResolved'
  | 'clash'
  | 'boardEdit'
  | 'victory'
  | 'ranks'
  | 'info';

/** One step of an update's playback (spec #2 §5.1). */
export interface Beat {
  kind: BeatKind;
  durationMs: number;
  /** The events this beat shows, in engine order. */
  events: GameEvent[];
  /** The presentation once the beat has played. */
  after: PresentationState;
}

/** Starting durations from spec #2 §5.1, to be tuned against the 3D scene. */
export const BEAT_MS = {
  roll: 900,
  hopPerTile: 230,
  landing: 70,
  slide: 2000,
  launch: 1300,
  knockback: 850,
  cardMove: 800,
  stepBackPerTile: 300,
  snakeBlocked: 600,
  faceOff: 500,
  faceOffResult: 1100,
  cardReveal: 1700,
  card: { hit: 1400, blocked: 1200, fizzled: 900 } satisfies Record<CardResult, number>,
  clash: 900,
  boardEdit: 600,
  victory: 3000,
  /** The ranks reveal: one step per place behind the winner, then a hold (polish spec §4.5). */
  rankStep: 500,
  rankHold: 1200,
} as const;

/** 'effect' moves come from after-move card effects; they play like card moves. */
const MOVE_KIND: Record<MoveCause, BeatKind> = {
  dice: 'move',
  snake: 'slide',
  ladder: 'launch',
  knockback: 'knockback',
  card: 'cardMove',
  effect: 'cardMove',
  stepBack: 'stepBack',
};

function kindOf(event: GameEvent): BeatKind {
  switch (event.type) {
    case 'DieRolled':
      return 'roll';
    case 'Moved':
      return MOVE_KIND[event.cause];
    case 'SnakeBlocked':
      return 'snakeBlocked';
    case 'ChallengeStarted':
      return 'faceOff';
    case 'ChallengeResolved':
      return 'faceOffResult';
    case 'CardSelected':
      return 'cardReveal';
    case 'CardResolved':
      return 'cardResolved';
    case 'Clash':
      return 'clash';
    case 'BoardEdited':
    case 'BoardEditExpired':
      return 'boardEdit';
    case 'MatchWon':
      return 'victory';
    default:
      return 'info';
  }
}

/** The piece an event moves or rolls for: a piece appears at most once in a beat. */
function actorOf(event: GameEvent): PlayerId | null {
  return event.type === 'DieRolled' || event.type === 'Moved' || event.type === 'SnakeBlocked' ? event.player : null;
}

function joins(beat: Beat, kind: BeatKind, event: GameEvent): boolean {
  if (beat.kind !== kind || kind === 'cardResolved') return false;
  const actor = actorOf(event);
  return actor === null || !beat.events.some((e) => actorOf(e) === actor);
}

/**
 * Turn one update's events into beats (spec #2 §5.1). Simultaneous events of a kind share
 * a beat, so all dice moves hop together; each card resolution gets a beat of its own.
 * Another player's private events never reach a timeline.
 */
export function buildTimeline(events: GameEvent[], start: PresentationState, me: PlayerId, boardSize: number): Beat[] {
  const beats: Beat[] = [];
  let state = start;
  for (const event of events) {
    if (event.visibility !== 'public' && event.visibility.private !== me) continue;
    const kind = kindOf(event);
    const last = beats.at(-1);
    state = applyEvent(state, event);
    if (last && joins(last, kind, event)) {
      last.events.push(event);
      last.after = state;
    } else {
      beats.push({ kind, durationMs: 0, events: [event], after: state });
    }
  }
  // The winner cam, then the other places revealed over the overview (polish spec §4.5).
  const victory = beats.findIndex((b) => b.kind === 'victory');
  if (victory >= 0) {
    const won = beats[victory]!;
    beats.splice(victory + 1, 0, { kind: 'ranks', durationMs: 0, events: won.events.filter((e) => e.type === 'MatchWon'), after: won.after });
  }
  for (const beat of beats) beat.durationMs = durationOf(beat, boardSize);
  return beats;
}

/** Tiles a move covers: a bounce runs up to the last tile and back. */
function tilesTravelled(event: GameEvent, boardSize: number): number {
  if (event.type !== 'Moved') return 0;
  return event.bounced ? boardSize - event.from + (boardSize - event.to) : Math.abs(event.to - event.from);
}

function durationOf(beat: Beat, boardSize: number): number {
  const longest = () => Math.max(...beat.events.map((e) => tilesTravelled(e, boardSize)));
  switch (beat.kind) {
    case 'roll':
      return BEAT_MS.roll;
    case 'move':
      return longest() * BEAT_MS.hopPerTile + BEAT_MS.landing;
    case 'stepBack':
      return longest() * BEAT_MS.stepBackPerTile;
    case 'slide':
      return BEAT_MS.slide;
    case 'launch':
      return BEAT_MS.launch;
    case 'knockback':
      return BEAT_MS.knockback;
    case 'cardMove':
      return BEAT_MS.cardMove;
    case 'snakeBlocked':
      return BEAT_MS.snakeBlocked;
    case 'faceOff':
      return BEAT_MS.faceOff;
    case 'faceOffResult':
      return BEAT_MS.faceOffResult;
    case 'cardReveal':
      return BEAT_MS.cardReveal;
    case 'cardResolved': {
      const resolved = beat.events[0];
      return resolved?.type === 'CardResolved' ? BEAT_MS.card[resolved.result] : 0;
    }
    case 'clash':
      return BEAT_MS.clash;
    case 'boardEdit':
      return BEAT_MS.boardEdit;
    case 'victory':
      return BEAT_MS.victory;
    case 'ranks': {
      const won = beat.events.find((e) => e.type === 'MatchWon');
      const places = won?.type === 'MatchWon' ? new Set(won.rankings.filter((r) => r.player !== won.winner).map((r) => r.rank)).size : 0;
      return places * BEAT_MS.rankStep + BEAT_MS.rankHold;
    }
    case 'info':
      return 0;
  }
}
