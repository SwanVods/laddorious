import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createMatch, eventsFor, hashState, step, viewFor } from '../src/index';
import { playRandom } from './support/randomPlay';

const arbitraryMatch = fc.record({
  seed: fc.string({ minLength: 1, maxLength: 12 }),
  players: fc.integer({ min: 2, max: 4 }),
  choices: fc.array(fc.nat({ max: 10_000 }), { minLength: 1, maxLength: 64 }),
});

describe('engine properties (random legal play)', () => {
  it('always finishes with invariants intact (checked after every step)', () => {
    fc.assert(
      fc.property(arbitraryMatch, ({ seed, players, choices }) => {
        const run = playRandom(seed, players, choices);
        expect(run.state.phase.kind).toBe('finished');
      }),
      { numRuns: 40 },
    );
  });

  it('is deterministic and replays exactly from (config, seats, inputs)', () => {
    fc.assert(
      fc.property(arbitraryMatch, ({ seed, players, choices }) => {
        const a = playRandom(seed, players, choices);
        const b = playRandom(seed, players, choices);
        expect(hashState(b.state)).toBe(hashState(a.state));
        expect(JSON.stringify(b.events)).toBe(JSON.stringify(a.events));

        let s = createMatch({ seed }, Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}` })));
        for (const input of a.inputs) {
          const r = step(s, input);
          if (!r.ok) throw new Error(r.error.code);
          s = r.state;
        }
        expect(hashState(s)).toBe(hashState(a.state));
      }),
      { numRuns: 20 },
    );
  });

  it('never leaks one player\'s private events or hand to another', () => {
    fc.assert(
      fc.property(arbitraryMatch, ({ seed, players, choices }) => {
        const run = playRandom(seed, players, choices);
        for (let i = 1; i <= players; i++) {
          const me = `p${i}`;
          for (const e of eventsFor(run.events, me)) {
            if (e.visibility !== 'public') expect(e.visibility.private).toBe(me);
          }
        }
        const view = viewFor(run.state, 'p1');
        expect(view.myOffer === null || view.myOffer.player === 'p1').toBe(true);
      }),
      { numRuns: 20 },
    );
  });
});
