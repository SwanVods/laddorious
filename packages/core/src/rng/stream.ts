import { cyrb128 } from './hash';

/**
 * A PRNG stream stored as plain JSON data inside the match state.
 * Functions in this module mutate the stream object in place; callers
 * own a cloned draft of the state, so this stays pure from the outside.
 */
export type RngStream =
  | { kind: 'sfc32'; s: [number, number, number, number] }
  | { kind: 'scripted'; values: number[]; index: number };

export function createStream(label: string): RngStream {
  const s = cyrb128(label);
  const stream: RngStream = { kind: 'sfc32', s };
  // Discard the first outputs: sfc32 needs a few rounds to mix a hashed seed.
  for (let i = 0; i < 12; i++) nextU32(stream);
  return stream;
}

/** Test-only stream: each nextInt() call returns the next scripted value. */
export function scriptedStream(values: number[]): RngStream {
  return { kind: 'scripted', values: [...values], index: 0 };
}

export function nextU32(stream: RngStream): number {
  if (stream.kind === 'scripted') {
    throw new Error('nextU32 is not available on scripted streams; use nextInt');
  }
  const st = stream.s;
  let a = st[0] | 0;
  let b = st[1] | 0;
  let c = st[2] | 0;
  let d = st[3] | 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  st[0] = a >>> 0;
  st[1] = b >>> 0;
  st[2] = c >>> 0;
  st[3] = d >>> 0;
  return t >>> 0;
}

/** Uniform integer in [0, n). Rejection sampling avoids modulo bias. */
export function nextInt(stream: RngStream, n: number): number {
  if (!Number.isInteger(n) || n <= 0 || n > 0x100000000) {
    throw new RangeError(`nextInt: n must be an integer in 1..2^32, got ${n}`);
  }
  if (stream.kind === 'scripted') {
    const v = stream.values[stream.index];
    if (v === undefined) throw new Error('scripted stream exhausted');
    if (!Number.isInteger(v) || v < 0 || v >= n) {
      throw new RangeError(`scripted value ${v} out of range for nextInt(${n})`);
    }
    stream.index++;
    return v;
  }
  const limit = 0x100000000 - (0x100000000 % n);
  for (;;) {
    const x = nextU32(stream);
    if (x < limit) return x % n;
  }
}

/** Uniform integer in [min, max] inclusive. */
export function intBetween(stream: RngStream, min: number, max: number): number {
  if (max < min) throw new RangeError(`intBetween: max ${max} < min ${min}`);
  return min + nextInt(stream, max - min + 1);
}

export function rollDie(stream: RngStream): number {
  return nextInt(stream, 6) + 1;
}

/** Index chosen with probability weights[i] / sum(weights). Weights are non-negative integers. */
export function pickWeighted(stream: RngStream, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) {
    if (!Number.isInteger(w) || w < 0) throw new RangeError(`weights must be non-negative integers, got ${w}`);
    total += w;
  }
  if (total <= 0) throw new RangeError('pickWeighted: weights sum to 0');
  let r = nextInt(stream, total);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r < 0) return i;
  }
  throw new Error('unreachable');
}

export function pickOne<T>(stream: RngStream, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('pickOne: empty list');
  return items[nextInt(stream, items.length)]!;
}
