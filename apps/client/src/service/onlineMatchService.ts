import { PROTOCOL_VERSION, type LobbyIn, type LobbyOut } from '@laddorious/host';
import type { Matchmaking, MatchmakingState, MatchService, MatchSession, Profile, SeatInfo } from './matchService';
import { OnlineMatchSession, SERVER_SILENCE_MS, type OnlineDeps } from './onlineSession';
import { PING_MS, VERSION_MESSAGE, browserSocket, browserTabs, quietClose, readJson, sendJson, type SocketLike } from './onlineSocket';
import { loadSeat, saveSeat, tabStorage } from './savedSeat';
import { colorSeat } from './seats';

/** The lobby has this long to open before the game offers offline play (spec #4 §3.3). */
export const CONNECT_TIMEOUT_MS = 5000;
export const UNREACHABLE_MESSAGE = "Can't reach the game server.";
/** The lobby went quiet: a half-open connection (2026-10-15). */
export const LOST_MESSAGE = 'Lost the connection to the game server.';
/** The server couldn't start the match; its own error goes to the console, not the screen (2026-10-15). */
export const START_FAILED_MESSAGE = "The match couldn't start. Please try again.";

/**
 * The server address from VITE_SERVER (spec #4 M11): "same-origin" (the Worker served this page),
 * a ws:// or wss:// address, or null to play offline.
 */
