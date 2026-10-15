import { CARD_CATALOG, type GameEvent } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { cardStats, simulateCards, type MatchRun } from '../src/index';

const pub = <T extends object>(e: T) => ({ ...e, visibility: 'public' as const }) as unknown as GameEvent;
const run = (events: GameEvent[]): MatchRun => ({ events } as unknown as MatchRun);

describe('per-card stats (2026-10-15)', () => {
  it('counts deals, picks, results, tiles and wins', () => {
    const events = [
      pub({ type: 'MysteryOffered', player: 'p1', tile: 5, rarity: 'common', cards: ['sprint', 'dash', 'moonwalk'] }),
      pub({ type: 'CardSelected', player: 'p1', cardId: 'sprint', cardType: 'movement', rarity: 'common', auto: false }),
      pub({ type: 'CardResolved', caster: 'p1', cardId: 'sprint', target: 'p1', result: 'hit' }),
      pub({ type: 'Moved', player: 'p1', from: 5, to: 8, cause: 'card', bounced: false }),
      pub({ type: 'RoundStarted', round: 2 }),
      pub({ type: 'MatchWon', winner: 'p1', rankings: [] }),
    ];
    const stats = cardStats([run(events)], 2);
    const sprint = stats.find((s) => s.cardId === 'sprint')!;
    expect(sprint).toMatchObject({ dealt: 1, picked: 1, resolved: 1, hit: 1, avgTiles: 3, playedBy: 1, wins: 1, winRate: 1, flag: null });
    expect(stats.find((s) => s.cardId === 'dash')).toMatchObject({ dealt: 1, picked: 0, playedBy: 0, winRate: 0 });
  });

  it('simulates matches with a catalogue that has drafts, without throwing', () => {
    const stats = simulateCards(CARD_CATALOG, { matches: 10, players: 4, seed: 'sim' });
    expect(stats.length).toBeGreaterThan(0);
    expect(stats.every((s) => CARD_CATALOG.cards.find((c) => c.id === s.cardId)?.status !== 'draft')).toBe(true);
  });
});
