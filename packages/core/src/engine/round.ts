import { revertEdit } from '../cards/boardEdit';
import { startDicePhase } from './dice';
import { expireEffects } from './effects';
import type { GameEvent, MatchState, Ranking } from './types';
import { pub } from './util';

export function startRound(s: MatchState, ev: GameEvent[]): void {
  s.round += 1;
  s.movedThisRound = [];
  ev.push(pub({ type: 'RoundStarted', round: s.round }));
  startDicePhase(s, ev);
}

export function rankPlayers(s: MatchState): Ranking[] {
  return [...s.players]
    .sort((a, b) => b.position - a.position || a.seat - b.seat)
    .map((p) => ({
      player: p.id,
      position: p.position,
      rank: 1 + s.players.filter((o) => o.position > p.position).length,
    }));
}

/** Round end (spec §4.11): lifetimes tick, victory check, next round. */
export function endRound(s: MatchState, ev: GameEvent[]): void {
  expireEffects(s, ev);
  const keep = [];
  for (const edit of s.boardEdits) {
    if (edit.lifetime !== 'permanent' && s.round >= edit.createdRound + edit.lifetime.rounds) {
      const { restored, dropped } = revertEdit(s.board, edit);
      ev.push(pub({ type: 'BoardEditExpired', editId: edit.id, restored, dropped }));
    } else {
      keep.push(edit);
    }
  }
  s.boardEdits = keep;
  ev.push(pub({ type: 'RoundEnded', round: s.round }));

  const winner = s.players.find((p) => p.position === s.board.size);
  if (winner) {
    const rankings = rankPlayers(s);
    s.phase = { kind: 'finished', winner: winner.id, rankings };
    s.windowId += 1;
    ev.push(pub({ type: 'MatchWon', winner: winner.id, rankings }));
    return;
  }
  startRound(s, ev);
}
