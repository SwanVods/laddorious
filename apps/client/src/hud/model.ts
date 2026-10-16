import {
  resolveConfig,
  type ChallengeChoice,
  type GameEvent,
  type PlayerId,
  type PlayerView,
  type Rarity,
  type WindowKind,
} from '@laddorious/core';
import { BEAT_MS, heldBeat, type Beat } from '../director/beats';
import type { LoggedEvent, PlayingBeat } from '../director/director';
import type { PresentationState } from '../director/presentation';
import type { SeatInfo } from '../service/matchService';
import { listParts, type FeedPart } from './feed';
import { cardInfo, effectChip, fizzleWarning, type CardInfo, type EffectChip, type IconName } from './labels';
import type { CardRecord, DiceRecord, RoundRecord } from './record';

// What the match HUD shows, as plain data (spec #2 §7.2). Components only draw it.

/** The local host plays the engine's default rules, so the reroll limit is the default one. */
const RULES = resolveConfig({ seed: 'client' });
export const MAX_REROLLS = RULES.mystery.maxRerolls;
/** How far a face-off's loser is knocked back (spec #1 D3). */
export const KNOCKBACK = RULES.collision.knockback;

// ---------------------------------------------------------------- stage bar

export interface Stage {
  id: 'dice' | 'move' | 'faceOff' | 'mystery' | 'cards';
  label: string;
  icon: IconName;
}

export const STAGES: readonly Stage[] = [
  { id: 'dice', label: 'Dice', icon: 'die' },
  { id: 'move', label: 'Move', icon: 'arrow' },
  { id: 'faceOff', label: 'Face-off', icon: 'swords' },
  { id: 'mystery', label: 'Mystery', icon: 'qmark' },
  { id: 'cards', label: 'Cards', icon: 'card' },
];

const BEAT_STAGE: Partial<Record<Beat['kind'], number>> = {
  roll: 0,
  move: 1,
  faceOff: 2,
  faceOffResult: 2,
  cardReveal: 4,
  cardResolved: 4,
  clash: 4,
  cardMove: 4,
};
const WINDOW_STAGE: Partial<Record<WindowKind, number>> = { dice: 0, challenge: 2, mystery: 3 };

/**
 * The current stage (index into STAGES). Beats that follow from another (a slide, a launch,
 * a knockback, a board edit) keep the stage they happen in, so the bar doesn't jump back.
 */
export function stageIndex(shown: Beat | null, window: WindowKind | null, previous: number | null): number | null {
  const beat = shown && heldBeat(shown);
  if (beat) return BEAT_STAGE[beat.kind] ?? previous ?? 1;
  return (window ? WINDOW_STAGE[window] : undefined) ?? previous;
}

/** The stage the latest logged events belong to: what a follow-on beat keeps showing. */
export function stageFromLog(log: readonly LoggedEvent[]): number | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!.event;
    switch (e.type) {
      case 'RoundStarted':
      case 'DieRolled':
        return 0;
      case 'Moved':
        if (e.cause === 'dice') return 1;
        break;
      case 'ChallengeStarted':
      case 'ChallengeResolved':
        return 2;
      case 'MysteryOffered':
        return 3;
      case 'CardSelected':
      case 'CardResolved':
      case 'Clash':
        return 4;
    }
  }
  return null;
}

/** Seconds left on the open window's countdown, and how full its bar is (0–1). */
export function countdown(timer: { endsAt: number } | null, durationMs: number, nowMs: number): { seconds: number; fraction: number } | null {
  if (!timer || durationMs <= 0) return null;
  const left = Math.max(0, Math.min(durationMs, timer.endsAt - nowMs));
  return { seconds: Math.ceil(left / 1000), fraction: left / durationMs };
}

// ---------------------------------------------------------------- player column

export type RowStatus = 'turn' | 'waiting' | 'done' | 'locked' | 'idle';

export interface PlayerRow {
  seat: SeatInfo;
  tile: number;
  /** 1 is in front; players on the same tile share a rank. */
  rank: number;
  me: boolean;
  watched: boolean;
  /** Their connection is down; their seat plays on by timeouts (spec #4 M2). */
  away: boolean;
  status: RowStatus;
  statusText: string;
  dice: DiceRecord | null;
  /** On a "?" square with a card still to pick: the square's rarity (spec #2 §7.2). */
  mystery: Rarity | null;
  effects: EffectChip[];
  /** Face-down until the reveal, then the card with its result. */
  card: 'facedown' | CardRecord | null;
}

