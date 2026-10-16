import type { Board, Jump, Rarity } from '../board/types';
import type { ActiveEffect, BoardEditLifetime, CardType, MoveCause, RollCheck } from '../cards/types';
import type { RngStream } from '../rng/stream';
import type { MatchConfig } from './config';

export type PlayerId = string;

export interface PlayerSeat {
  id: PlayerId;
}

export interface PlayerState {
  id: PlayerId;
  seat: number;
  position: number;
}

export type WindowKind = 'dice' | 'challenge' | 'mystery' | 'none';

export interface DiceSeq {
  /** One face per die rolled this round: always one today, a list so a future card can add dice. */
  faces: number[];
  /** 'skipped': a card made the player sit this roll out (2026-10-16). */
  status: 'ready' | 'done' | 'skipped';
}

export interface Mover {
  player: PlayerId;
  cause: MoveCause;
}

export type RpsChoice = 'rock' | 'paper' | 'scissors';
export type MinorityChoice = 'A' | 'B';
export type ChallengeChoice = RpsChoice | MinorityChoice;

export interface Challenge {
  id: string;
  tile: number;
  participants: PlayerId[];
  /** Players still in the fight. */
  contesting: PlayerId[];
  kind: 'rps' | 'minority';
  /** Cosmetic labels for Minority choices A and B (null for RPS). */
  theme: [string, string] | null;
  /** 1-based picking round (initial = 1). */
  pickRound: number;
  picks: Record<PlayerId, ChallengeChoice>;
  losers: PlayerId[];
  winner: PlayerId | null;
}

export interface SettleCtx {
  /** Players who moved in the current step of the loop. */
  movers: Mover[];
  /** Number of challenge waves started in this settle. */
  wave: number;
  /** The current wave's challenges (empty when no wave is in progress). */
  challenges: Challenge[];
}

export type AfterSettle = 'mysteryDetect' | 'resolveGroups';

export interface Offer {
  player: PlayerId;
  tile: number;
  rarity: Rarity;
  cards: [string, string, string];
  rerolled: [boolean, boolean, boolean];
  rerollsUsed: number;
  /** Every card shown in this hand, in the order shown: rerolls avoid them while they can (polish spec §3.2). */
  seen: string[];
  picked: number | null;
  /** True when the pick was made by the timeout rule. */
  autoPicked: boolean;
}

export interface PendingCard {
  caster: PlayerId;
  cardId: string;
  /** Hidden target locked at reveal time; re-checked at resolution. */
  target: PlayerId | null;
}

export interface Ranking {
  player: PlayerId;
  rank: number;
  position: number;
}

export type Phase =
  | { kind: 'dice'; seqs: Record<PlayerId, DiceSeq> }
  | { kind: 'settle'; ctx: SettleCtx; after: AfterSettle }
  | { kind: 'mysterySelect'; offers: Record<PlayerId, Offer> }
  | { kind: 'finished'; winner: PlayerId; rankings: Ranking[] };

export interface BoardEdit {
  id: string;
  added: Jump[];
  removed: Jump[];
  lifetime: BoardEditLifetime;
  createdRound: number;
  sourceCard: string;
  sourcePlayer: PlayerId;
}

export interface MatchState {
  config: MatchConfig;
  board: Board;
  /** Seat order. */
  players: PlayerState[];
  round: number;
  windowId: number;
  phase: Phase;
  rng: { dice: RngStream[]; cards: RngStream[]; misc: RngStream };
  effects: ActiveEffect[];
  boardEdits: BoardEdit[];
  /** Remaining card groups while Mystery resolution is in progress. */
  resolution: PendingCard[][] | null;
  /** Players whose position changed during this round's dice movement/settle (spec D20). */
  movedThisRound: PlayerId[];
  /** Dice totals of the current/last dice phase. */
  lastTotals: Record<PlayerId, number>;
  /** Monotonic counter for effect/edit/challenge ids and effect seq. */
  counter: number;
}

/**
 * Every input names the window it answers (`awaiting(state).windowId`), so a
 * network retry that arrives after its window closed is rejected as stale.
 */
