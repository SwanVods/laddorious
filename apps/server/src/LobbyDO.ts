import { DurableObject } from 'cloudflare:workers';
import type { LobbyIn, LobbyOut, Seat } from '@laddorious/host';
import type { Env } from './env';
import { LobbyCore, type MatchInfo, type StartedMatch } from './lobby';
import { acceptSocket } from './socket';
import { parseLobbyMessage } from './validate';

/** The one lobby (spec #4 §3.2): matchmaking for every game, around LobbyCore. */
export class LobbyDO extends DurableObject<Env> {
  private readonly lobby = new LobbyCore((seats, info) => this.startMatch(seats, info));

  override fetch(request: Request): Response {
    return acceptSocket<LobbyIn, LobbyOut>(request, {
      parse: parseLobbyMessage,
      receive: (conn, msg) => this.lobby.receive(conn, msg),
      drop: (conn) => this.lobby.drop(conn),
    });
  }

  /** Starts the seats' match in a fresh Match object. */
  private async startMatch(seats: Seat[], info: MatchInfo): Promise<StartedMatch> {
    const id = this.env.MATCH.newUniqueId();
    const tokens = await this.env.MATCH.get(id).start(seats, info);
    return { matchId: id.toString(), tokens };
  }
}
