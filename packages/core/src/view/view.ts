import { awaiting } from '../engine/awaiting';
import { clonePlain } from '../engine/util';
import type {
  Awaiting,
  BoardEdit,
  Challenge,
  GameEvent,
  MatchState,
  Offer,
  PlayerId,
  PlayerState,
  Ranking,
} from '../engine/types';
import type { Board } from '../board/types';
import type { ActiveEffect } from '../cards/types';

export interface PublicChallenge {
  id: string;
  tile: number;
  participants: PlayerId[];
  contesting: PlayerId[];
  kind: Challenge['kind'];
  theme: Challenge['theme'];
  pickRound: number;
  /** Who has locked a pick this round — never what they picked. */
  picked: PlayerId[];
  winner: PlayerId | null;
}

export type PublicPhase =
  | { kind: 'dice'; window: 'dice' | 'bonusGrace'; seqs: Record<PlayerId, { faces: number[]; status: string }> }
  | { kind: 'settle'; challenges: PublicChallenge[] }
  | { kind: 'mysterySelect'; picked: Record<PlayerId, boolean> }
  | { kind: 'finished'; winner: PlayerId; rankings: Ranking[] };

export interface PlayerView {
  me: PlayerId;
  round: number;
  board: Board;
  players: PlayerState[];
  effects: ActiveEffect[];
  boardEdits: BoardEdit[];
  phase: PublicPhase;
  /** My own Mystery hand, if I have an encounter this round. */
  myOffer: Offer | null;
  /** My own locked pick in each open challenge. */
  myPicks: Record<string, string>;
  awaiting: Awaiting;
}

/** What one player may see (spec §3.6): public state plus only their own private data. */
export function viewFor(s: MatchState, me: PlayerId): PlayerView {
  const phase = s.phase;
  let publicPhase: PublicPhase;
  let myOffer: Offer | null = null;
  const myPicks: Record<string, string> = {};
  switch (phase.kind) {
    case 'dice':
      publicPhase = clonePlain(phase);
      break;
    case 'settle':
      publicPhase = {
        kind: 'settle',
        challenges: phase.ctx.challenges.map((c) => {
          const mine = c.picks[me];
          if (mine !== undefined) myPicks[c.id] = mine;
          return {
            id: c.id,
            tile: c.tile,
            participants: [...c.participants],
            contesting: [...c.contesting],
            kind: c.kind,
            theme: c.theme,
            pickRound: c.pickRound,
            picked: Object.keys(c.picks),
            winner: c.winner,
          };
        }),
      };
      break;
    case 'mysterySelect': {
      const picked: Record<PlayerId, boolean> = {};
      for (const o of Object.values(phase.offers)) picked[o.player] = o.picked !== null;
      publicPhase = { kind: 'mysterySelect', picked };
      myOffer = phase.offers[me] ? clonePlain(phase.offers[me]) : null;
      break;
    }
    case 'finished':
      publicPhase = clonePlain(phase);
      break;
  }
  return {
    me,
    round: s.round,
    board: clonePlain(s.board),
    players: clonePlain(s.players),
    effects: clonePlain(s.effects),
    boardEdits: clonePlain(s.boardEdits),
    phase: publicPhase,
    myOffer,
    myPicks,
    awaiting: awaiting(s),
  };
}

/** Events this player may see. */
export function eventsFor(events: readonly GameEvent[], me: PlayerId): GameEvent[] {
  return events.filter((e) => e.visibility === 'public' || e.visibility.private === me);
}
