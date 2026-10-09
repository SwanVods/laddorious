import { PROTOCOL_VERSION, type LobbyIn, type LobbyOut } from '@laddorious/host';
import type { Matchmaking, MatchmakingState, MatchService, MatchSession, Profile, SeatInfo } from './matchService';
import { OnlineMatchSession, type OnlineDeps } from './onlineSession';
import { VERSION_MESSAGE, browserSocket, quietClose, readJson, sendJson, type SocketLike } from './onlineSocket';
import { loadSeat, saveSeat, tabStorage } from './savedSeat';
import { colorSeat } from './seats';

/** The lobby has this long to open before the game offers offline play (spec #4 §3.3). */
export const CONNECT_TIMEOUT_MS = 5000;
export const UNREACHABLE_MESSAGE = "Can't reach the game server.";

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
    this.deps = { open: browserSocket, store: tabStorage(), ...deps };
  }

  findMatch(profile: Profile): Matchmaking {
    return new OnlineMatchmaking(profile, this.deps);
  }

  /** After a reload: the saved seat's match, or null (spec #4 §3.3). */
  rejoin(): MatchSession | null {
    const seat = loadSeat(this.deps.store);
    return seat ? new OnlineMatchSession(this.deps, seat) : null;
  }
}

/** My seat first, then the others in seat order (spec #4 §4 step 3). */
function ownSeatFirst(seats: Array<SeatInfo | null>, you: number): Array<SeatInfo | null> {
  return [seats[you] ?? null, ...seats.filter((_, i) => i !== you)];
}

/** One search on the /lobby socket (spec #4 §4). */
class OnlineMatchmaking implements Matchmaking {
  private readonly listeners = new Set<(s: MatchmakingState) => void>();
  private state: MatchmakingState;
  private readonly ws: SocketLike;
  private readonly timeout: ReturnType<typeof setTimeout>;
  /** Found, cancelled or unreachable: the lobby socket is done with. */
  private done = false;

  constructor(
    profile: Profile,
    private readonly deps: OnlineDeps,
  ) {
    // Until the lobby answers, I'm alone at the table.
    const me = colorSeat({ playerId: 'p0', nickname: profile.nickname, piece: profile.piece, bot: false }, 0);
    this.state = { kind: 'searching', elapsedMs: 0, seats: [me, null, null, null] };
    this.ws = deps.open(`${deps.url}/lobby`);
    this.timeout = setTimeout(() => this.unreachable(UNREACHABLE_MESSAGE), CONNECT_TIMEOUT_MS);
    this.ws.onopen = () => {
      clearTimeout(this.timeout);
      this.post({ type: 'hello', version: PROTOCOL_VERSION, profile });
      this.post({ type: 'find' });
    };
    this.ws.onmessage = (e) => this.receive(e.data);
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
    else if (this.state.kind !== 'unreachable') return; // ignored once bots are taking seats
    this.finish();
    this.emit({ kind: 'cancelled' });
  }

  playWithBots(): void {
    if (this.state.kind === 'searching') this.post({ type: 'playWithBots' });
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
        if (msg.state === 'filling') this.emit({ kind: 'filling', seats });
        else if (this.state.kind === 'searching') this.emit({ kind: 'searching', elapsedMs: msg.elapsedMs, seats });
        return;
      }
      case 'found': {
        this.finish();
        const seat = { matchId: msg.matchId, token: msg.token, me: msg.me, seats: msg.seats };
        saveSeat(this.deps.store, seat);
        this.emit({ kind: 'found', session: new OnlineMatchSession(this.deps, seat) });
        return;
      }
      case 'failed':
        this.unreachable(msg.reason === 'version' ? VERSION_MESSAGE : msg.message);
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

  private finish(): void {
    this.done = true;
    clearTimeout(this.timeout);
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
