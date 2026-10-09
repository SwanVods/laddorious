import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { slideCurve } from '../../apps/client/src/scene/layout';
import { CHANNEL, channelGeometry, trailGeometry, trailPath } from '../../apps/client/src/scene/tracks';
import { MODELS } from '../contract';
import { readGlb, type GlbSummary } from '../glb';

// A busy match on High quality, priced with the built models (spec #5 §1: at most 100 draw calls and
// 150,000 triangles). The busiest moment is a roll: four dice tumble while every piece and part shows.
// Today's boards have 8 slides and 10 pads; cards add a few, so this prices 12 and 14.

const DIR = new URL('../../apps/client/public/models/', import.meta.url);
const SLIDES = 12;
const PADS = 14;
const SEATS = 4;
/** The scene's own parts during a roll: the sky, the number overlay, the "?" rings and four shield bubbles. */
const CODE = { calls: 7, triangles: 3_200 };

/** How the game draws each model: its copies, whether each copy is its own draw (not instanced), and whether it casts a shadow. */
const USES: Record<string, { copies: number; separate?: boolean; shadows?: boolean }> = {
  die: { copies: SEATS, separate: true, shadows: true },
  crown: { copies: 1, separate: true, shadows: true },
  tile: { copies: 100 },
  pad: { copies: PADS },
  target: { copies: PADS },
  vortex: { copies: SLIDES },
  exit: { copies: SLIDES },
  island: { copies: 1, separate: true },
  bumper: { copies: 36 },
  cloud: { copies: 8 },
  prop_die: { copies: 1, separate: true },
  prop_cards: { copies: 1, separate: true },
  prop_spinner: { copies: 1, separate: true },
  prop_hourglass: { copies: 1, separate: true },
  prop_chips: { copies: 1, separate: true },
};

/**
 * A model drawn on screen and into the shadow map. With a Shadow mesh, that small stand-in fills the
 * shadow map instead, and is drawn unseen on screen too (spec #5 §6); without one, the model is drawn twice.
 */
const shadowed = (m: GlbSummary) =>
  m.shadowTriangles > 0
    ? { calls: m.materials.length + 2, triangles: m.triangles + 2 * m.shadowTriangles }
    : { calls: m.materials.length * 2, triangles: m.triangles * 2 };

/** An indexed geometry's triangles (typed by shape: three's types live in the client). */
const triangles = (g: { index: { count: number } | null }) => g.index!.count / 3;

function built(id: string): GlbSummary | null {
  const url = new URL(`${id}.glb`, DIR);
  return existsSync(url) ? readGlb(new Uint8Array(readFileSync(url))) : null;
}

describe('a busy match with the built models (spec #5 §1)', () => {
  it('stays within 100 draw calls and 150,000 triangles', () => {
    const rows: string[] = [];
    let calls = CODE.calls;
    let total = CODE.triangles;
    const add = (name: string, c: number, t: number) => {
      calls += c;
      total += t;
      rows.push(`${name}: ${c} calls, ${t} triangles`);
    };
    // The tracks, priced with the game's own builders on a long slide and a long pad.
    const slide = channelGeometry(slideCurve(99, 2).getPoints(CHANNEL.samples));
    add('slide channels', 2, SLIDES * (triangles(slide.floor) + triangles(slide.walls)));
    add('pad trails', 1, PADS * triangles(trailGeometry(trailPath({ id: 'l', from: 3, to: 97 }))));
    // One piece per seat, the heaviest four, each with its shadow.
    const pieces = Object.keys(MODELS)
      .filter((id) => MODELS[id]!.slot.startsWith('piece.'))
      .map(built)
      .filter((m): m is GlbSummary => m !== null);
    const heaviest = (key: (m: GlbSummary) => number) =>
      pieces
        .map(key)
        .sort((a, b) => b - a)
        .slice(0, SEATS)
        .reduce((sum, v) => sum + v, 0);
    add('pieces', heaviest((m) => shadowed(m).calls), heaviest((m) => shadowed(m).triangles));
    for (const [id, use] of Object.entries(USES)) {
      const model = built(id);
      if (!model) continue;
      const cost = use.shadows ? shadowed(model) : { calls: model.materials.length, triangles: model.triangles };
      add(id, cost.calls * (use.separate ? use.copies : 1), cost.triangles * use.copies);
    }
    expect(calls, rows.join('\n')).toBeLessThanOrEqual(100);
    expect(total, rows.join('\n')).toBeLessThanOrEqual(150_000);
  });
});
