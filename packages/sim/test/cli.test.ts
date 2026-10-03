import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { main } from '../src/cli';

let log: MockInstance<typeof console.log>;
beforeEach(() => {
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => log.mockRestore());
const output = () => log.mock.calls.map((c) => String(c[0])).join('\n');

describe('cli', () => {
  it('board prints an ASCII board and the analysis', () => {
    expect(main(['board', '--seed', 'demo'])).toBe(0);
    expect(output()).toContain('Snakes:');
    expect(output()).toMatch(/Median first finish: 4p \d+ rounds/);
  });

  it('run writes a report and a replayable log; replay verifies it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sim-'));
    expect(main(['run', '--matches', '5', '--players', '3', '--seed', 'cli', '--out', join(dir, 'r.json'), '--log', join(dir, 'l.json')])).toBe(0);
    expect(output()).toContain('Matches:              5');
    expect(JSON.parse(readFileSync(join(dir, 'r.json'), 'utf8')).matches).toBe(5);
    expect(main(['replay', join(dir, 'l.json')])).toBe(0);
    const tampered = { ...JSON.parse(readFileSync(join(dir, 'l.json'), 'utf8')), finalHash: 'x' };
    writeFileSync(join(dir, 'bad.json'), JSON.stringify(tampered));
    expect(main(['replay', join(dir, 'bad.json')])).toBe(1);
  });

  it('rejects an unknown policy and prints usage for unknown commands', () => {
    expect(() => main(['run', '--policy', 'genius'])).toThrow(/unknown policy/);
    expect(main(['nope'])).toBe(1);
    expect(output()).toContain('Usage:');
  });
});
