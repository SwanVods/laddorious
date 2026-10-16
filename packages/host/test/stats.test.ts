import type { ActiveEffect, GameEvent } from '@laddorious/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchHost } from '../src/matchHost';
import { StatsTally, type MatchStats, type StatsContext } from '../src/stats';
import type { Seat } from '../src/types';

// Match stats (the user, 2026-10-17): every match, online and offline, for real players only, never bots.

const SEATS: Seat[] = [
  { playerId: 'p0', nickname: 'Ari', piece: 'duck', bot: false },
  { playerId: 'p1', nickname: 'Bea', piece: 'rook', bot: false },
  { playerId: 'p2', nickname: 'Mochi', piece: 'pawn', bot: true },
  { playerId: 'p3', nickname: 'Pip', piece: 'meeple', bot: true },
];
const CTX: StatsContext = { mode: 'room', version: '0.2.0', seed: 'board-1', keys: { p0: 'key-ari', p1: 'key-bea' } };
const pub = <E extends object>(e: E) => ({ ...e, visibility: 'public' as const }) as unknown as GameEvent;
const priv = <E extends object>(e: E, to: string) => ({ ...e, visibility: { private: to } }) as unknown as GameEvent;
const moved = (player: string, from: number, to: number, cause: string) => pub({ type: 'Moved', player, from, to, cause, bounced: false });

function tally(events: GameEvent[], ctx = CTX, nowMs = 0): StatsTally {
  let now = nowMs;
  const t = new StatsTally(SEATS, { ...ctx, now: () => now });
  t.add(events);
  now += 95_000;
  return t;
}

describe('the stats tally (2026-10-17)', () => {
  it('records the match: mode, version, seed, rounds, duration, who sat, and whether a real player won', () => {
    const stats = tally([pub({ type: 'RoundEnded', round: 1 }), pub({ type: 'RoundEnded', round: 2 }), pub({ type: 'MatchWon', winner: 'p1', rankings: [] })]).result('finished');
    expect(stats.match).toEqual({ mode: 'room', status: 'finished', version: '0.2.0', seed: 'board-1', rounds: 3, durationMs: 95_000, humans: 2, bots: 2, humanWon: true });
  });

  it('keeps a row for each real player, and none for the bots', () => {
    const events = [
      moved('p0', 0, 12, 'dice'),
      moved('p0', 12, 40, 'ladder'),
      moved('p1', 0, 30, 'snake'),
      moved('p2', 0, 9, 'ladder'),
      pub({ type: 'SnakeBlocked', player: 'p1', tile: 30, effectId: 'e1' }),
      pub({ type: 'ChallengeResolved', challengeId: 'c1', pickRound: 1, picks: {}, winner: 'p0', losers: ['p1'], outcome: 'win' }),
      pub({ type: 'ChallengeResolved', challengeId: 'c2', pickRound: 1, picks: {}, winner: null, losers: [], outcome: 'replay' }),
      pub({ type: 'MatchWon', winner: 'p0', rankings: [{ player: 'p0', rank: 1, position: 100 }, { player: 'p2', rank: 2, position: 9 }, { player: 'p1', rank: 3, position: 30 }] }),
    ];
    const stats = tally(events).result('finished', ['p1']);
    expect(stats.players).toEqual([
      { playerKey: 'key-ari', nickname: 'Ari', piece: 'duck', place: 1, tile: 40, rockets: 1, whirlpools: 0, dodged: 0, faceOffsWon: 1, faceOffsLost: 0, cardsPicked: 0, leftEarly: false },
      { playerKey: 'key-bea', nickname: 'Bea', piece: 'rook', place: 3, tile: 30, rockets: 0, whirlpools: 1, dodged: 1, faceOffsWon: 0, faceOffsLost: 1, cardsPicked: 0, leftEarly: true },
    ]);
    expect(stats.match.humanWon).toBe(true);
  });

  it("records every card a real player was shown, which one they picked, and how it played; a bot's cards are left out", () => {
    const events = [
      priv({ type: 'MysteryOffered', player: 'p0', tile: 9, rarity: 'rare', cards: ['shield', 'sprint', 'shove'] }, 'p0'),
      priv({ type: 'MysteryOffered', player: 'p2', tile: 7, rarity: 'common', cards: ['sprint', 'shove', 'moonwalk'] }, 'p2'),
      priv({ type: 'CardRerolled', player: 'p0', slot: 1, from: 'sprint', to: 'jackpot' }, 'p0'),
      pub({ type: 'CardSelected', player: 'p0', cardId: 'jackpot', cardType: 'risky', rarity: 'rare', auto: false }),
      pub({ type: 'CardSelected', player: 'p2', cardId: 'shove', cardType: 'attack', rarity: 'common', auto: false }),
      pub({ type: 'CardResolved', caster: 'p2', cardId: 'shove', target: 'p0', result: 'hit' }),
      pub({ type: 'CardResolved', caster: 'p0', cardId: 'jackpot', target: 'p0', result: 'fizzled' }),
      pub({ type: 'RoundEnded', round: 1 }),
      priv({ type: 'MysteryOffered', player: 'p1', tile: 20, rarity: 'epic', cards: ['earthquake', 'aegis', 'undertow'] }, 'p1'),
      pub({ type: 'CardSelected', player: 'p1', cardId: 'aegis', cardType: 'defense', rarity: 'epic', auto: true }),
    ];
    const stats = tally(events).result('abandoned');
    const row = (cardId: string, round: number, rarity: string, picked = false, auto = false, result: string | null = null) => ({ playerKey: expect.any(String), cardId, rarity, round, picked, auto, result, pickerWon: false });
    expect(stats.cards).toEqual([
      row('shield', 1, 'rare'),
      row('sprint', 1, 'rare'),
      row('shove', 1, 'rare'),
      row('jackpot', 1, 'rare', true, false, 'fizzled'),
      row('earthquake', 2, 'epic'),
      row('aegis', 2, 'epic', true, true),
      row('undertow', 2, 'epic'),
    ]);
    expect(stats.cards.filter((c) => c.picked).map((c) => c.playerKey)).toEqual(['key-ari', 'key-bea']);
    expect(stats.players.map((p) => p.cardsPicked)).toEqual([1, 1]);
    expect(stats.match).toMatchObject({ status: 'abandoned', rounds: 2, humanWon: null });
  });

  it("marks the winner's picked cards, so a card's win rate can be read", () => {
    const events = [
      priv({ type: 'MysteryOffered', player: 'p1', tile: 9, rarity: 'common', cards: ['sprint', 'shove', 'moonwalk'] }, 'p1'),
      pub({ type: 'CardSelected', player: 'p1', cardId: 'sprint', cardType: 'movement', rarity: 'common', auto: false }),
      pub({ type: 'CardResolved', caster: 'p1', cardId: 'sprint', target: 'p1', result: 'hit' }),
      pub({ type: 'MatchWon', winner: 'p1', rankings: [{ player: 'p1', rank: 1, position: 100 }] }),
    ];
    const stats = tally(events).result('finished');
    expect(stats.cards.find((c) => c.picked)).toMatchObject({ cardId: 'sprint', result: 'hit', pickerWon: true });
    expect(stats.cards.filter((c) => !c.picked).every((c) => !c.pickerWon)).toBe(true);
  });

  it('says no real player won when a bot did', () => {
    expect(tally([pub({ type: 'MatchWon', winner: 'p3', rankings: [] })]).result('finished').match.humanWon).toBe(false);
  });

  it('counts a shield effect as nothing of its own: only events above count', () => {
    const effect: ActiveEffect = { id: 'e', owner: 'p0', sourceCard: 'shield', sourcePlayer: 'p0', params: { hook: 'beforeAttack' }, lifetime: { charges: 1 }, createdRound: 1, seq: 1 };
    const stats = tally([pub({ type: 'EffectAdded', effect })]).result('finished');
    expect(stats.players[0]).toMatchObject({ rockets: 0, whirlpools: 0, dodged: 0, cardsPicked: 0 });
  });
});

