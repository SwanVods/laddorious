import type { CardResult, GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { tuning } from '../app/tuning';
import { applyEvent, stackOn, type PresentationState } from './presentation';

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
  /** A moment to see what just happened (2026-10-14): no events, holding the beat before it. */
  | 'pause'
  | 'info';

/** One step of an update's playback (spec #2 §5.1). */
export interface Beat {
  kind: BeatKind;
  durationMs: number;
  /** The events this beat shows, in engine order. */
  events: GameEvent[];
  /** The presentation once the beat has played. */
  after: PresentationState;
  /** A pause holds the beat it follows: the camera and the HUD keep showing that moment. */
  holds?: Beat;
  /**
   * A card's pause: the card's last moment (its move, or a slide after it), which the camera stays on while
   * the HUD keeps showing the card (2026-10-16: the camera used to go back to the caster for the pause).
   */
  lastMoment?: Beat;
}

/** The beat whose moment is on screen: a pause shows the one it holds. */
export function heldBeat<B extends Beat>(beat: B): Beat {
  return beat.kind === 'pause' && beat.holds ? beat.holds : beat;
}

/** Beats that carry a card's effect on: they belong to the card before them. */
const CARD_FOLLOW: ReadonlySet<BeatKind> = new Set(['cardMove', 'slide', 'launch', 'knockback', 'stepBack', 'snakeBlocked', 'boardEdit', 'clash', 'faceOff', 'faceOffResult']);

/**
 * Pauses to see what happened (the user, 2026-10-14): after the last die roll, with the dice still up,
 * before the pieces move; after each card, its moves included, before the next card or what follows; and
 * at the end, on the last moment, before the camera goes back to the overview (2026-10-15).
 */
function withPauses(beats: Beat[]): Beat[] {
  const out: Beat[] = [];
  const pause = (holds: Beat, durationMs: number, lastMoment?: Beat): Beat => ({ kind: 'pause', durationMs, events: [], after: out.at(-1)!.after, holds, ...(lastMoment ? { lastMoment } : {}) });
  let roll: Beat | null = null;
  let card: Beat | null = null;
  for (const beat of beats) {
    if (card && (beat.kind === 'cardResolved' || !CARD_FOLLOW.has(beat.kind))) {
      out.push(pause(card, BEAT_MS.cardPause, out.at(-1)));
      card = null;
    }
    if (beat.kind === 'move' && roll) {
      out.push(pause(roll, BEAT_MS.rollPause));
      roll = null;
    }
    out.push(beat);
    if (beat.kind === 'roll') roll = beat;
    if (beat.kind === 'cardResolved') card = beat;
  }
  if (card) out.push(pause(card, BEAT_MS.cardPause, out.at(-1)));
  // Hold the last moment before the camera goes back to the overview (2026-10-15).
  const last = out.at(-1);
  if (last?.kind === 'pause') last.durationMs = Math.max(last.durationMs, BEAT_MS.endHold);
  else if (last && HELD_AT_END.has(last.kind)) out.push(pause(last, BEAT_MS.endHold));
  return out;
}

/** Moments the camera goes to: a timeline that ends on one holds it a moment (2026-10-15). */
const HELD_AT_END: ReadonlySet<BeatKind> = new Set(['move', 'slide', 'launch', 'knockback', 'cardMove', 'stepBack', 'snakeBlocked', 'faceOff', 'faceOffResult', 'cardResolved', 'clash']);

/** Starting durations from spec #2 §5.1, to be tuned against the 3D scene. */
export const BEAT_MS = {
  roll: 900,
  /** Tunable in tuning.json (2026-10-15): each read takes the setting in use. */
  get hopPerTile() {
    return tuning().timing.hopMs;
  },
  /** Of each hop, the time in the air; the rest is the squash on landing (2026-10-14, as in the mockup). */
  get hopAir() {
    return (tuning().timing.hopMs * 160) / 230;
  },
  landing: 70,
  slide: 2000,
  launch: 1300,
  get knockback() {
    return tuning().timing.knockbackMs;
  },
  /** After a face-off's knock-back flight: the loser's landing squash, then the winner settling into the middle (2026-10-14, as in the mockup). */
  knockbackLand: 90,
  knockbackSettle: 300,
  cardMove: 800,
  stepBackPerTile: 300,
  snakeBlocked: 600,
  faceOff: 500,
  /** My own face-off's intro (2026-10-14, as in the mockup): the collision held for its banner, then the top piece hops down. */
  get faceOffIntro() {
    return tuning().timing.faceOffIntroMs;
  },
  /** The top piece's hop down beside the other, at the end of any face-off's intro. */
  unstack: 460,
  faceOffResult: 1100,
  /** In my own face-off's result, the popup first shows both picks, then closes for the result banner. */
  faceOffReveal: 1000,
  /** Then the result banner plays out in full before anything else, a draw's re-pick popup included (BANNER_MS). */
  faceOffBanner: 1700,
  cardReveal: 1700,
  card: { hit: 1400, blocked: 1200, fizzled: 900 } satisfies Record<CardResult, number>,
  /** Before each card plays, so the camera reaches its player first (2026-10-14). */
  get cardLead() {
    return tuning().timing.cardLeadMs;
  },
  /** A card's own die tumbling after the lead-in, before the card plays (2026-10-16). */
  get cardRoll() {
    return tuning().timing.cardRollMs;
  },
  /** The pause after each card and its moves, and after the last die roll (2026-10-14). */
  get cardPause() {
    return tuning().timing.cardPauseMs;
  },
  get rollPause() {
    return tuning().timing.rollPauseMs;
  },
  clash: 900,
  boardEdit: 600,
  victory: 3000,
  /** The ranks reveal: one step per place behind the winner, then a hold (polish spec §4.5). */
  rankStep: 500,
  rankHold: 1200,
  /** The last moment held before the camera goes back to the overview (2026-10-15). */
  get endHold() {
    return tuning().timing.endHoldMs;
  },
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
      if (event.type === 'Moved') state = byLanding(state, last.events, boardSize);
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
  for (const beat of beats) beat.durationMs = durationOf(beat, boardSize, me);
  return withPauses(beats);
}

/**
 * Pieces that move in one beat stack on a shared tile in the order they land (2026-10-15): the one with the
 * fewest tiles to hop lands first, at the bottom; the engine's order breaks ties. Their moves are the latest,
 * so they are the tail of `arrivals`.
 */
function byLanding(state: PresentationState, events: readonly GameEvent[], boardSize: number): PresentationState {
  const moves = events.filter((e) => e.type === 'Moved');
  const movers = new Set(moves.map((e) => e.player));
  const landed = [...moves].sort((a, b) => tilesTravelled(a, boardSize) - tilesTravelled(b, boardSize)).map((e) => e.player);
  return { ...state, arrivals: [...state.arrivals.filter((id) => !movers.has(id)), ...landed] };
}

/** Whether a move ends on top of other pieces (not in a face-off, where they stand apart). */
export function landsOnStack(after: PresentationState, e: GameEvent): boolean {
  if (e.type !== 'Moved' || e.to <= 0) return false;
  const stack = stackOn(after, e.to);
  return stack.length > 1 && stack.at(-1) === e.player && !after.faceOffs.some((f) => f.tile === e.to);
}

/** The hop up onto a stack is this much slower than a hop between tiles (2026-10-14, as in the mockup). */
export const STACK_HOP_SLOWER = 1.4;

/** When each of a move's hops starts and how long it lasts: the last is slower when it lands on a stack. */
export function hopSchedule(tiles: number, stacked: boolean, perTile: number): { legStart: (i: number) => number; legMs: (i: number) => number; total: number } {
  const legMs = (i: number) => (stacked && i === tiles - 1 ? perTile * STACK_HOP_SLOWER : perTile);
  const legStart = (i: number) => i * perTile;
  return { legStart, legMs, total: tiles > 0 ? legStart(tiles - 1) + legMs(tiles - 1) : 0 };
}

/** Tiles a move covers: a bounce runs up to the last tile and back. */
export function tilesTravelled(event: GameEvent, boardSize: number): number {
  if (event.type !== 'Moved') return 0;
  return event.bounced ? boardSize - event.from + (boardSize - event.to) : Math.abs(event.to - event.from);
}

const rollOf = (beat: Pick<Beat, 'kind' | 'events'>) => {
  const e = beat.kind === 'cardResolved' ? beat.events.find((x) => x.type === 'CardResolved') : undefined;
  return e?.type === 'CardResolved' && e.roll !== undefined ? e : null;
};

/** How long a card's beat waits before the card plays: the camera's lead-in, then its die's tumble if it rolls one (2026-10-16). */
export function cardLeadOf(beat: Pick<Beat, 'kind' | 'events'>): number {
  return BEAT_MS.cardLead + (rollOf(beat) ? BEAT_MS.cardRoll : 0);
}

/** A card's own die, tumbling above its caster after the lead-in and landing on the roll; null when the card rolls none. */
export function cardRollAt(beat: Pick<Beat, 'kind' | 'events'> & { startedAt: number }): { player: PlayerId; face: number; startedAt: number; durationMs: number } | null {
  const e = rollOf(beat);
  return e ? { player: e.caster, face: e.roll!, startedAt: beat.startedAt + BEAT_MS.cardLead, durationMs: BEAT_MS.cardRoll } : null;
}

function durationOf(beat: Beat, boardSize: number, me: PlayerId): number {
  const longest = () => Math.max(...beat.events.map((e) => tilesTravelled(e, boardSize)));
  switch (beat.kind) {
    case 'roll':
      return BEAT_MS.roll;
    case 'move':
      return Math.max(...beat.events.map((e) => (e.type === 'Moved' ? hopSchedule(tilesTravelled(e, boardSize), landsOnStack(beat.after, e), BEAT_MS.hopPerTile).total : 0))) + BEAT_MS.landing;
    case 'stepBack':
      return longest() * BEAT_MS.stepBackPerTile;
    case 'slide':
      return BEAT_MS.slide;
    case 'launch':
      return BEAT_MS.launch;
    case 'knockback':
      return BEAT_MS.knockback + BEAT_MS.knockbackLand + BEAT_MS.knockbackSettle;
    case 'cardMove':
      return BEAT_MS.cardMove;
    case 'snakeBlocked':
      return BEAT_MS.snakeBlocked;
    case 'faceOff':
      return beat.events.some((e) => e.type === 'ChallengeStarted' && e.players.includes(me)) ? BEAT_MS.faceOffIntro : BEAT_MS.faceOff;
    case 'faceOffResult':
      return beat.events.some((e) => e.type === 'ChallengeResolved' && me in e.picks) ? BEAT_MS.faceOffReveal + BEAT_MS.faceOffBanner : BEAT_MS.faceOffResult;
    case 'cardReveal':
      return BEAT_MS.cardReveal;
    case 'cardResolved': {
      const resolved = beat.events[0];
      return resolved?.type === 'CardResolved' ? cardLeadOf(beat) + BEAT_MS.card[resolved.result] : 0;
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
    case 'pause':
      return beat.durationMs;
    case 'info':
      return 0;
  }
}
