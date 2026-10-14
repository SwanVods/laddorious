import { createStream, intBetween, pickWeighted, type RngStream } from '../rng/stream';
import { analyzeBoard, type BoardAnalysis } from './analysis';
import type { BoardConfig } from './config';
import { boardViolations } from './invariants';
import { laneCenterline, lanesTouch, type LanePoint } from './layout';
import { RARITIES, jumpKind, jumpLength, type Board, type Jump, type Rarity } from './types';

export type RejectionReason =
  | 'placement'
  | 'mystery-placement'
  | 'invariant'
  | 'chain'
  | 'length'
  | 'count'
  | 'finish-zone'
  | 'snake-run'
  | 'lane-crossing'
  | 'mystery-spacing'
  | 'analysis-median'
  | 'analysis-tail';

export interface GenerationReport {
  attempts: number;
  rejections: Partial<Record<RejectionReason, number>>;
  analysis: { median4p: number; median2p: number; tail2p: number };
}

export class GenerationError extends Error {
  constructor(
    readonly seed: string,
    readonly config: BoardConfig,
    readonly rejections: Partial<Record<RejectionReason, number>>,
  ) {
    super(`board generation failed for seed "${seed}" after ${config.maxAttempts} attempts: ${JSON.stringify(rejections)}`);
    this.name = 'GenerationError';
  }
}

export function boardStreamLabel(seed: string, generatorVersion: number): string {
  return `${seed}|board|v${generatorVersion}`;
}

/** Spec §7.2. Deterministic in (seed, cfg). */
export function generateBoard(seed: string, cfg: BoardConfig): { board: Board; report: GenerationReport } {
  const rng = createStream(boardStreamLabel(seed, cfg.generatorVersion));
  const rejections: Partial<Record<RejectionReason, number>> = {};
  const reject = (r: RejectionReason) => {
    rejections[r] = (rejections[r] ?? 0) + 1;
  };

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    const candidate = drawCandidate(seed, cfg, rng);
    if (typeof candidate === 'string') {
      reject(candidate);
      continue;
    }
    const structural = structuralViolations(candidate, cfg);
    if (structural.length > 0) {
      reject(structural[0]!);
      continue;
    }
    const analysis = analyzeBoard(candidate);
    const verdict = analyticVerdict(analysis, cfg);
    if (verdict !== null) {
      reject(verdict);
      continue;
    }
    return {
      board: candidate,
      report: {
        attempts: attempt,
        rejections,
        analysis: {
          median4p: analysis.medianFirstFinish[4],
          median2p: analysis.medianFirstFinish[2],
          tail2p: analysis.tailAfter(2, cfg.analysis.maxRounds2p),
        },
      },
    };
  }
  throw new GenerationError(seed, cfg, rejections);
}

export function analyticVerdict(analysis: BoardAnalysis, cfg: BoardConfig): RejectionReason | null {
  const [lo, hi] = cfg.analysis.median4pRounds;
  const m = analysis.medianFirstFinish[4];
  if (!(m >= lo && m <= hi)) return 'analysis-median';
  if (analysis.tailAfter(2, cfg.analysis.maxRounds2p) >= cfg.analysis.maxTailProbability) return 'analysis-tail';
  return null;
}