describe('the match host reports its stats (2026-10-17)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it('reports a match nobody finished once, as abandoned, when it stops', () => {
    const reports: MatchStats[] = [];
    const host = new MatchHost({ send: () => {}, stats: { ...CTX, onStats: (s) => reports.push(s) } });
    host.create(SEATS, 'board-1', 'secret');
    host.stop();
    host.stop();
    expect(reports).toHaveLength(1);
    expect(reports[0]!.match).toMatchObject({ status: 'abandoned', mode: 'room', humans: 2, bots: 2 });
    expect(reports[0]!.players.map((p) => p.playerKey)).toEqual(['key-ari', 'key-bea']);
  });

  it('reports nothing without a stats context (e2e fast matches, tests)', () => {
    const host = new MatchHost({ send: () => {} });
    host.create(SEATS, 'board-1', 'secret');
    expect(() => host.stop()).not.toThrow();
  });

  it('reports a finished match once, when it is won', () => {
    const reports: MatchStats[] = [];
    // Every seat a bot-played human: the host's fast mode plays them all, so the match runs to its end.
    const host = new MatchHost({ send: () => {}, fast: true, stats: { ...CTX, onStats: (s) => reports.push(s) } });
    host.create(SEATS, 'board-1', 'secret');
    for (let i = 0; i < 4000 && reports.length === 0; i++) vi.advanceTimersByTime(1000);
    host.stop();
    expect(reports).toHaveLength(1);
    expect(reports[0]!.match.status).toBe('finished');
    expect(reports[0]!.players.filter((p) => p.place === 1).length + (reports[0]!.match.humanWon ? 0 : 1)).toBe(1);
  });
});
