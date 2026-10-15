import { describe, expect, it } from 'vitest';
import { runBatch } from '../src/index';

describe('bots play the card file (2026-10-15)', () => {
  it('finishes 30 four-player matches with it', () => {
    const { report } = runBatch({ matches: 30, players: 4, policy: 'random', baseSeed: 'catalog', afkPercent: 0 });
    expect(report.matches).toBe(30);
  });
});