export interface RowsInput {
  view: PlayerView;
  presentation: PresentationState;
  record: RoundRecord;
  seats: SeatInfo[];
  me: PlayerId;
  watch: PlayerId | null;
  /** Away players (spec #4 §3.3). */
  away?: readonly PlayerId[];
}

/** A player's row status in words (tests). */
export const statusText = (view: PlayerView, player: PlayerId, me: PlayerId): string => statusOf(view, player, me).text;

function statusOf(view: PlayerView, player: PlayerId, me: PlayerId): { status: RowStatus; text: string } {
  const aw = view.awaiting;
  const phase = view.phase;
  if (aw.window === 'dice') {
    if (phase.kind === 'dice' && phase.seqs[player]?.status === 'skipped') return { status: 'idle', text: 'Skips this roll' };
    // An extra roll (Encore, 2026-10-16) that isn't theirs.
    if (phase.kind === 'dice' && phase.seqs[player]?.status === 'out') return { status: 'idle', text: 'Waiting' };
    if (!aw.players.includes(player)) return { status: 'done', text: 'Rolled' };
    return player === me ? { status: 'turn', text: 'Your turn to roll' } : { status: 'waiting', text: 'Rolling…' };
  }
  if (aw.window === 'challenge' && phase.kind === 'settle') {
    const challenge = phase.challenges.find((c) => c.winner === null && c.contesting.includes(player));
    if (!challenge) return { status: 'idle', text: 'Watching the face-off' };
    if (challenge.picked.includes(player)) return { status: 'locked', text: 'Pick locked' };
    return player === me ? { status: 'turn', text: 'Your pick' } : { status: 'waiting', text: 'Picking…' };
  }
  if (aw.window === 'mystery' && phase.kind === 'mysterySelect') {
    if (!(player in phase.picked)) return { status: 'idle', text: 'Waiting for the cards' };
    if (phase.picked[player]) return { status: 'locked', text: 'Card picked' };
    return player === me ? { status: 'turn', text: 'Your card to pick' } : { status: 'waiting', text: 'Choosing a card…' };
  }
  return { status: 'idle', text: 'Waiting' };
}

/** The rows of the player column, front-runner first (spec #2 §7.2). */
export function playerRows({ view, presentation, record, seats, me, watch, away = [] }: RowsInput): PlayerRow[] {
  const names = new Map(seats.map((s) => [s.playerId, s.playerId === me ? 'You' : s.nickname]));
  const tileOf = (id: PlayerId) => presentation.positions[id] ?? 0;
  const picked = view.phase.kind === 'mysterySelect' ? view.phase.picked : null;
  return seats
    .map((seat, index) => ({ seat, index, tile: tileOf(seat.playerId) }))
    .sort((a, b) => b.tile - a.tile || a.index - b.index)
    .map(({ seat, tile }) => {
      const id = seat.playerId;
      const { status, text } = statusOf(view, id, me);
      const card = record.cards[id] ?? (picked?.[id] ? 'facedown' : null);
      const onMystery = picked !== null && id in picked && !picked[id];
      return {
        seat,
        tile,
        rank: 1 + seats.filter((s) => tileOf(s.playerId) > tile).length,
        me: id === me,
        watched: id === watch,
        away: away.includes(id),
        status,
        statusText: text,
        dice: record.dice[id] ?? null,
        mystery: onMystery ? (view.board.mystery[tile] ?? null) : null,
        effects: presentation.effects.filter((e) => e.owner === id).map((e) => effectChip(e, names)),
        card,
      };
    });
}

// ---------------------------------------------------------------- bottom dock

export interface QueueCard {
  caster: PlayerId;
  cardId: string;
  result: CardRecord['result'];
  roll?: number;
  /** The card resolving right now. */
  current: boolean;
}

export type DockModel =
  | { kind: 'roll'; windowId: number }
  | { kind: 'wait'; parts: FeedPart[] }
  | { kind: 'caption'; parts: FeedPart[]; totals: Array<{ player: PlayerId; total: number }> | null }
  | { kind: 'queue'; caption: string | null; cards: QueueCard[] }
  | { kind: 'none' };

export interface DockInput {
  beat: Beat | null;
  view: PlayerView;
  record: RoundRecord;
  me: PlayerId;
}

