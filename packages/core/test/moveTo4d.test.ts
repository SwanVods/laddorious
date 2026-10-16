import { describe, expect, it } from 'vitest';
import { describeCard, resolveConfig, type Board, type CatalogCard, type EffectOp, type GameEvent, type MatchState, type TargetRule } from '../src/index';
import { resolveGroup } from '../src/engine/resolve';
import { runSettle } from '../src/engine/settle';
import { makeBoard, ofType, positions, setup } from './support/fixtures';

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const LEADER: TargetRule = { condition: 'other', pick: 'leader', tieBreak: 'lowest-seat' };
const AHEAD: TargetRule = { condition: 'ahead-of-caster', pick: 'nearest', tieBreak: 'lowest-seat' };
const EVERYONE: TargetRule = { condition: 'everyone', pick: 'all', tieBreak: 'lowest-seat' };
const card = (id: string, target: TargetRule, effects: CatalogCard['effects']): CatalogCard => ({ id, name: id, type: 'misc', rarity: 'common', weight: 1, target, effects });
const fill = (id: string, rarity: CatalogCard['rarity']): CatalogCard => ({ ...card(id, SELF, [{ op: 'moveRelative', amount: 1 }]), rarity });
const to = (rule: string, extra: object = {}) => [{ op: 'moveTo', rule, ...extra } as EffectOp];
const CARDS = [
  card('pitfall', LEADER, to('nearest-snake-head')),
  card('back-ladder', SELF, to('ladder-foot-behind')),
  card('next-snake', SELF, to('snake-head-ahead')),
  card('catch-up', AHEAD, to('target', { offset: 0 })),
  card('overtake', AHEAD, to('target', { offset: 1 })),
  card('two-past', AHEAD, to('target', { offset: 2 })),
  card('to-50', EVERYONE, to('tile', { tile: 50 })),
  fill('r', 'rare'),
  fill('e', 'epic'),
];

function play(board: Board, at: number[], cardId: string): { s: MatchState; ev: GameEvent[] } {
  const s = setup({ players: at.length, board, positions: at, config: { cards: CARDS } });
  const ev: GameEvent[] = [];
  resolveGroup(s, ev, [{ caster: 'p1', cardId, target: null }]);
  return { s, ev };
}
const resolved = (ev: GameEvent[]) => ofType(ev, 'CardResolved')[0]!;

describe('moving to a place (2026-10-16)', () => {
  it('drops the leader onto the nearest snake, the one behind on a tie', () => {
    const board = makeBoard(100, [[30, 25], [50, 45]]);
    expect(positions(play(board, [10, 40], 'pitfall').s)).toEqual([10, 30]);
    expect(positions(play(board, [10, 47], 'pitfall').s)).toEqual([10, 50]);
  });

  it('fizzles when there is no snake', () => {
    const { s, ev } = play(makeBoard(100, [[12, 40]]), [10, 30], 'pitfall');
    expect(positions(s)).toEqual([10, 30]);
    expect(resolved(ev)).toMatchObject({ result: 'fizzled', reason: 'no-placement' });
  });

  it('goes back to the ladder behind, or on to the next snake', () => {
    const board = makeBoard(100, [[12, 40], [20, 60], [70, 55]]);
    expect(positions(play(board, [25, 0], 'back-ladder').s)[0]).toBe(20);
    expect(positions(play(board, [25, 0], 'next-snake').s)[0]).toBe(70);
  });

  it("moves the caster to the player ahead's tile, or past it, bounced at the end", () => {
    const board = makeBoard(100);
    expect(positions(play(board, [10, 20], 'catch-up').s)).toEqual([20, 20]);
    expect(positions(play(board, [10, 20], 'overtake').s)).toEqual([21, 20]);
    expect(positions(play(board, [10, 99], 'two-past').s)).toEqual([99, 99]);
  });

  it('sends everyone to one tile, into one face-off with all of them', () => {
    const { s, ev } = play(makeBoard(100), [10, 20, 30, 40], 'to-50');
    expect(positions(s)).toEqual([50, 50, 50, 50]);
    s.phase = { kind: 'settle', ctx: { movers: s.players.map((p) => ({ player: p.id, cause: 'card' as const })), wave: 0, challenges: [] }, after: 'resolveGroups' };
    expect(runSettle(s, ev)).toBe('waiting');
    expect(s.phase.kind === 'settle' && s.phase.ctx.challenges.map((c) => c.contesting.length)).toEqual([4]);
  });

  it('checks the tile and the offset', () => {
    const bad = (id: string, extra: object) => card(id, SELF, to(extra && 'tile' in extra ? 'tile' : 'target', extra));
    expect(() => resolveConfig({ seed: 's', cards: [...CARDS, bad('t0', { tile: 0 })] })).toThrow(/moveTo.tile must be a tile of 1 or more/);
    expect(() => resolveConfig({ seed: 's', cards: [...CARDS, bad('o', { offset: -1 })] })).toThrow(/moveTo.offset must be a whole number of 0 or more/);
  });

  it('writes the texts', () => {
    expect(describeCard(CARDS[0]!)).toBe('The leader drops onto the nearest snake.');
    const crossroads = card('x', SELF, [{ op: 'gamble', outcomes: [{ weight: 50, ops: to('ladder-foot-behind') }, { weight: 50, ops: to('snake-head-ahead') }] }]);
    expect(describeCard(crossroads)).toBe('50%: back to the ladder behind you. 50%: on to the next snake.');
    expect(describeCard(CARDS[3]!)).toBe('Move to the tile of the player just ahead of you.');
    expect(describeCard(CARDS[4]!)).toBe('Move to 1 tile ahead of the player just ahead of you.');
    expect(describeCard(card('t', EVERYONE, to('tile', { tile: 30 })))).toBe('Everyone moves to tile 30.');
  });
});