export function serverUrl(setting: string | undefined, page: { protocol: string; host: string }): string | null {
  if (!setting) return null;
  if (setting === 'same-origin') return `${page.protocol === 'https:' ? 'wss' : 'ws'}://${page.host}`;
  if (/^wss?:\/\//.test(setting)) return setting.replace(/\/+$/, '');
  return null;
}

/** Quick match and matches on the multiplayer server (spec #4 §3.3). */
export class OnlineMatchService implements MatchService {
  private readonly deps: OnlineDeps;

  constructor(deps: Pick<OnlineDeps, 'url'> & Partial<OnlineDeps>) {
    this.deps = { open: browserSocket, store: tabStorage(), tabs: browserTabs, ...deps };
  }

  findMatch(profile: Profile): Matchmaking {
    return new OnlineMatchmaking(profile, this.deps, { type: 'find' });
  }

  createRoom(profile: Profile): Matchmaking {
    return new OnlineMatchmaking(profile, this.deps, { type: 'createRoom' });
  }

  joinRoom(profile: Profile, code: string): Matchmaking {
    return new OnlineMatchmaking(profile, this.deps, { type: 'joinRoom', code });
  }

  /** After a reload: the saved seat's match, or null (spec #4 §3.3). */
  rejoin(): MatchSession | null {
    const seat = loadSeat(this.deps.store);
    return seat ? new OnlineMatchSession(this.deps, seat, { rejoining: true }) : null;
  }
}

/** My seat first, then the others in seat order (spec #4 §4 step 3). */
function ownSeatFirst(seats: Array<SeatInfo | null>, you: number): Array<SeatInfo | null> {
  return [seats[you] ?? null, ...seats.filter((_, i) => i !== you)];
}

/** One search on the /lobby socket (spec #4 §4): quick match, or a private room (2026-10-16). */
class OnlineMatchmaking implements Matchmaking {
  private readonly listeners = new Set<(s: MatchmakingState) => void>();
  private state: MatchmakingState;
  private readonly ws: SocketLike;
  private readonly timeout: ReturnType<typeof setTimeout>;
  /** Found, cancelled or unreachable: the lobby socket is done with. */
  private done = false;
  /** Pings the lobby, and notices when it goes quiet (2026-10-15). */
  private pinger: ReturnType<typeof setInterval> | null = null;
  private heardAt = 0;

  constructor(
    profile: Profile,
    private readonly deps: OnlineDeps,
    /** What the lobby is asked first: find, createRoom or joinRoom. */
    start: Extract<LobbyIn, { type: 'find' | 'createRoom' | 'joinRoom' }>,
  ) {
    // Until the lobby answers, I'm alone at the table.
    const me = colorSeat({ playerId: 'p0', nickname: profile.nickname, piece: profile.piece, bot: false }, 0);
    this.state = { kind: 'searching', elapsedMs: 0, seats: [me, null, null, null] };
    this.ws = deps.open(`${deps.url}/lobby`);
    this.timeout = setTimeout(() => this.unreachable(UNREACHABLE_MESSAGE), CONNECT_TIMEOUT_MS);
    this.ws.onopen = () => {
      clearTimeout(this.timeout);
      this.heardAt = Date.now();
      this.post({ type: 'hello', version: PROTOCOL_VERSION, profile });
      this.post(start);
      this.pinger = setInterval(() => this.tick(), PING_MS);
    };
    this.ws.onmessage = (e) => {
      this.heardAt = Date.now();
      this.receive(e.data);
    };
    this.ws.onclose = () => this.unreachable(UNREACHABLE_MESSAGE);
    this.ws.onerror = () => {}; // a close follows
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
    if (this.state.kind === 'searching') this.post({ type: 'cancel' });
    else if (this.state.kind !== 'unreachable' && this.state.kind !== 'roomError') return; // ignored once bots are taking seats
    this.finish();
    this.emit({ kind: 'cancelled' });
  }

  playWithBots(): void {
    if (this.state.kind === 'searching') this.post({ type: 'playWithBots' });
  }

  startRoom(): void {
    if (this.state.kind === 'searching' && this.state.room?.host) this.post({ type: 'startRoom' });
  }

  private receive(data: unknown): void {
    const msg = readJson<LobbyOut>(data);
    if (!msg || this.done) return;
    switch (msg.type) {
      case 'matchmaking': {
        const seats = ownSeatFirst(
          msg.seats.map((s, i) => (s ? colorSeat(s, i) : null)),
          msg.you,
        );
        const room = msg.room ? { room: msg.room } : {};
        if (msg.state === 'filling') this.emit({ kind: 'filling', seats, ...room });
        else if (this.state.kind === 'searching') this.emit({ kind: 'searching', elapsedMs: msg.elapsedMs, seats, ...room });
        return;
      }
      case 'roomError':
        this.finish();
        this.emit({ kind: 'roomError', message: msg.message });
        return;
      case 'found': {
        this.finish();
        const seat = { matchId: msg.matchId, token: msg.token, me: msg.me, seats: msg.seats };
        saveSeat(this.deps.store, seat);
        this.emit({ kind: 'found', session: new OnlineMatchSession(this.deps, seat) });
        return;
      }
      case 'failed':
        if (msg.reason !== 'version') console.warn(`the match couldn't start: ${msg.message}`);
        this.unreachable(msg.reason === 'version' ? VERSION_MESSAGE : START_FAILED_MESSAGE);
        return;
      case 'pong':
        return;
    }
  }

  private unreachable(message: string): void {
    if (this.done) return;
    this.finish();
    this.emit({ kind: 'unreachable', message });
  }

  /** Every 5 s: ping, unless the lobby has gone quiet, which means a half-open socket (a phone waking, a Wi-Fi switch). */
  private tick(): void {
    if (Date.now() - this.heardAt <= SERVER_SILENCE_MS) this.post({ type: 'ping', t: Date.now() });
    else this.unreachable(LOST_MESSAGE);
  }

  private finish(): void {
    this.done = true;
    clearTimeout(this.timeout);
    if (this.pinger !== null) clearInterval(this.pinger);
    this.pinger = null;
    quietClose(this.ws);
  }

  private post(msg: LobbyIn): void {
    sendJson(this.ws, msg);
  }

  private emit(s: MatchmakingState): void {
    this.state = s;
    for (const cb of this.listeners) cb(s);
  }
}
