import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DEFAULT_BOARD_CONFIG, generateBoard, renderBoardAscii } from '@laddorious/core';
import { runBatch } from './batch';
import type { PolicyName } from '@laddorious/bots';
import { formatReport } from './metrics';
import { replayLog, type MatchLog } from './runner';

const USAGE = `Usage:
  sim run [--matches 1000] [--players 4] [--policy heuristic|random] [--seed base] [--afk 0] [--out report.json] [--log match0.json]
  sim board --seed X
  sim replay <log.json>`;

export function main(argv: string[]): number {
  const [command, ...rest] = argv;
  switch (command) {
    case 'run': {
      const { values } = parseArgs({
        args: rest,
        options: {
          matches: { type: 'string', default: '1000' },
          players: { type: 'string', default: '4' },
          policy: { type: 'string', default: 'heuristic' },
          seed: { type: 'string', default: 'base' },
          afk: { type: 'string', default: '0' },
          out: { type: 'string' },
          log: { type: 'string' },
        },
      });
      const policy = values.policy as PolicyName;
      if (policy !== 'heuristic' && policy !== 'random') throw new Error(`unknown policy ${values.policy}`);
      const started = Date.now();
      const { report, firstLog } = runBatch({
        matches: Number(values.matches),
        players: Number(values.players),
        policy,
        baseSeed: values.seed!,
        afkPercent: Number(values.afk),
      });
      console.log(formatReport(report));
      console.log(`Elapsed:              ${((Date.now() - started) / 1000).toFixed(1)} s`);
      if (values.out) writeFileSync(values.out, JSON.stringify(report, null, 2));
      if (values.log && firstLog) writeFileSync(values.log, JSON.stringify(firstLog));
      return 0;
    }
    case 'board': {
      const { values } = parseArgs({ args: rest, options: { seed: { type: 'string' } } });
      if (!values.seed) throw new Error('board needs --seed');
      const { board, report } = generateBoard(values.seed, DEFAULT_BOARD_CONFIG);
      console.log(renderBoardAscii(board));
      console.log(`Attempts: ${report.attempts}  Rejections: ${JSON.stringify(report.rejections)}`);
      console.log(
        `Median first finish: 4p ${report.analysis.median4p} rounds, 2p ${report.analysis.median2p} rounds; P(2p > ${DEFAULT_BOARD_CONFIG.analysis.maxRounds2p} rounds) = ${(report.analysis.tail2p * 100).toFixed(2)}%`,
      );
      return 0;
    }
    case 'replay': {
      const file = rest[0];
      if (!file) throw new Error('replay needs a log file');
      const log = JSON.parse(readFileSync(file, 'utf8')) as MatchLog;
      let result: ReturnType<typeof replayLog>;
      try {
        result = replayLog(log);
      } catch (e) {
        // Logs recorded under older rules (e.g. with a removed input type) cannot replay at all.
        console.log(`FAILED ${e instanceof Error ? e.message : String(e)}`);
        return 1;
      }
      console.log(result.ok ? `OK ${result.hash}` : `MISMATCH expected ${log.finalHash}, got ${result.hash}`);
      return result.ok ? 0 : 1;
    }
    default:
      console.log(USAGE);
      return command === undefined || command === 'help' ? 0 : 1;
  }
}