function drawCandidate(seed: string, cfg: BoardConfig, rng: RngStream): Board | RejectionReason {
  const N = cfg.size;
  const jumps: Jump[] = [];
  const starts = new Set<number>();
  const ends = new Set<number>();
  let finishZoneSnakes = 0;
  const zoneStart = N - cfg.finishZone.tiles;
  /** Placed snakes' lanes: a new snake must keep clear of every one (polish spec 3.4). */
  const lanes: LanePoint[][] = [];

  const kinds: Array<'snake' | 'ladder'> = [
    ...Array<'snake'>(intBetween(rng, cfg.snakes.count[0], cfg.snakes.count[1])).fill('snake'),
    ...Array<'ladder'>(intBetween(rng, cfg.ladders.count[0], cfg.ladders.count[1])).fill('ladder'),
  ];

  for (const kind of kinds) {
    const range = kind === 'snake' ? cfg.snakes.length : cfg.ladders.length;
    let placed = false;
    for (let tries = 0; tries < 50 && !placed; tries++) {
      const len = intBetween(rng, range[0], range[1]);
      let from: number;
      let to: number;
      if (kind === 'snake') {
        if (len + 1 > N - 1) continue;
        from = intBetween(rng, len + 1, N - 1);
        to = from - len;
      } else {
        if (N - 1 - len < 1) continue;
        from = intBetween(rng, 1, N - 1 - len);
        to = from + len;
      }
      if (starts.has(from) || ends.has(from) || starts.has(to) || ends.has(to)) continue; // one jump end per tile (2026-10-15), so no chains
      const inZone = kind === 'snake' && from >= zoneStart;
      if (inZone && (finishZoneSnakes >= cfg.finishZone.maxSnakes || len > cfg.finishZone.maxSnakeLength)) continue;
      if (kind === 'snake' && wouldExceedSnakeRun(jumps, from, cfg.maxConsecutiveSnakeHeads)) continue;
      if (kind === 'snake') {
        const lane = laneCenterline(from, to);
        if (lanes.some((placed) => lanesTouch(placed, lane))) continue;
        lanes.push(lane);
      }
      jumps.push({ id: `j${jumps.length + 1}`, from, to });
      starts.add(from);
      ends.add(to);
      if (inZone) finishZoneSnakes++;
      placed = true;
    }
    if (!placed) return 'placement';
  }

  // Mystery tiles: stratified — one per equal segment of 1..N-1, never on a jump start.
  const mystery: Record<number, Rarity> = {};
  const count = Math.round(N * cfg.mysteryDensity);
  const rarityWeights = RARITIES.map((r) => cfg.mysteryRarityWeights[r]);
  for (let i = 0; i < count; i++) {
    const segStart = 1 + Math.floor((i * (N - 1)) / count);
    const segEnd = Math.floor(((i + 1) * (N - 1)) / count);
    const options: number[] = [];
    for (let t = segStart; t <= segEnd; t++) if (!starts.has(t)) options.push(t);
    if (options.length === 0) return 'mystery-placement';
    const tile = options[intBetween(rng, 0, options.length - 1)]!;
    mystery[tile] = RARITIES[pickWeighted(rng, rarityWeights)]!;
  }

  return { size: N, jumps, mystery, seed, generatorVersion: cfg.generatorVersion };
}

function wouldExceedSnakeRun(jumps: Jump[], from: number, maxRun: number): boolean {
  const heads = new Set(jumps.filter((j) => j.to < j.from).map((j) => j.from));
  heads.add(from);
  let run = 1;
  for (let t = from - 1; heads.has(t); t--) run++;
  for (let t = from + 1; heads.has(t); t++) run++;
  return run > maxRun;
}

/** Generator-only rules on top of the hard invariants (spec §7.2 step 2). First entry is the primary reason. */
export function structuralViolations(board: Board, cfg: BoardConfig): RejectionReason[] {
  const out: RejectionReason[] = [];
  const N = board.size;
  if (boardViolations(board).length > 0) out.push('invariant');

  const starts = new Set(board.jumps.map((j) => j.from));
  if (board.jumps.some((j) => starts.has(j.to))) out.push('chain');

  const snakes = board.jumps.filter((j) => jumpKind(j) === 'snake');
  const ladders = board.jumps.filter((j) => jumpKind(j) === 'ladder');
  const inRange = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;
  if (!inRange(snakes.length, cfg.snakes.count) || !inRange(ladders.length, cfg.ladders.count)) out.push('count');
  if (
    snakes.some((j) => !inRange(jumpLength(j), cfg.snakes.length)) ||
    ladders.some((j) => !inRange(jumpLength(j), cfg.ladders.length))
  ) {
    out.push('length');
  }

  const zoneSnakes = snakes.filter((j) => j.from >= N - cfg.finishZone.tiles);
  if (
    zoneSnakes.length > cfg.finishZone.maxSnakes ||
    zoneSnakes.some((j) => jumpLength(j) > cfg.finishZone.maxSnakeLength)
  ) {
    out.push('finish-zone');
  }

  const lanes = snakes.map((j) => laneCenterline(j.from, j.to));
  if (lanes.some((a, i) => lanes.slice(i + 1).some((b) => lanesTouch(a, b)))) out.push('lane-crossing');

  const heads = new Set(snakes.map((j) => j.from));
  let run = 0;
  for (let t = 1; t < N; t++) {
    run = heads.has(t) ? run + 1 : 0;
    if (run > cfg.maxConsecutiveSnakeHeads) {
      out.push('snake-run');
      break;
    }
  }

  const tiles = Object.keys(board.mystery).map(Number).sort((a, b) => a - b);
  const { maxPerWindow, window, maxGap } = cfg.mysterySpacing;
  let spacingBad = false;
  for (let start = 1; start + window - 1 <= N - 1; start++) {
    const inWindow = tiles.filter((t) => t >= start && t < start + window).length;
    if (inWindow > maxPerWindow) spacingBad = true;
  }
  const marks = [0, ...tiles, N];
  for (let i = 1; i < marks.length; i++) if (marks[i]! - marks[i - 1]! > maxGap) spacingBad = true;
  if (spacingBad) out.push('mystery-spacing');

  return out;
}
