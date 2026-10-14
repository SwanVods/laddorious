import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { capGeometry, symbolGeometry } from '../../apps/client/src/assets/symbols';
import { arrowheadGeometry, arrowheadOutlineGeometry, puffGeometry } from '../../apps/client/src/assets/models';
import { PARTS } from '../../apps/client/src/scene/layout';
import { SYMBOLS } from '../../apps/client/src/scene/pairs';
import { PUFFS, dashPoints } from '../../apps/client/src/scene/tracks';
import { MODELS } from '../contract';
import { readGlb, type GlbSummary } from '../glb';

// A busy match, priced with the built models (spec #5 §1: at most 100 draw calls and 150,000 triangles).
// The busiest moment is a roll: four dice tumble while every piece and part shows. Today's boards have
// 8 slides and 10 pads; cards add a few, so this prices 12 and 14. Paths hide unless a piece stands on
// their start or a player taps an end (spec #5 A13): at most five show, priced as the costliest kind.
// A trail is low-poly pieces with dark outlines (round 5): four instanced meshes in all, puffs and arrowheads.

const DIR = new URL('../../apps/client/public/models/', import.meta.url);
const SLIDES = 12;
const PADS = 14;
const SEATS = 4;
/** Paths showing at once: one under each piece, and one a player tapped. */
const SHOWN = SEATS + 1;
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

const flat = (m: GlbSummary) => ({ calls: m.materials.length, triangles: m.triangles });

/** A geometry's triangles, indexed or not (typed by shape: three's types live in the client). */
const triangles = (g: { index: { count: number } | null; attributes: Record<string, { count: number }> }) => (g.index ?? g.attributes['position']!).count / 3;

function built(id: string): GlbSummary | null {
  const url = new URL(`${id}.glb`, DIR);
  return existsSync(url) ? readGlb(new Uint8Array(readFileSync(url))) : null;
}

/** On Low quality a model with a lighter file draws that one (spec #5 A14). */
const builtFor = (id: string, low: boolean) => (low ? (built(`${id}-low`) ?? built(id)) : built(id));

function price(level: 'high' | 'low') {
  const low = level === 'low';
  const shadows = !low;
  const rows: string[] = [];
  let calls = CODE.calls;
  let total = CODE.triangles;
  const add = (name: string, c: number, t: number) => {
    calls += c;
    total += t;
    rows.push(`${name}: ${c} calls, ${t} triangles`);
  };
  // The paths that show, priced as the costlier kind: a long slide's arrowheads or a rocket's puffs.
  // Each piece with its dark outline: two instanced meshes for puffs, two for arrowheads.
  const slide = dashPoints({ id: 's', from: 99, to: 2 }).length * (triangles(arrowheadGeometry()) + triangles(arrowheadOutlineGeometry()));
  const rocket = PUFFS * 2 * triangles(puffGeometry());
  add('shown paths', 4, SHOWN * Math.max(slide, rocket));
  // The pair symbols: one instanced mesh per symbol, both ends of every jump; and the whirlpools' caps.
  const heaviestSymbol = Math.max(...SYMBOLS.map((name) => triangles(symbolGeometry(name))));
  add('pair symbols', SYMBOLS.length, 2 * (SLIDES + PADS) * heaviestSymbol);
  add('whirlpool caps', 1, SLIDES * triangles(capGeometry(PARTS.cap.radius, PARTS.cap.top)));
  // One piece per seat, the heaviest four, each with its shadow on High.
  const pieces = Object.keys(MODELS)
    .filter((id) => MODELS[id]!.slot.startsWith('piece.'))
    .map((id) => builtFor(id, low))
    .filter((m): m is GlbSummary => m !== null);
  const heaviest = (key: (m: GlbSummary) => number) =>
    pieces
      .map(key)
      .sort((a, b) => b - a)
      .slice(0, SEATS)
      .reduce((sum, v) => sum + v, 0);
  const cost = shadows ? shadowed : flat;
  add('pieces', heaviest((m) => cost(m).calls), heaviest((m) => cost(m).triangles));
  // On Low the ladder and portal ends are flat images (round 5): four instanced quads, two triangles a copy.
  const ENDS = ['pad', 'target', 'vortex', 'exit'];
  if (low) add('flat ends', 4, 2 * 2 * (SLIDES + PADS));
  for (const [id, use] of Object.entries(USES)) {
    if (low && ENDS.includes(id)) continue;
    const model = builtFor(id, low);
    if (!model) continue;
    const each = use.shadows && shadows ? shadowed(model) : flat(model);
    add(id, each.calls * (use.separate ? use.copies : 1), each.triangles * use.copies);
  }
  return { calls, total, rows: rows.join('\n') };
}

describe('a busy match with the built models (spec #5 §1)', () => {
  it.each(['high', 'low'] as const)('stays within 100 draw calls and 150,000 triangles on %s', (level) => {
    const { calls, total, rows } = price(level);
    expect(calls, rows).toBeLessThanOrEqual(100);
    expect(total, rows).toBeLessThanOrEqual(150_000);
  });

  // At the plan's piece sizes a busy match on Low came to about 106,000 triangles; the sculpted pieces
  // took it to 134,000, and their lighter files bring it back under the plan (spec #5 A14).
  it('keeps a busy match on Low under 100,000 triangles, for older phones', () => {
    const { total, rows } = price('low');
    expect(total, rows).toBeLessThanOrEqual(100_000);
  });
});
