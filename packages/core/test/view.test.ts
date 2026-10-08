import { describe, expect, it } from 'vitest';
import { createMatch, eventsFor, viewFor } from '../src/index';
import { choose, makeBoard, offerValues, pick, play, roll, setup } from './support/fixtures';

const board = makeBoard(100, [], { 4: 'common', 6: 'common' });

describe('viewFor', () => {
  it('shows a player only their own Mystery hand', () => {
    const { state, events } = play(
      setup({ players: 3, board, dice: [[4], [6], [1]], cards: [offerValues('sprint', 'shove', 'coin-flip'), offerValues('cleanse', 'steady-hand', 'snake-charm')] }),
      [roll('p1'), roll('p2'), roll('p3')],
    );
    const v1 = viewFor(state, 'p1');
    const v3 = viewFor(state, 'p3');
    expect(v1.myOffer?.cards).toEqual(['sprint', 'shove', 'coin-flip']);
    expect(v3.myOffer).toBeNull();
    expect(JSON.stringify(v1)).not.toContain('cleanse');
    expect(JSON.stringify(v3)).not.toContain('sprint');
    expect(v1.phase).toEqual({ kind: 'mysterySelect', picked: { p1: false, p2: false } });
    expect(eventsFor(events, 'p3').some((e) => e.type === 'MysteryOffered')).toBe(false);
    expect(eventsFor(events, 'p1').filter((e) => e.type === 'MysteryOffered')).toHaveLength(1);
  });

  it('hides challenge picks until the round resolves', () => {
    const s = play(setup({ dice: [[5], [5]] }), [roll('p1'), roll('p2'), choose('p1', 'rock')]).state;
    const v2 = viewFor(s, 'p2');
    expect(v2.phase.kind === 'settle' && v2.phase.challenges[0]!.picked).toEqual(['p1']);
    expect(JSON.stringify(v2)).not.toContain('rock');
    expect(viewFor(s, 'p1').myPicks).toEqual({ c1: 'rock' });
  });

  it('never reveals the seed that drives dice, hands and gambles (review C1)', () => {
    const s = createMatch({ seed: 'server-secret-8f3a' }, [{ id: 'p1' }, { id: 'p2' }]);
    for (const me of ['p1', 'p2']) expect(JSON.stringify(viewFor(s, me))).not.toContain('server-secret-8f3a');
  });

  it('never exposes locked card targets or the resolution queue', () => {
    const { state } = play(
      setup({ players: 3, board, dice: [[4], [6], [1]], cards: [offerValues('shove', 'sprint', 'coin-flip'), offerValues('cleanse', 'steady-hand', 'snake-charm')] }),
      [roll('p1'), roll('p2'), roll('p3'), pick('p1', 0)],
    );
    const view = viewFor(state, 'p1') as unknown as Record<string, unknown>;
    expect('resolution' in view).toBe(false);
    expect('rng' in view).toBe(false);
  });
});
