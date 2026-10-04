import { useStore } from 'zustand';
import type { Director } from '../director/director';
import { stackOn, type PresentationState } from '../director/presentation';
import type { SeatInfo } from '../service/matchService';
import { BOARD_COLORS } from './theme';

/** SVG units per tile: a serpentine 10×10 board with a start row under it. */
const TILE = 100;
const COLUMNS = 10;

/** Centre of a tile: tile 1 bottom left, rows alternating direction. Tile 0 is the start row, one spot per seat. */
function tileCenter(tile: number, seat: number): { x: number; y: number } {
  if (tile === 0) return { x: TILE * (seat + 0.5), y: TILE * 10.5 };
  const row = Math.floor((tile - 1) / COLUMNS);
  const along = (tile - 1) % COLUMNS;
  const col = row % 2 === 0 ? along : COLUMNS - 1 - along;
  return { x: TILE * (col + 0.5), y: TILE * (COLUMNS - 1 - row + 0.5) };
}

/** A piece's offset on its tile: stacked with later arrivals on top, or side by side in a face-off. */
function pieceOffset(state: PresentationState, playerId: string): { dx: number; dy: number } {
  const tile = state.positions[playerId] ?? 0;
  if (tile === 0) return { dx: 0, dy: 0 };
  const faceOff = state.faceOffs.find((f) => f.tile === tile && f.players.includes(playerId));
  if (faceOff) return { dx: (faceOff.players.indexOf(playerId) - (faceOff.players.length - 1) / 2) * 44, dy: 0 };
  const level = stackOn(state, tile).indexOf(playerId);
  return { dx: level * 14, dy: -level * 14 };
}

/**
 * The dev page's flat board (Phase 3): tiles, slides, ladders, and the pieces gliding
 * through each beat. The 3D scene replaces it in Phase 4.
 */
export function DevBoard({ director, seats }: { director: Director; seats: SeatInfo[] }) {
  const presentation = useStore(director.store, (s) => s.presentation);
  const beat = useStore(director.store, (s) => s.beat);
  const board = useStore(director.store, (s) => s.settled?.view.board);
  if (!presentation || !board) return null;
  // During a beat, pieces glide to where it leaves them, over its length.
  const target = beat?.after ?? presentation;
  const glide = `transform ${beat?.durationMs ?? 0}ms ease-in-out`;
  return (
    <svg className="board" viewBox="0 0 1000 1100" role="img" aria-label={`Board, round ${presentation.round}`}>
      {Array.from({ length: board.size }, (_, i) => i + 1).map((tile) => {
        const { x, y } = tileCenter(tile, 0);
        const rarity = board.mystery[tile];
        const diagonal = (Math.floor(x / TILE) + Math.floor(y / TILE)) % BOARD_COLORS.squares.length;
        const fill = tile === board.size ? BOARD_COLORS.goal : rarity ? BOARD_COLORS.mystery : BOARD_COLORS.squares[diagonal];
        return (
          <g key={tile}>
            <rect x={x - TILE / 2} y={y - TILE / 2} width={TILE} height={TILE} fill={fill} />
            <text x={x - 42} y={y - 22} className="tile-number">
              {tile}
            </text>
            {rarity && (
              <text x={x} y={y + 22} className="tile-mystery" fill={BOARD_COLORS.rarity[rarity]}>
                ?
              </text>
            )}
          </g>
        );
      })}
      {target.jumps.map((jump) => {
        const a = tileCenter(jump.from, 0);
        const b = tileCenter(jump.to, 0);
        return jump.to < jump.from ? (
          <line key={jump.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="snake" stroke={BOARD_COLORS.slide} />
        ) : (
          <line key={jump.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="ladder" />
        );
      })}
      {seats.map((seat, i) => {
        const { x, y } = tileCenter(target.positions[seat.playerId] ?? 0, i);
        const { dx, dy } = pieceOffset(target, seat.playerId);
        return (
          <g
            key={seat.playerId}
            role="img"
            aria-label={`${seat.nickname} on tile ${presentation.positions[seat.playerId] ?? 0}`}
            style={{ transform: `translate(${x + dx}px, ${y + dy}px)`, transition: glide }}
          >
            <circle r={26} fill={seat.color} className="piece" />
          </g>
        );
      })}
    </svg>
  );
}
