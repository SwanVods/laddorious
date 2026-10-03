import { describe, expect, it } from 'vitest';
import { hashState } from '../src/index';
import { playRandom } from './support/randomPlay';

/**
 * Golden matches: any change to rules, RNG use or event shape shows up as a
 * snapshot diff. Update snapshots (`vitest -u`) only for intentional changes.
 */
describe('golden matches', () => {
  it.each([
    ['golden-1', 2, [0, 3, 8, 13, 21]],
    ['golden-2', 3, [1, 4, 9, 16, 25, 36]],
    ['golden-3', 4, [2, 7, 1, 8, 2, 8, 1, 8]],
  ] as const)('%s (%i players)', (seed, players, choices) => {
    const run = playRandom(seed, players, [...choices]);
    const counts: Record<string, number> = {};
    for (const e of run.events) counts[e.type] = (counts[e.type] ?? 0) + 1;
    expect({
      rounds: run.state.round,
      winner: run.state.phase.kind === 'finished' ? run.state.phase.winner : null,
      steps: run.inputs.length,
      counts,
      hash: hashState(run.state),
    }).toMatchSnapshot();
  });
});
