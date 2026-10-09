import { describe, expect, it } from 'vitest';
import { SONGS, songEvents } from '../src/audio/music';

describe('the music loops (spec #3 §6)', () => {
  it('builds the menu loop: 8 bars of arpeggio, bass, shaker and kick, plus the bell tune', () => {
    const events = songEvents(SONGS.menu);
    expect(SONGS.menu.bpm).toBe(104);
    expect(events.filter((e) => e.kind === 'mallet')).toHaveLength(64);
    expect(events.filter((e) => e.kind === 'bass')).toHaveLength(16);
    expect(events.filter((e) => e.kind === 'shaker')).toHaveLength(32);
    expect(events.filter((e) => e.kind === 'kick')).toHaveLength(16);
    expect(events.filter((e) => e.kind === 'bell')).toHaveLength(12);
    expect(events.find((e) => e.kind === 'mallet' && e.time === '3:0:10')?.note).toBe('B3');
  });

  it('builds the calmer match loop: sparse arpeggio, a pad each bar, no kick', () => {
    const events = songEvents(SONGS.match);
    expect(SONGS.match.bpm).toBe(88);
    expect(events.filter((e) => e.kind === 'mallet')).toHaveLength(32);
    expect(events.filter((e) => e.kind === 'pad')).toHaveLength(8);
    expect(events.filter((e) => e.kind === 'kick')).toHaveLength(0);
  });

  it('places half-beat tune notes on the right sixteenth', () => {
    const tune = songEvents(SONGS.menu).filter((e) => e.kind === 'bell');
    expect(tune.find((e) => e.note === 'G5')?.time).toBe('1:0:2');
  });
});
