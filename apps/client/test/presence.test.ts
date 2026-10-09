import { describe, expect, it } from 'vitest';
import { presenceToast } from '../src/hud/presence';
import { SEATS } from './support/fixtures';

// SEATS: You (p0), Mochi (p1), Pip (p2), Juno (p3).

describe('presenceToast (spec #4 §3.3)', () => {
  it('names a player who lost connection, and one who is back', () => {
    expect(presenceToast([], ['p1'], SEATS, 'p0')).toBe('Mochi lost connection');
    expect(presenceToast(['p1'], [], SEATS, 'p0')).toBe('Mochi is back');
  });

  it('names several at once', () => {
    expect(presenceToast([], ['p1', 'p2'], SEATS, 'p0')).toBe('Mochi and Pip lost connection');
    expect(presenceToast(['p1', 'p2'], [], SEATS, 'p0')).toBe('Mochi and Pip are back');
  });

  it('says I am back in the match, and leaves my own drop to the reconnecting pill', () => {
    expect(presenceToast([], ['p0'], SEATS, 'p0')).toBeNull();
    expect(presenceToast(['p0', 'p1'], ['p1'], SEATS, 'p0')).toBe('Back in the match');
  });

  it('says nothing when nothing changed', () => {
    expect(presenceToast(['p1'], ['p1'], SEATS, 'p0')).toBeNull();
  });
});
