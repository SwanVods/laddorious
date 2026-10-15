import { catalogConfig, type CardCatalog, type GameEvent, type PlayerSeat } from '@laddorious/core';
import { makeBots } from '@laddorious/bots';
import { runMatch, type MatchRun } from './runner';

// How each card does in bot matches (2026-10-15), for the card editor's Simulate. Bots pick cards at random,
// so the numbers measure the cards, not a bot's taste.

export interface CardStat {
  cardId: string;
  dealt: number;
  picked: number;
  resolved: number;
  hit: number;
  blocked: number;
  fizzled: number;
  avgTiles: number;
  playedBy: number;
  wins: number;
  winRate: number;
  flag: 'strong' | 'weak' | 'fizzles' | null;
}

const MIN_SAMPLE = 30;

export function cardStats(runs: readonly MatchRun[], players: number): CardStat[] {
  const stats = new Map<string, CardStat & { tiles: number }>();
  const of = (id: string) => {
    let s = stats.get(id);
    if (!s) stats.set(id, (s = { cardId: id, dealt: 0, picked: 0, resolved: 0, hit: 0, blocked: 0, fizzled: 0, avgTiles: 0, playedBy: 0, wins: 0, winRate: 0, flag: null, tiles: 0 }));
    return s;
  };
  for (const run of runs) {
    const players = new Map<string, Set<string>>();
    let open: { stat: CardStat & { tiles: number }; caster: string; targets: Set<string> } | null = null;
    let winner: string | null = null;
    for (const e of run.events as GameEvent[]) {
      switch (e.type) {
        case 'MysteryOffered':
          for (const id of e.cards) of(id).dealt++;
          break;
        case 'CardRerolled':
          of(e.to).dealt++;
          break;
        case 'CardSelected': {
          of(e.cardId).picked++;
          const set = players.get(e.cardId) ?? new Set<string>();
          set.add(e.player);
          players.set(e.cardId, set);
          break;
        }
        case 'CardResolved': {
          const s = of(e.cardId);
          s.resolved++;
          s[e.result]++;
          // Every player the card hit (2026-10-15: a card can hit several): the caster's own steps count up, others' down.
          open = { stat: s, caster: e.caster, targets: new Set(e.targets ?? (e.target ? [e.target] : [])) };
          break;
        }
        case 'Moved':
          if (open?.targets.has(e.player)) open.stat.tiles += (e.to - e.from) * (e.player === open.caster ? 1 : -1);
          break;
        case 'RoundStarted':
          open = null;
          break;
        case 'MatchWon':
          winner = e.winner;
          break;
      }
    }
    for (const [id, who] of players) {
      const s = of(id);
      s.playedBy += who.size;
      if (winner && who.has(winner)) s.wins++;
    }
  }
  return [...stats.values()]
    .map(({ tiles, ...s }) => {
      const winRate = s.playedBy > 0 ? s.wins / s.playedBy : 0;
      const flag =
        s.playedBy >= MIN_SAMPLE && winRate > 1.5 / players ? 'strong'
        : s.playedBy >= MIN_SAMPLE && winRate < 0.6 / players ? 'weak'
        : s.resolved >= MIN_SAMPLE && s.fizzled / s.resolved > 0.3 ? 'fizzles'
        : null;
      return { ...s, avgTiles: s.resolved > 0 ? Math.round((tiles / s.resolved) * 10) / 10 : 0, winRate: Math.round(winRate * 1000) / 1000, flag } satisfies CardStat;
    })
    .sort((a, b) => b.winRate - a.winRate);
}

export function simulateCards(catalog: CardCatalog, opts: { matches: number; players: number; seed: string; onProgress?: (done: number) => void }): CardStat[] {
  const seats: PlayerSeat[] = Array.from({ length: opts.players }, (_, i) => ({ id: `p${i + 1}` }));
  const runs: MatchRun[] = [];
  for (let i = 0; i < opts.matches; i++) {
    const seed = `${opts.seed}-${i}`;
    runs.push(runMatch({ seed, checkInvariants: false, ...catalogConfig(catalog) }, seats, makeBots(seats, 'random', seed, 0)));
    opts.onProgress?.(i + 1);
  }
  return cardStats(runs, opts.players);
}
