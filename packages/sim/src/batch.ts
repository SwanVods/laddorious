import { generateBoard, resolveConfig, type GenerationReport, type MatchConfigInput, type PlayerSeat } from '@laddorious/core';
import { makeBots, type PolicyName } from './bots';
import { aggregate, matchMetrics, type BatchReport, type MatchMetrics } from './metrics';
import { runMatch, type MatchLog } from './runner';

export interface BatchOptions {
  matches: number;
  players: number;
  policy: PolicyName;
  baseSeed: string;
  afkPercent: number;
  /** Extra config applied to every match (seed is derived per match). */
  config?: Omit<MatchConfigInput, 'seed'>;
}

export interface BatchResult {
  report: BatchReport;
  metrics: MatchMetrics[];
  generation: GenerationReport[];
  firstLog: MatchLog | null;
}

/** Run a reproducible batch: match i uses seed `${baseSeed}-${i}` (spec §8.2). */
export function runBatch(opts: BatchOptions): BatchResult {
  const seats: PlayerSeat[] = Array.from({ length: opts.players }, (_, i) => ({ id: `p${i + 1}` }));
  const metrics: MatchMetrics[] = [];
  const generation: GenerationReport[] = [];
  let firstLog: MatchLog | null = null;
  for (let i = 0; i < opts.matches; i++) {
    const seed = `${opts.baseSeed}-${i}`;
    const config: MatchConfigInput = { checkInvariants: false, ...opts.config, seed };
    // Generate the board here (the same board createMatch would build) so its report is kept.
    const { board, report } = generateBoard(seed, resolveConfig(config).board);
    generation.push(report);
    const run = runMatch(config, seats, makeBots(seats, opts.policy, seed, opts.afkPercent), { board });
    if (i === 0) firstLog = run.log;
    metrics.push(matchMetrics(run));
  }
  return { report: aggregate(metrics, opts.players, generation), metrics, generation, firstLog };
}
