import { describe, expect, it } from 'vitest';
import { createStream, cyrb128, hashString, intBetween, nextInt, nextU32, pickWeighted, rollDie, scriptedStream } from '../src/index';

describe('cyrb128', () => {
  it('matches known values', () => {
    expect(cyrb128('laddorious')).toEqual([1958351881, 3092201487, 2001009370, 375152173]);
    expect(hashString('laddorious')).toBe('74ba1409b84f400f7744fada165c5e2d');
  });
});

describe('sfc32 streams', () => {
  it('produces known values for a label (pins the algorithm)', () => {
    const s = createStream('laddorious');
    expect([nextU32(s), nextU32(s), nextU32(s)]).toEqual([1431891413, 3359056840, 163656194]);
    const d = createStream('dice');
    expect(Array.from({ length: 10 }, () => rollDie(d))).toEqual([4, 6, 3, 6, 5, 3, 6, 2, 3, 5]);
  });

  it('is deterministic per label and differs across labels', () => {
    const a = createStream('x');
    const b = createStream('x');
    const c = createStream('y');
    const seqA = Array.from({ length: 20 }, () => nextU32(a));
    expect(Array.from({ length: 20 }, () => nextU32(b))).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => nextU32(c))).not.toEqual(seqA);
  });

  it('survives a JSON round trip mid-sequence', () => {
    const a = createStream('json');
    nextU32(a);
    const copy = JSON.parse(JSON.stringify(a));
    expect(nextU32(copy)).toBe(nextU32(a));
  });

  it('keeps nextInt, intBetween and rollDie in range and roughly uniform', () => {
    const s = createStream('range');
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60_000; i++) counts[rollDie(s) - 1]!++;
    for (const c of counts) expect(c).toBeGreaterThan(9_400);
    for (let i = 0; i < 1000; i++) {
      const v = intBetween(s, 4, 30);
      expect(v).toBeGreaterThanOrEqual(4);
      expect(v).toBeLessThanOrEqual(30);
    }
    expect(() => nextInt(s, 0)).toThrow(RangeError);
  });

  it('pickWeighted follows integer weights and never picks weight 0', () => {
    const s = createStream('weights');
    const counts = [0, 0, 0];
    for (let i = 0; i < 10_000; i++) counts[pickWeighted(s, [70, 0, 30])]!++;
    expect(counts[1]).toBe(0);
    expect(counts[0]! / 10_000).toBeGreaterThan(0.67);
    expect(counts[0]! / 10_000).toBeLessThan(0.73);
    expect(() => pickWeighted(s, [0, 0])).toThrow(RangeError);
  });
});

describe('scripted streams', () => {
  it('return scripted nextInt values in order and reject out-of-range values', () => {
    const s = scriptedStream([5, 0, 1]);
    expect(rollDie(s)).toBe(6);
    expect(rollDie(s)).toBe(1);
    expect(nextInt(s, 2)).toBe(1);
  });

  it('throw when exhausted or out of range', () => {
    expect(() => nextInt(scriptedStream([]), 6)).toThrow(/exhausted/);
    expect(() => nextInt(scriptedStream([6]), 6)).toThrow(RangeError);
  });
});
