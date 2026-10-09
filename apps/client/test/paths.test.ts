import type { EventBody, Jump } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { PEEK_MS, createPeeks, shownPaths } from '../src/scene/paths';

const ladder: Jump = { id: 'j1', from: 4, to: 25 };
const slide: Jump = { id: 'j2', from: 47, to: 26 };
const jumps = [ladder, slide];
const base = { jumps, positions: { p0: 0, p1: 12 }, moving: [] as EventBody[], peeks: createPeeks(), now: 10_000 };
const ids = (s: Set<string>) => [...s].sort();

describe('which paths show (spec #5 A13): hidden unless a piece is on the start, on the way, or peeked', () => {
  it('shows nothing when no piece stands on a start tile', () => {
    expect(ids(shownPaths(base))).toEqual([]);
  });

  it('shows a path while a piece stands on its start tile, and not for a piece on its end tile', () => {
    expect(ids(shownPaths({ ...base, positions: { p0: 47, p1: 25 } }))).toEqual(['j2']);
  });

  it('shows a path while a piece travels along it', () => {
    const moving: EventBody[] = [{ type: 'Moved', player: 'p0', from: 4, to: 25, cause: 'ladder', bounced: false }];
    expect(ids(shownPaths({ ...base, positions: { p0: 25 }, moving }))).toEqual(['j1']);
    const walk: EventBody[] = [{ type: 'Moved', player: 'p0', from: 2, to: 4, cause: 'dice', bounced: false }];
    expect(ids(shownPaths({ ...base, positions: { p0: 4 }, moving: walk }))).toEqual(['j1']); // on its start now
  });

  it('shows the paths that start or end on a tapped tile for a few seconds', () => {
    const peeks = createPeeks();
    peeks.tap(26, jumps, 10_000);
    expect(ids(shownPaths({ ...base, peeks, now: 10_000 + PEEK_MS - 1 }))).toEqual(['j2']);
    expect(ids(shownPaths({ ...base, peeks, now: 10_000 + PEEK_MS }))).toEqual([]);
    peeks.tap(4, jumps, 20_000);
    expect(ids(shownPaths({ ...base, peeks, now: 20_000 }))).toEqual(['j1']);
    peeks.tap(30, jumps, 20_000); // a plain tile shows nothing more
    expect(ids(shownPaths({ ...base, peeks, now: 20_000 }))).toEqual(['j1']);
  });
});
