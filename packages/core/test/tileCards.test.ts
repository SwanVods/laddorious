import { describe, expect, it } from 'vitest';
import { blockedByBoard, type CatalogCard, type GameEvent, type MatchState, type TargetRule } from '../src/index';
import { startMysteryOrEndRound } from '../src/engine/mystery';
import { resolveGroup } from '../src/engine/resolve';
import { makeBoard, setup } from './support/fixtures';

// Cards that send players to a fixed tile (New Game+ to 29, Fair and Square to 50, Epic Battle! to 91) are out
// while a rocket or whirlpool starts on that tile (the user, 2026-10-16): everyone would land there and ride it.

const SELF: TargetRule = { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' };
const EVERYONE: TargetRule = { condition: 'everyone', pick: 'all', tieBreak: 'lowest-seat' };
const card = (id: string, rarity: CatalogCard['rarity'], effects: CatalogCard['effects'] = [{ op: 'moveRelative', amount: 1 }], target = SELF): CatalogCard => ({ id, name: id, type: 'misc', rarity, weight: 1, target, effects });
const toTile = card('to-29', 'epic', [{ op: 'moveTo', rule: 'tile', tile: 29 }], EVERYONE);
const cards = [toTile, card('e1', 'epic'), card('e2', 'epic'), card('e3', 'epic'), card('c', 'common'), card('r', 'rare')];

describe('cards that send players to a fixed tile (2026-10-16)', () => {
  it("are blocked while a rocket or whirlpool starts on their tile, not when one only ends there", () => {
    const s = setup({ players: 2, config: { cards } });
    expect(blockedByBoard(s.config.cards, makeBoard(100, [[29, 60]]))).toEqual(['to-29']);
    expect(blockedByBoard(s.config.cards, makeBoard(100, [[29, 10]]))).toEqual(['to-29']);
    expect(blockedByBoard(s.config.cards, makeBoard(100, [[10, 29], [60, 29]]))).toEqual([]);
    expect(blockedByBoard(s.config.cards, makeBoard(100, []))).toEqual([]);
  });

  it("aren't dealt while blocked", () => {
    const s = setup({ players: 2, positions: [3, 0], board: makeBoard(100, [[29, 60]], { 3: 'epic' }), config: { cards } });
    s.movedThisRound = ['p1'];
    startMysteryOrEndRound(s, []);
    expect(s.phase).toMatchObject({ kind: 'mysterySelect' });
    const offer = s.phase.kind === 'mysterySelect' ? s.phase.offers.p1! : null;
    expect([...offer!.cards].sort()).toEqual(['e1', 'e2', 'e3']);
  });

  it('fizzle if played while blocked, moving nobody', () => {
    const s = setup({ players: 2, positions: [10, 40], board: makeBoard(100, [[29, 60]]), config: { cards } });
    const ev: GameEvent[] = [];
    resolveGroup(s as MatchState, ev, [{ caster: 'p1', cardId: 'to-29', target: null }]);
    expect(ev.find((e) => e.type === 'CardResolved')).toMatchObject({ result: 'fizzled' });
    expect(s.players.map((p) => p.position)).toEqual([10, 40]);
  });
});