const MOVE_VERB: Partial<Record<Beat['kind'], string>> = {
  slide: ' slides down',
  launch: ' launches up',
  knockback: ' is knocked back',
  stepBack: ' steps back',
  snakeBlocked: ' dodges the slide',
  cardMove: ' leaps',
};

/** Cards in the order they resolve, which is the order the engine revealed them: last place first (2026-10-14). */
export function resolutionQueue(record: RoundRecord, beat: Beat | null): QueueCard[] {
  const resolving = beat?.kind === 'cardResolved' ? beat.events.find((e) => e.type === 'CardResolved') : undefined;
  return Object.entries(record.cards).map(([caster, card]) => ({
    caster,
    cardId: card.cardId,
    result: card.result,
    ...(card.roll !== undefined ? { roll: card.roll } : {}),
    current: resolving?.type === 'CardResolved' && resolving.caster === caster,
  }));
}

/**
 * The phone's card list under the action log (2026-10-15): this round's cards from their reveal until the next
 * round starts, through the moves a card makes (a launch after Sprint), unlike the dock, which captions those moves.
 */
export function phoneCards(record: RoundRecord, shown: Beat | null): QueueCard[] {
  return resolutionQueue(record, shown && heldBeat(shown));
}

const moversOf = (events: GameEvent[]) => [...new Set(events.flatMap((e) => (e.type === 'Moved' || e.type === 'SnakeBlocked' ? [e.player] : [])))];

/** Bottom centre (spec #2 §7.2): ROLL, a waiting pill, a move caption, or the card queue. */
export function dockModel({ beat: shown, view, record, me }: DockInput): DockModel {
  // A pause shows the moment it follows (2026-10-14).
  const beat = shown && heldBeat(shown);
  if (beat) {
    // The break between rounds (2026-10-16): no ROLL yet, just what comes next.
    const next = beat.kind === 'roundBreak' ? beat.events.find((e) => e.type === 'RoundStarted') : undefined;
    if (next?.type === 'RoundStarted') return { kind: 'caption', parts: [`Next: round ${next.round}`], totals: null };
    if (beat.kind === 'move') {
      const totals = Object.entries(record.dice).map(([player, d]) => ({ player, total: d.total ?? d.faces.reduce((a, b) => a + b, 0) }));
      return { kind: 'caption', parts: ['Everyone moves'], totals };
    }
    const verb = MOVE_VERB[beat.kind];
    if (verb) return { kind: 'caption', parts: [...listParts(moversOf(beat.events)), verb], totals: null };
    if (beat.kind === 'faceOff' || beat.kind === 'faceOffResult') {
      const started = beat.events.find((e) => e.type === 'ChallengeStarted');
      if (started?.type === 'ChallengeStarted') return { kind: 'caption', parts: [`Face-off on tile ${started.tile}!`], totals: null };
      const resolved = beat.events.find((e) => e.type === 'ChallengeResolved');
      if (resolved?.type === 'ChallengeResolved' && resolved.winner) return { kind: 'caption', parts: [{ player: resolved.winner }, ' wins the face-off'], totals: null };
      return { kind: 'caption', parts: ['A tie! The face-off goes again'], totals: null };
    }
    if (beat.kind === 'cardReveal' || beat.kind === 'cardResolved' || beat.kind === 'clash' || beat.kind === 'boardEdit') {
      const caption = beat.kind === 'cardReveal' ? 'Cards revealed!' : null;
      return { kind: 'queue', caption, cards: resolutionQueue(record, beat) };
    }
  }
  const aw = view.awaiting;
  const phase = view.phase;
  if (aw.window === 'dice') {
    if (aw.players.includes(me)) return { kind: 'roll', windowId: aw.windowId };
    const status = phase.kind === 'dice' ? phase.seqs[me]?.status : undefined;
    return { kind: 'wait', parts: [status === 'skipped' ? 'You skip this roll. Waiting for ' : 'Waiting for ', ...listParts(aw.players), status === 'out' ? ' to roll again' : ' to roll'] };
  }
  if (aw.window === 'challenge' && phase.kind === 'settle') {
    const open = phase.challenges.filter((c) => c.winner === null);
    if (open.some((c) => c.participants.includes(me))) return { kind: 'none' };
    const tiles = open.map((c) => c.tile).join(' and ');
    return { kind: 'wait', parts: [`Face-off on tile ${tiles}: waiting for `, ...listParts(aw.players)] };
  }
  if (aw.window === 'mystery' && phase.kind === 'mysterySelect') {
    if (view.myOffer && view.myOffer.picked === null) return { kind: 'none' };
    return { kind: 'wait', parts: ['Waiting for ', ...listParts(aw.players), aw.players.length === 1 ? ' to pick a card' : ' to pick their cards'] };
  }
  return { kind: 'none' };
}

