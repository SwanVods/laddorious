import type { Board, Rarity } from '../../src/index';

export function makeBoard(size: number, jumps: Array<[number, number]> = [], mystery: Record<number, Rarity> = {}): Board {
  return {
    size,
    jumps: jumps.map(([from, to], i) => ({ id: `t${i + 1}`, from, to })),
    mystery,
    seed: 'test',
    generatorVersion: 1,
  };
}
