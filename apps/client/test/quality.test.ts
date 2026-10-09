import { describe, expect, it } from 'vitest';
import { FrameRateWatch, QUALITY, autoStartLevel } from '../src/scene/quality';

/** Feed `seconds` of frames at a steady rate; count how often the watch says to step down. */
function feed(watch: FrameRateWatch, fps: number, seconds: number): number {
  let fired = 0;
  for (let i = 0; i < Math.round(fps * seconds); i++) if (watch.add(1000 / fps)) fired += 1;
  return fired;
}

describe('graphics quality (spec #2 §6.4)', () => {
  it('starts Auto on Low only for phones: a coarse pointer and a short side under 500 px', () => {
    expect(autoStartLevel({ coarsePointer: true, shortSide: 390 })).toBe('low');
    expect(autoStartLevel({ coarsePointer: true, shortSide: 820 })).toBe('high');
    expect(autoStartLevel({ coarsePointer: false, shortSide: 390 })).toBe('high');
    expect(QUALITY.high).toMatchObject({ shadows: true, dpr: 2, antialias: true });
    expect(QUALITY.low).toMatchObject({ shadows: false, dpr: 1.5 });
    expect(QUALITY.low.clouds).toBeLessThan(QUALITY.high.clouds);
    expect(QUALITY.high.clearcoat).toBe(true);
    expect(QUALITY.low.clearcoat).toBe(false); // phones skip the clearcoat (spec #5 §3.1)
  });

  it('keeps High while the frame rate holds at 45 fps or more', () => {
    expect(feed(new FrameRateWatch(), 60, 20)).toBe(0);
    expect(feed(new FrameRateWatch(), 46, 20)).toBe(0);
  });

  it('steps down once, when the average stays under 45 fps for 5 s', () => {
    const watch = new FrameRateWatch();
    expect(feed(watch, 30, 4.9)).toBe(0);
    expect(feed(watch, 30, 1)).toBe(1);
    expect(feed(watch, 30, 10)).toBe(0);
  });

  it('ignores a single long stall such as a tab switch', () => {
    const watch = new FrameRateWatch();
    feed(watch, 60, 3);
    expect(watch.add(4000)).toBe(false);
    expect(feed(watch, 60, 10)).toBe(0);
  });
});