// ---------------------------------------------------------------- popups

export interface Fighter {
  player: PlayerId;
  /** Has locked a pick this pick round. */
  locked: boolean;
  /** Revealed pick, once the round resolves. */
  pick: ChallengeChoice | null;
  /** Lost earlier in this face-off (a Minority narrowing down). */
  out: boolean;
}

export interface FaceOffModel {
  challengeId: string;
  tile: number;
  kind: 'rps' | 'minority';
  pickRound: number;
  choices: Array<{ choice: ChallengeChoice; label: string }>;
  fighters: Fighter[];
  myPick: ChallengeChoice | null;
  canPick: boolean;
  /** Set while the reveal plays: who won, or null for a tie. */
  result: { winner: PlayerId | null } | null;
}

const RPS_CHOICES: FaceOffModel['choices'] = [
  { choice: 'rock', label: 'Rock' },
  { choice: 'paper', label: 'Paper' },
  { choice: 'scissors', label: 'Scissors' },
];

function choicesFor(kind: 'rps' | 'minority', theme: [string, string] | null): FaceOffModel['choices'] {
  if (kind === 'rps') return RPS_CHOICES;
  return [
    { choice: 'A', label: theme?.[0] ?? 'A' },
    { choice: 'B', label: theme?.[1] ?? 'B' },
  ];
}

/** The face-off popup, only for its players (spec #2 §7.2, C11); null for everyone else. */
/** How long my face-off's popup shows both picks before it closes for the result banner (2026-10-14). */
export const FACE_OFF_REVEAL_MS = BEAT_MS.faceOffReveal;

/**
 * The face-off popup, in clear steps (2026-10-14): the FACE-OFF! intro plays alone; then the popup opens
 * for the picks; at the result it shows both picks for FACE_OFF_REVEAL_MS, then closes for the result
 * banner. While other beats play, the settled view's challenge is stale, so the popup stays shut.
 */
export function faceOffModel({ beat, view, me, nowMs }: { beat: PlayingBeat | null; view: PlayerView; me: PlayerId; nowMs: number }): FaceOffModel | null {
  const resolved = beat?.kind === 'faceOffResult' ? beat.events.find((e) => e.type === 'ChallengeResolved') : undefined;
  if (resolved?.type === 'ChallengeResolved' && me in resolved.picks) {
    if (nowMs - beat!.startedAt >= FACE_OFF_REVEAL_MS) return null;
    const challenge = view.phase.kind === 'settle' ? view.phase.challenges.find((c) => c.id === resolved.challengeId) : undefined;
    const kind = challenge?.kind ?? (Object.keys(resolved.picks).length === 2 ? 'rps' : 'minority');
    return {
      challengeId: resolved.challengeId,
      tile: challenge?.tile ?? 0,
      kind,
      pickRound: resolved.pickRound,
      choices: choicesFor(kind, challenge?.theme ?? null),
      fighters: Object.entries(resolved.picks).map(([player, pick]) => ({ player, locked: pick !== null, pick, out: false })),
      myPick: resolved.picks[me] ?? null,
      canPick: false,
      result: { winner: resolved.winner },
    };
  }
  if (beat && beat.kind !== 'info') return null;
  if (view.phase.kind !== 'settle') return null;
  const challenge = view.phase.challenges.find((c) => c.winner === null && c.participants.includes(me));
  if (!challenge) return null;
  const myPick = (view.myPicks[challenge.id] as ChallengeChoice | undefined) ?? null;
  return {
    challengeId: challenge.id,
    tile: challenge.tile,
    kind: challenge.kind,
    pickRound: challenge.pickRound,
    choices: choicesFor(challenge.kind, challenge.theme),
    fighters: challenge.participants.map((player) => ({
      player,
      locked: challenge.picked.includes(player),
      pick: null,
      out: !challenge.contesting.includes(player),
    })),
    myPick,
    canPick: view.awaiting.window === 'challenge' && challenge.contesting.includes(me) && myPick === null,
    result: null,
  };
}

export interface CardSlot {
  slot: number;
  info: CardInfo;
  warning: string | null;
  rerolled: boolean;
  canReroll: boolean;
}

