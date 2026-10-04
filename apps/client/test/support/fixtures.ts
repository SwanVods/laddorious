import type { SeatInfo } from '../../src/service/matchService';

/** The table a "Play with bots" match makes when you chose the knight. */
export const SEATS: SeatInfo[] = [
  { playerId: 'p0', nickname: 'You', piece: 'knight', color: '#ff5470', bot: false },
  { playerId: 'p1', nickname: 'Mochi', piece: 'pawn', color: '#3b82f6', bot: true },
  { playerId: 'p2', nickname: 'Pip', piece: 'meeple', color: '#a3e635', bot: true },
  { playerId: 'p3', nickname: 'Juno', piece: 'dragon', color: '#8b5cf6', bot: true },
];
