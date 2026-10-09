import type { InputError, PlayerId } from '@laddorious/core';
import type { MatchIn, MatchOut } from '@laddorious/host';
import { Channel } from './channel';
import type { MatchFailure, MatchSession, MatchUpdate, PlayerAction, SeatInfo } from './matchService';
import { PING_MS, VERSION_MESSAGE, quietClose, readJson, sendJson, type OpenSocket, type SocketLike } from './onlineSocket';
import { clearSeat, type SavedSeat, type SeatStore } from './savedSeat';
import { colorSeats } from './seats';

/** Waits between reconnect attempts (spec #4 §3.3); after the last, every 8 s. */
export const BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;
/** How long the game keeps trying: the server's rejoin window. */
export const REJOIN_MS = 60_000;
/** The clock offset is the median of this many pings (spec #4 §5.3). */
const CLOCK_SAMPLES = 5;
export const SEAT_LOST_MESSAGE = 'The match carried on without you';

/** What an online session needs from its surroundings; tests pass fakes. */
export interface OnlineDeps {
  /** The server's ws:// or wss:// address, without a trailing slash. */
  url: string;
  open: OpenSocket;
  store: SeatStore | null;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * My seat in an online match (spec #4 §3.3): the /match/:id socket, the clock difference with
 * the server, who is away, and reconnecting with backoff for up to 60 s.
 */
export class OnlineMatchSession implements MatchSession {
  readonly me: PlayerId;
  readonly seats: SeatInfo[];
  private ws: SocketLike | null = null;
  private windowId = 0;
  /** Left, failed or won: no more reconnecting. */
  private over = false;
  private away: PlayerId[] = [];
  private downSince: number | null = null;
  private attempt = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;
  private samples: number[] = [];
  /** Server time minus my time. */
  private offset = 0;
  private readonly updates = new Channel<MatchUpdate>();
  private readonly rejections = new Channel<InputError>();
  private readonly failures = new Channel<MatchFailure>();
  private readonly presence = new Channel<PlayerId[]>();

  constructor(
    private readonly deps: OnlineDeps,
    private readonly seat: SavedSeat,
  ) {
    this.me = seat.me;
    this.seats = colorSeats(seat.seats);
    this.connect();
  }

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    return this.updates.on(cb);
  }

  onRejected(cb: (e: InputError) => void): () => void {
    return this.rejections.on(cb);
  }

  onFailed(cb: (e: MatchFailure) => void): () => void {
    return this.failures.on(cb);
  }

  onPresence(cb: (away: PlayerId[]) => void): () => void {
    return this.presence.on(cb);
  }

  send(action: PlayerAction): void {
    this.post({ type: 'action', action, windowId: this.windowId });
  }

  playbackDone(windowId: number): void {
    this.post({ type: 'playbackDone', windowId });
  }

  /** The server's match never pauses for one player: pausing is local only (spec #2 C14). */
  pause(): void {}

  resume(): void {}

  leave(): void {
    if (!this.over) this.post({ type: 'leave' });
    this.finish();
    this.close();
  }

  private connect(): void {
    const ws = this.deps.open(`${this.deps.url}/match/${this.seat.matchId}`);
    this.ws = ws;
    ws.onopen = () => {
      this.post({ type: 'join', token: this.seat.token });
      this.ping();
      this.pinger = setInterval(() => this.ping(), PING_MS);
    };
    ws.onmessage = (e) => this.receive(e.data);
    ws.onclose = () => this.dropped();
    ws.onerror = () => {}; // a close follows
  }

  private receive(data: unknown): void {
    const msg = readJson<MatchOut>(data);
    if (!msg || this.over) return;
    switch (msg.type) {
      case 'welcome':
        this.downSince = null;
        this.attempt = 0;
        if (this.samples.length === 0) this.offset = msg.serverTime - Date.now(); // a first guess until the pings answer
        return;
      case 'update': {
        const { update } = msg;
        this.windowId = update.view.awaiting.windowId;
        // The countdown on my own clock, so a phone with a wrong clock still counts right.
        this.updates.emit(update.timer ? { ...update, timer: { ...update.timer, endsAt: update.timer.endsAt - this.offset } } : update);
        if (update.view.phase.kind === 'finished') this.finish();
        return;
      }
      case 'rejected':
        this.rejections.emit(msg.error);
        return;
      case 'presence':
        this.away = msg.away;
        this.presence.emit(msg.away);
        return;
      case 'pong':
        this.samples = [...this.samples, msg.serverTime - (msg.t + Date.now()) / 2].slice(-CLOCK_SAMPLES);
        this.offset = median(this.samples);
        return;
      case 'failed':
        this.finish();
        this.close();
        this.failures.emit({ message: msg.reason === 'version' ? VERSION_MESSAGE : msg.message, reason: msg.reason });
        return;
    }
  }

  /** The socket closed. Unless the match is over, try again with backoff for up to 60 s. */
  private dropped(): void {
    this.stopPinging();
    this.ws = null;
    if (this.over) return;
    const now = Date.now();
    if (this.downSince === null) {
      this.downSince = now;
      this.presence.emit([...this.away.filter((id) => id !== this.me), this.me]);
    }
    if (now - this.downSince >= REJOIN_MS) {
      this.finish();
      this.failures.emit({ message: SEAT_LOST_MESSAGE, reason: 'seat-lost' });
      return;
    }
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
    this.attempt += 1;
    this.retry = setTimeout(() => {
      this.retry = null;
      if (!this.over) this.connect();
    }, delay);
  }

  private ping(): void {
    this.post({ type: 'ping', t: Date.now() });
  }

  private post(msg: MatchIn): void {
    sendJson(this.ws, msg);
  }

  /** No more reconnecting, and no rejoin after a reload. */
  private finish(): void {
    this.over = true;
    clearSeat(this.deps.store);
    if (this.retry !== null) clearTimeout(this.retry);
    this.retry = null;
  }

  private close(): void {
    this.stopPinging();
    if (this.ws) quietClose(this.ws);
    this.ws = null;
  }

  private stopPinging(): void {
    if (this.pinger !== null) clearInterval(this.pinger);
    this.pinger = null;
  }
}
