import { generateBoard } from '../board/generate';
import { boardViolations } from '../board/invariants';
import type { Board } from '../board/types';
import { createStream } from '../rng/stream';
import { resolveConfig, type MatchConfigInput } from './config';
import { ConfigError } from './errors';
import { startRound } from './round';
import { clonePlain } from './util';
import type { GameEvent, MatchState, PlayerSeat } from './types';

const PLAYER_ID = /^[A-Za-z0-9_-]{1,32}$/;

/** Spec §4.1. Players start on tile 0 and round 1 opens its dice window. */
export function createMatch(input: MatchConfigInput, seats: PlayerSeat[], board?: Board): MatchState {
  const config = resolveConfig(input);
  if (seats.length < 2 || seats.length > 4) throw new ConfigError(`a match needs 2-4 players, got ${seats.length}`);
  const ids = new Set(seats.map((p) => p.id));
  if (ids.size !== seats.length) throw new ConfigError('player ids must be unique');
  // Ids key plain objects in the state, so names like "constructor" or "__proto__" would corrupt it.
  if (seats.some((p) => !PLAYER_ID.test(p.id) || p.id in Object.prototype)) {
    throw new ConfigError('player ids must be 1-32 chars of [A-Za-z0-9_-] and not an Object.prototype name');
  }
  const matchBoard = board ? clonePlain(board) : generateBoard(config.seed, config.board).board;
  const violations = boardViolations(matchBoard);
  if (violations.length > 0) throw new ConfigError(`invalid board: ${violations.join('; ')}`);

  const s: MatchState = {
    config,
    board: matchBoard,
    players: seats.map((p, seat) => ({ id: p.id, seat, position: 0 })),
    round: 0,
    windowId: 0,
    phase: { kind: 'dice', window: 'dice', seqs: {} },
    rng: {
      dice: seats.map((_, seat) => createStream(`${config.rngSeed}|dice|${seat}`)),
      cards: seats.map((_, seat) => createStream(`${config.rngSeed}|cards|${seat}`)),
      misc: createStream(`${config.rngSeed}|misc`),
    },
    effects: [],
    boardEdits: [],
    resolution: null,
    movedThisRound: [],
    lastTotals: {},
    counter: 0,
  };
  const ev: GameEvent[] = [];
  startRound(s, ev);
  return s;
}
