import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Shape, ShapeGeometry, Vector2 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAIR_COLORS, WORLD_COLORS } from '../app/theme';
import type { SymbolName } from '../scene/pairs';

// The pair symbols (spec #5 A13), drawn as in the approved mockup: each in a 100-unit box, y down.

/** Points round each of the crescent's circles: smooth at a symbol's size, and light. */
const MOON_STEPS = 32;

/** A crescent: the outer circle less an inner one set up and to the right. */
function moon(): Vector2[] {
  const outer = { x: 45, y: 50, r: 42 };
  const inner = { x: 63, y: 42, r: 33 };
  const inside = (p: { x: number; y: number }, c: typeof outer) => Math.hypot(p.x - c.x, p.y - c.y) < c.r;
  const points: Vector2[] = [];
  for (let i = 0; i < MOON_STEPS; i++) {
    const a = (i / MOON_STEPS) * Math.PI * 2;
    const p = { x: outer.x + outer.r * Math.cos(a), y: outer.y + outer.r * Math.sin(a) };
    if (!inside(p, inner)) points.push(new Vector2(p.x, p.y));
  }
  // Back along the inner circle, the part inside the outer one, the other way round.
  const back: Vector2[] = [];
  for (let i = 0; i < MOON_STEPS; i++) {
    const a = (i / MOON_STEPS) * Math.PI * 2;
    const p = { x: inner.x + inner.r * Math.cos(a), y: inner.y + inner.r * Math.sin(a) };
    if (inside(p, outer)) back.push(new Vector2(p.x, p.y));
  }
  // Start each run where it leaves the other circle, so the outline doesn't cross itself.
  const run = (pts: Vector2[], c: typeof outer, keepInside: boolean) => {
    const at = pts.findIndex((_, i) => inside(pts[(i - 1 + pts.length) % pts.length]!, c) !== keepInside);
    return at <= 0 ? pts : [...pts.slice(at), ...pts.slice(0, at)];
  };
  return [...run(points, inner, false), ...run(back, outer, true).reverse()];
}

function shapeOf(name: SymbolName): Shape {
  const s = new Shape();
  const poly = (points: Array<[number, number]>) => {
    s.moveTo(...points[0]!);
    for (const p of points.slice(1)) s.lineTo(...p);
    s.closePath();
  };
  switch (name) {
    case 'circle':
      s.absarc(50, 50, 36, 0, Math.PI * 2, false);
      break;
    case 'triangle':
      poly([[50, 12], [90, 82], [10, 82]]);
      break;
    case 'square':
      s.moveTo(26, 16).lineTo(74, 16).quadraticCurveTo(84, 16, 84, 26).lineTo(84, 74).quadraticCurveTo(84, 84, 74, 84);
      s.lineTo(26, 84).quadraticCurveTo(16, 84, 16, 74).lineTo(16, 26).quadraticCurveTo(16, 16, 26, 16);
      break;
    case 'diamond':
      poly([[50, 6], [94, 50], [50, 94], [6, 50]]);
      break;
    case 'heart':
      s.moveTo(50, 88).bezierCurveTo(18, 64, 8, 48, 8, 32).bezierCurveTo(8, 18, 19, 9, 31, 9).bezierCurveTo(40, 9, 46, 15, 50, 23);
      s.bezierCurveTo(54, 15, 60, 9, 69, 9).bezierCurveTo(81, 9, 92, 18, 92, 32).bezierCurveTo(92, 48, 82, 64, 50, 88);
      break;
    case 'plus':
      poly([[37, 8], [63, 8], [63, 37], [92, 37], [92, 63], [63, 63], [63, 92], [37, 92], [37, 63], [8, 63], [8, 37], [37, 37]]);
      break;
    case 'moon':
      s.setFromPoints(moon());
      break;
    case 'bolt':
      poly([[58, 4], [16, 56], [44, 56], [36, 96], [84, 40], [56, 40]]);
      break;
  }
  return s;
}

/** Paint every vertex of a geometry one colour (the instance colour multiplies it). */
function paint(geometry: BufferGeometry, colour: Color): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute('color', new Float32BufferAttribute(Array.from({ length: count }, () => [colour.r, colour.g, colour.b]).flat(), 3));
  return geometry;
}

/** How much wider the dark rim is than the face. */
const RIM = 1.18;

/**
 * A pair symbol lying flat, a unit across, upright to the board camera (its top toward -Z): a white
 * face, which the instance colour paints, over a slightly larger copy in ink, its rim.
 */
export function symbolGeometry(name: SymbolName): BufferGeometry {
  const face = new ShapeGeometry(shapeOf(name), 4);
  // From the 100-unit box (y down) to a unit centred on the origin (y up), then flat with y up.
  face.computeBoundingBox();
  const box = face.boundingBox!;
  const across = Math.max(box.max.x - box.min.x, box.max.y - box.min.y);
  face.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
  face.scale(1 / (across * RIM), 1 / (across * RIM), 1);
  const rim = face.clone().scale(RIM, RIM, 1);
  for (const g of [face, rim]) {
    // Lay it flat: the drawing's y (down) becomes +Z, toward the camera, so its top points to -Z. It then
    // faces down, so the symbols' material draws both sides (they're unlit decals).
    g.rotateX(Math.PI / 2);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
  }
  rim.translate(0, 0.002, 0);
  face.translate(0, 0.005, 0);
  return mergeGeometries([paint(rim, new Color(WORLD_COLORS.ink)), paint(face, new Color(1, 1, 1))])!;
}

/** The still cap in a whirlpool's eye, under its symbol: a low disc, cream on top and ink round its side. */
export function capGeometry(radius: number, height: number): BufferGeometry {
  const g = new CylinderGeometry(radius, radius, height, 24).translate(0, height / 2, 0);
  const normal = g.getAttribute('normal');
  const top = new Color(PAIR_COLORS.cap);
  const side = new Color(WORLD_COLORS.ink);
  const colours: number[] = [];
  for (let i = 0; i < normal.count; i++) {
    const c = normal.getY(i) > 0.9 ? top : side;
    colours.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(colours, 3));
  return g;
}
