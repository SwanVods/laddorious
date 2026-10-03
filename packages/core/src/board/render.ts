import { jumpKind, type Board } from './types';

const RARITY_MARK = { common: 'c', rare: 'r', epic: 'e' } as const;

/**
 * Serpentine grid, 10 tiles per row, highest row first (spec §7.4).
 * Marks: S snake head, L ladder foot, c/r/e Mystery rarity, . plain.
 */
export function renderBoardAscii(board: Board): string {
  const width = 10;
  const rows = Math.ceil(board.size / width);
  const lines: string[] = [];
  for (let row = rows - 1; row >= 0; row--) {
    const tiles: number[] = [];
    for (let col = 0; col < width; col++) {
      const t = row * width + col + 1;
      if (t <= board.size) tiles.push(t);
    }
    if (row % 2 === 1) tiles.reverse();
    lines.push(tiles.map((t) => `${String(t).padStart(3)}${mark(board, t)}`).join(' '));
  }
  const fmt = (kind: 'snake' | 'ladder') =>
    board.jumps
      .filter((j) => jumpKind(j) === kind)
      .sort((a, b) => a.from - b.from)
      .map((j) => `${j.from}→${j.to}`)
      .join(', ');
  lines.push('');
  lines.push(`Snakes:  ${fmt('snake')}`);
  lines.push(`Ladders: ${fmt('ladder')}`);
  lines.push(`Seed: ${board.seed} (generator v${board.generatorVersion})`);
  return lines.join('\n');
}

function mark(board: Board, tile: number): string {
  const j = board.jumps.find((x) => x.from === tile);
  if (j) return jumpKind(j) === 'snake' ? 'S' : 'L';
  const rarity = board.mystery[tile];
  return rarity ? RARITY_MARK[rarity] : '.';
}