export type Input =
  | { type: 'roll'; player: PlayerId; windowId: number }
  | { type: 'challengePick'; player: PlayerId; challengeId: string; choice: ChallengeChoice; windowId: number }
  | { type: 'reroll'; player: PlayerId; slot: number; windowId: number }
  | { type: 'pickCard'; player: PlayerId; slot: number; windowId: number }
  | { type: 'timeout'; windowId: number };

export type Visibility = 'public' | { private: PlayerId };

export type CardResult = 'hit' | 'blocked' | 'fizzled';

export type EventBody =
  | { type: 'RoundStarted'; round: number }
  | { type: 'WindowOpened'; windowId: number; window: WindowKind; players: PlayerId[]; durationMs: number }
  | { type: 'DieRolled'; player: PlayerId; natural: number; face: number; forced: boolean; auto: boolean }
  | { type: 'RollSkipped'; player: PlayerId; effectId: string }
  /** A roll check on the player's roll (2026-10-16): whether it held. */
  | { type: 'RollChecked'; player: PlayerId; effectId: string; met: boolean; check: RollCheck }
  | { type: 'DiceTotaled'; player: PlayerId; faces: number[]; total: number }
  | { type: 'Moved'; player: PlayerId; from: number; to: number; cause: MoveCause; bounced: boolean }
  | { type: 'SnakeBlocked'; player: PlayerId; tile: number; effectId: string }
  | { type: 'ChallengeStarted'; challengeId: string; tile: number; players: PlayerId[]; kind: 'rps' | 'minority'; theme: [string, string] | null }
  | { type: 'ChallengePickLocked'; challengeId: string; player: PlayerId }
  | { type: 'ChallengePickEcho'; challengeId: string; player: PlayerId; choice: ChallengeChoice }
  | {
      type: 'ChallengeResolved';
      challengeId: string;
      pickRound: number;
      picks: Record<PlayerId, ChallengeChoice | null>;
      winner: PlayerId | null;
      losers: PlayerId[];
      outcome: 'win' | 'replay' | 'continue' | 'random';
    }
  | { type: 'SafetyCapApplied'; tile: number; steppedBack: PlayerId[] }
  | { type: 'MysteryOffered'; player: PlayerId; tile: number; rarity: Rarity; cards: string[] }
  | { type: 'CardRerolled'; player: PlayerId; slot: number; from: string; to: string }
  | { type: 'CardSelected'; player: PlayerId; cardId: string; cardType: CardType; rarity: Rarity; auto: boolean }
  | { type: 'CardResolved'; caster: PlayerId; cardId: string; target: PlayerId | null; result: CardResult; reason?: 'no-target' | 'no-placement' | 'clash'; roll?: number; targets?: PlayerId[]; blocked?: PlayerId[] }
  | { type: 'Clash'; cardIds: string[]; casters: PlayerId[]; players: PlayerId[] }
  | { type: 'EffectAdded'; effect: ActiveEffect }
  | { type: 'EffectRemoved'; effectId: string; owner: PlayerId; reason: 'card' | 'charges' }
  | { type: 'EffectExpired'; effectId: string; owner: PlayerId }
  | { type: 'BoardEdited'; edit: BoardEdit }
  | { type: 'BoardEditExpired'; editId: string; restored: string[]; dropped: string[] }
  | { type: 'RoundEnded'; round: number }
  | { type: 'MatchWon'; winner: PlayerId; rankings: Ranking[] };

export type GameEvent = EventBody & { visibility: Visibility };

export type InputErrorCode =
  | 'INVALID_INPUT'
  | 'MATCH_FINISHED'
  | 'WRONG_PHASE'
  | 'UNKNOWN_PLAYER'
  | 'NOT_AWAITED'
  | 'STALE_TIMEOUT'
  | 'STALE_INPUT'
  | 'UNKNOWN_CHALLENGE'
  | 'INVALID_CHOICE'
  | 'INVALID_SLOT'
  | 'REROLL_LIMIT'
  | 'SLOT_ALREADY_REROLLED'
  | 'ALREADY_PICKED';

export interface InputError {
  code: InputErrorCode;
  message: string;
}

export type StepResult =
  | { ok: true; state: MatchState; events: GameEvent[] }
  | { ok: false; error: InputError };

export interface Awaiting {
  windowId: number;
  window: WindowKind;
  players: PlayerId[];
  durationMs: number;
}
