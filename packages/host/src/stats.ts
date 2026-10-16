import type { CardResult, GameEvent, PlayerId, Rarity } from '@laddorious/core';
import type { PieceId, Seat } from './types';

// Match stats (the user, 2026-10-17): every match, online and offline, for real players only. The
// host reads the engine's events as the match plays and builds rows a database can store as they are.

/** Where the match was played: offline against bots, an online quick match, or a private room. */
export type StatsMode = 'offline' | 'quick' | 'room';
/** How it ended: someone won, everyone left first, or the host failed. */
export type MatchStatus = 'finished' | 'abandoned' | 'failed';

export interface MatchStatsRow {
  mode: StatsMode;
  status: MatchStatus;
  /** The game's version. */
  version: string;
  /** The board seed: the board can be rebuilt from it. */
  seed: string;
  /** The round the match ended in. */
  rounds: number;
  durationMs: number;
  humans: number;
  bots: number;
  /** Whether a real player won; null when nobody did. */
  humanWon: boolean | null;
}

/** One real player in a match. */
export interface PlayerStatsRow {
  /** A random id kept on the player's device: no account, but their matches link up. */
  playerKey: string;
  nickname: string;
  piece: PieceId;
  /** Their finishing place, or null when the match didn't finish. */
  place: number | null;
  tile: number;
  rockets: number;
  whirlpools: number;
  /** Whirlpools a shield blocked. */
  dodged: number;
  faceOffsWon: number;
  faceOffsLost: number;
  cardsPicked: number;
  /** They left, or were away, when the match ended. */
  leftEarly: boolean;
}

/** One card a real player was shown, and what came of it. */
export interface CardStatsRow {
  playerKey: string;
  cardId: string;
  rarity: Rarity;
  round: number;
  picked: boolean;
  /** Picked for them when time ran out. */
  auto: boolean;
  /** How the card played; null when it wasn't picked, or the match ended first. */
  result: CardResult | null;
  /** The player who picked it won the match. */
  pickerWon: boolean;
}

export interface MatchStats {
  match: MatchStatsRow;
  players: PlayerStatsRow[];
  cards: CardStatsRow[];
}

/** What the tally needs to know that the events don't say. */
export interface StatsContext {
  mode: StatsMode;
  version: string;
  seed: string;
  /** Each real player's device key, by seat. A human seat without one gets an empty key. */
  keys: Record<PlayerId, string>;
}

type Counts = Omit<PlayerStatsRow, 'playerKey' | 'nickname' | 'piece' | 'leftEarly'>;
type CardRow = Omit<CardStatsRow, 'playerKey' | 'pickerWon'> & { player: PlayerId };

/** Reads a match's events, real players only, and builds its stats rows. */
export class StatsTally {
  private readonly humans: readonly Seat[];
  private readonly counts = new Map<PlayerId, Counts>();
  private readonly cards: CardRow[] = [];
  /** Each player's current card offer: its rarity, and where its rows start. */
  private readonly offers = new Map<PlayerId, { rarity: Rarity; from: number }>();
  private readonly startedAt: number;
  private round = 1;
  private winner: PlayerId | null = null;

  constructor(
    private readonly seats: readonly Seat[],
    private readonly ctx: StatsContext & { now?: () => number },
  ) {
    this.humans = seats.filter((s) => !s.bot);
    for (const s of this.humans) this.counts.set(s.playerId, { place: null, tile: 0, rockets: 0, whirlpools: 0, dodged: 0, faceOffsWon: 0, faceOffsLost: 0, cardsPicked: 0 });
    this.startedAt = this.now();
  }

  add(events: readonly GameEvent[]): void {
    for (const e of events) this.read(e);
  }

  /** The match's rows, as it ends. `away` are the real players not there at the end. */
  result(status: MatchStatus, away: readonly PlayerId[] = []): MatchStats {
    const key = (id: PlayerId) => this.ctx.keys[id] ?? '';
    return {
      match: {
        mode: this.ctx.mode,
        status,
        version: this.ctx.version,
        seed: this.ctx.seed,
        rounds: this.round,
        durationMs: Math.max(0, this.now() - this.startedAt),
        humans: this.humans.length,
        bots: this.seats.length - this.humans.length,
        humanWon: this.winner === null ? null : this.humans.some((s) => s.playerId === this.winner),
      },
      players: this.humans.map((s) => ({ playerKey: key(s.playerId), nickname: s.nickname, piece: s.piece, ...this.counts.get(s.playerId)!, leftEarly: away.includes(s.playerId) })),
      cards: this.cards.map(({ player, ...row }) => ({ playerKey: key(player), ...row, pickerWon: row.picked && player === this.winner })),
    };
  }

  private read(e: GameEvent): void {
    const mine = (id: PlayerId) => this.counts.get(id);
    switch (e.type) {
      case 'RoundEnded':
        this.round += 1;
        return;
      case 'Moved': {
        const c = mine(e.player);
        if (!c) return;
        c.tile = e.to;
        if (e.cause === 'ladder') c.rockets += 1;
        if (e.cause === 'snake') c.whirlpools += 1;
        return;
      }
      case 'SnakeBlocked': {
        const c = mine(e.player);
        if (c) c.dodged += 1;
        return;
      }
      case 'ChallengeResolved': {
        if (e.winner !== null && (e.outcome === 'win' || e.outcome === 'random')) {
          const c = mine(e.winner);
          if (c) c.faceOffsWon += 1;
        }
        for (const id of e.losers) {
          const c = mine(id);
          if (c) c.faceOffsLost += 1;
        }
        return;
      }
      case 'MysteryOffered':
        if (!mine(e.player)) return;
        this.offers.set(e.player, { rarity: e.rarity, from: this.cards.length });
        for (const cardId of e.cards) this.cards.push({ player: e.player, cardId, rarity: e.rarity, round: this.round, picked: false, auto: false, result: null });
        return;
      case 'CardRerolled': {
        const offer = this.offers.get(e.player);
        if (offer) this.cards.push({ player: e.player, cardId: e.to, rarity: offer.rarity, round: this.round, picked: false, auto: false, result: null });
        return;
      }
      case 'CardSelected': {
        const offer = this.offers.get(e.player);
        const c = mine(e.player);
        if (!offer || !c) return;
        const row = this.cards.slice(offer.from).findLast((r) => r.player === e.player && r.cardId === e.cardId && !r.picked);
        if (!row) return;
        row.picked = true;
        row.auto = e.auto;
        c.cardsPicked += 1;
        this.offers.delete(e.player);
        return;
      }
      case 'CardResolved': {
        const row = this.cards.findLast((r) => r.player === e.caster && r.cardId === e.cardId && r.picked && r.result === null);
        if (row) row.result = e.result;
        return;
      }
      case 'MatchWon':
        this.winner = e.winner;
        for (const r of e.rankings) {
          const c = mine(r.player);
          if (c) c.place = r.rank;
        }
        return;
      default:
        return;
    }
  }

  private now(): number {
    return (this.ctx.now ?? Date.now)();
  }
}
