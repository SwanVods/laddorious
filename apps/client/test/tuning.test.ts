import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_TUNING, loadTuning, mergeTuning, tuning, tuningStore } from '../src/app/tuning';
import { BEAT_MS } from '../src/director/beats';
import { feedLines } from '../src/hud/feed';
import { cameraShot } from '../src/scene/camera';

// Admin settings in tuning.json (the user, 2026-10-15): read at startup, every value checked, and a
// missing or bad value falls back to its default.

describe('merging tuning.json over the defaults', () => {
  it('takes a complete, valid file as it is', () => {
    const raw = structuredClone(DEFAULT_TUNING);
    raw.timing.cardPauseMs = 900;
    raw.camera.overview.zoomMax = 2;
    const { tuning, problems } = mergeTuning(raw);
    expect(tuning.timing.cardPauseMs).toBe(900);
    expect(tuning.camera.overview.zoomMax).toBe(2);
    expect(problems).toEqual([]);
  });

  it('keeps the defaults for missing keys, and reports nothing for them', () => {
    const { tuning, problems } = mergeTuning({ timing: { rollPauseMs: 250 } });
    expect(tuning.timing.rollPauseMs).toBe(250);
    expect(tuning.camera).toEqual(DEFAULT_TUNING.camera);
    expect(problems).toEqual([]);
  });

  it('falls back, key by key, for a wrong type, a negative or endless number, or a bad zoom range', () => {
    const { tuning, problems } = mergeTuning({
      timing: { cardPauseMs: 'slow', rollPauseMs: -5, hopMs: Infinity },
      hud: { phoneCompactCards: 'yes', feedLines: 2.5 },
      camera: { overview: { zoomMin: 3, zoomMax: 1 } },
    });
    expect(tuning.timing.cardPauseMs).toBe(DEFAULT_TUNING.timing.cardPauseMs);
    expect(tuning.timing.rollPauseMs).toBe(DEFAULT_TUNING.timing.rollPauseMs);
    expect(tuning.timing.hopMs).toBe(DEFAULT_TUNING.timing.hopMs);
    expect(tuning.hud).toEqual(DEFAULT_TUNING.hud);
    expect(tuning.camera.overview.zoomMin).toBe(DEFAULT_TUNING.camera.overview.zoomMin);
    expect(tuning.camera.overview.zoomMax).toBe(DEFAULT_TUNING.camera.overview.zoomMax);
    expect(problems.length).toBe(7);
    expect(problems.join(' ')).toContain('timing.cardPauseMs');
  });

  it('gives all the defaults for something that is not settings at all', () => {
    for (const raw of [null, 'oops', 42, []]) expect(mergeTuning(raw).tuning).toEqual(DEFAULT_TUNING);
  });
});

describe('loading tuning.json at startup', () => {
  it('reads the file into the settings the game uses', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ timing: { cardPauseMs: 750 } })));
    await loadTuning(fetcher);
    expect(fetcher).toHaveBeenCalledWith('tuning.json', expect.anything());
    expect(tuning().timing.cardPauseMs).toBe(750);
  });

  it('starts with the defaults, warning once, when the file is missing or broken', async () => {
    const warn = vi.fn();
    await loadTuning(async () => new Response('not json', { status: 200 }), warn);
    expect(tuning()).toEqual(DEFAULT_TUNING);
    expect(warn).toHaveBeenCalledTimes(1);
    await loadTuning(async () => new Response('', { status: 404 }), warn);
    expect(tuning()).toEqual(DEFAULT_TUNING);
  });
});

describe('the game reads the settings in use', () => {
  it('times beats, the camera and the feed by them', () => {
    const custom = structuredClone(DEFAULT_TUNING);
    custom.timing.cardPauseMs = 1234;
    custom.timing.hopMs = 300;
    custom.camera.overview.height = 40;
    custom.hud.feedLines = 2;
    tuningStore.setState(custom, true);
    expect(BEAT_MS.cardPause).toBe(1234);
    expect(BEAT_MS.hopPerTile).toBe(300);
    const overview = cameraShot({ beat: null, window: 'dice', myPick: false, me: 'p0', watch: null, piece: () => [0, 0, 0], reducedMotion: true, nowMs: 0 });
    expect(overview.position[1]).toBe(40);
    const log = Array.from({ length: 6 }, (_, i) => ({ seq: i + 1, event: { type: 'RoundStarted' as const, round: i + 1, visibility: 'public' as const } }));
    expect(feedLines(log)).toHaveLength(2);
    tuningStore.setState(DEFAULT_TUNING, true);
  });
});
