import { SEAT_COLORS } from '../app/theme';
import type { HostWorker } from '../worker/protocol';
import { PIECES, type FindOptions, type Matchmaking, type MatchmakingState, type MatchService, type Profile, type SeatInfo } from './matchService';
import { WorkerMatchSession } from './workerSession';

/** How often `searching` reports the elapsed time, and the pause between bots taking seats (spec #2 §4.4). */
export const SEARCH_TICK_MS = 250;
export const BOT_SEAT_MS = 420;

const BOT_NAMES = ['Mochi', 'Pip', 'Juno'] as const;

/** Seat 0 is you; the bots take the pieces you didn't choose, in picker order. */
function seatsFor(profile: Profile): SeatInfo[] {
  const pieces = PIECES.filter((p) => p !== profile.piece);
  return [
    { playerId: 'p0', nickname: profile.nickname, piece: profile.piece, color: SEAT_COLORS.you, bot: false },
    ...BOT_NAMES.map((nickname, i) => ({
      playerId: `p${i + 1}`,
      nickname,
      piece: pieces[i]!,
      color: SEAT_COLORS.bots[i]!,
      bot: true,
    })),
  ];
}

/** 128 random bits as hex, from the platform's secure generator. */
function randomSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Matchmaking that never finds a real player; "Play with bots" fills the empty seats (spec #2 C7). */
export class LocalMatchService implements MatchService {
  constructor(
    private readonly createWorker: () => HostWorker,
    /** e2e builds: matches play themselves, fast (spec #2 §9.3). */
    private readonly opts: { fast?: boolean } = {},
  ) {}

  findMatch(profile: Profile, opts: FindOptions = {}): Matchmaking {
    return new LocalMatchmaking(seatsFor(profile), this.createWorker, opts.seed ?? null, this.opts.fast ?? false);
  }
}

class LocalMatchmaking implements Matchmaking {
  private readonly listeners = new Set<(s: MatchmakingState) => void>();
  private readonly startedAt = Date.now();
  private readonly table: Array<SeatInfo | null>;
  private readonly ticker: ReturnType<typeof setInterval>;
  private state: MatchmakingState;

  constructor(
    private readonly seats: SeatInfo[],
    private readonly createWorker: () => HostWorker,
    /** A dev seed for the board; the dice (rng) seed is always random and secret. */
    private readonly boardSeed: string | null,
    private readonly fast: boolean,
  ) {
    this.table = [seats[0]!, null, null, null];
    this.state = this.searching();
    this.ticker = setInterval(() => this.emit(this.searching()), SEARCH_TICK_MS);
  }

  /** Calls cb with the current state at once, then with every change. */
  onState(cb: (s: MatchmakingState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => {
      this.listeners.delete(cb);
    };
  }

  cancel(): void {
    if (this.state.kind !== 'searching') return;
    clearInterval(this.ticker);
    this.emit({ kind: 'cancelled' });
  }

  playWithBots(): void {
    if (this.state.kind !== 'searching') return;
    clearInterval(this.ticker);
    this.emit({ kind: 'filling', seats: [...this.table] });
    this.seatBot(1);
  }

  private seatBot(seat: number): void {
    setTimeout(() => {
      this.table[seat] = this.seats[seat]!;
      this.emit({ kind: 'filling', seats: [...this.table] });
      if (seat < this.seats.length - 1) {
        this.seatBot(seat + 1);
        return;
      }
      const session = new WorkerMatchSession(this.createWorker(), this.seats, { seed: this.boardSeed ?? randomSeed(), rngSeed: randomSeed() }, this.fast);
      this.emit({ kind: 'found', session });
    }, BOT_SEAT_MS);
  }

  private searching(): MatchmakingState {
    return { kind: 'searching', elapsedMs: Date.now() - this.startedAt, seats: [...this.table] };
  }

  private emit(s: MatchmakingState): void {
    this.state = s;
    for (const cb of this.listeners) cb(s);
  }
}