export interface CardPickModel {
  rarity: Rarity;
  tile: number;
  slots: CardSlot[];
  rerollsLeft: number;
  /** Rerolls each card allows: 1, or more with Second Thoughts (2026-10-16). */
  perSlot: number;
}

/** The card-pick popup, only for the offer's owner (spec #2 §7.2); null otherwise. */
/** Beats that only play once every pick is in: the pick's window has closed, whatever the settled view still says. */
const RESOLVING: ReadonlySet<Beat['kind']> = new Set(['cardReveal', 'cardResolved', 'cardMove', 'clash', 'boardEdit']);

export function cardPickModel(view: PlayerView, beat: Beat | null = null, maxRerolls = MAX_REROLLS): CardPickModel | null {
  const offer = view.myOffer;
  if (view.phase.kind !== 'mysterySelect' || !offer || offer.picked !== null) return null;
  if (beat && RESOLVING.has(heldBeat(beat).kind)) return null;
  const rerollsLeft = Math.max(0, (offer.maxRerolls ?? maxRerolls) - offer.rerollsUsed);
  return {
    rarity: offer.rarity,
    tile: offer.tile,
    rerollsLeft,
    perSlot: offer.perSlot ?? 1,
    slots: offer.cards.map((id, slot) => ({
      slot,
      info: cardInfo(id),
      warning: fizzleWarning(id, view),
      rerolled: offer.rerolled[slot] ?? false,
      canReroll: rerollsLeft > 0 && !(offer.rerolled[slot] ?? false),
    })),
  };
}

// ---------------------------------------------------------------- banners

export interface BannerModel {
  text: string;
  /** good = gold, bad = coral, info = white, cool = cyan. */
  tone: 'good' | 'bad' | 'info' | 'cool';
  /** Wait this long into the beat before showing: a face-off's result waits for its picks to show. */
  delayMs?: number;
}

/**
 * The big word over the board for a beat (spec #2 §5.1): my own face-offs, cards that touch
 * me, the card reveal, clashes, my dodged slides and the match winner. Null for everything else.
 */
export function bannerFor(beat: Beat, me: PlayerId, seats: readonly SeatInfo[]): BannerModel | null {
  const name = (id: PlayerId) => (seats.find((s) => s.playerId === id)?.nickname ?? id).toUpperCase();
  for (const e of beat.events) {
    switch (e.type) {
      case 'ChallengeStarted':
        if (e.players.includes(me)) return { text: 'COLLISION!', tone: 'bad' }; // the popup then says FACE-OFF (2026-10-14, as in the mockup)
        break;
      case 'ChallengeResolved':
        if (!(me in e.picks)) break;
        if (e.winner === me) return { text: 'YOU WIN!', tone: 'good', delayMs: FACE_OFF_REVEAL_MS };
        if (e.losers.includes(me)) return { text: 'YOU LOSE', tone: 'bad', delayMs: FACE_OFF_REVEAL_MS };
        return { text: 'DRAW!', tone: 'info', delayMs: FACE_OFF_REVEAL_MS };
      case 'CardResolved':
        // A card for several players (2026-10-15): my own shield, or my own hit.
        if (e.blocked?.includes(me)) return { text: 'BLOCKED!', tone: 'cool' };
        if (e.targets && e.caster !== me) {
          if (e.targets.includes(me)) return { text: 'HIT!', tone: 'bad' };
          break;
        }
        if (e.caster !== me && e.target !== me) break;
        if (e.result === 'blocked') return { text: 'BLOCKED!', tone: 'cool' };
        if (e.result === 'fizzled') return { text: 'FIZZLED', tone: 'info' };
        if (e.target === me && e.caster !== me) return { text: 'HIT!', tone: 'bad' };
        break;
      case 'Clash':
        if (e.players.includes(me) || e.casters.includes(me)) return { text: 'CLASH!', tone: 'bad' };
        break;
      case 'SnakeBlocked':
        if (e.player === me) return { text: 'DODGED!', tone: 'cool' };
        break;
      case 'MatchWon':
        // The ranks reveal replays the win: one banner is enough.
        if (beat.kind === 'ranks') return null;
        return e.winner === me ? { text: 'VICTORY!', tone: 'good' } : { text: `${name(e.winner)} WINS!`, tone: 'info' };
    }
  }
  return beat.kind === 'cardReveal' ? { text: 'CARDS REVEALED', tone: 'info' } : null;
}
