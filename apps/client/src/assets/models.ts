import { CylinderGeometry, ExtrudeGeometry, LatheGeometry, Shape, Vector2, type BufferGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PieceId } from '../service/matchService';
import type { Vec3 } from '../scene/layout';

// Code-built defaults for the asset slots (spec #2 §6.2, §6.3): about one unit tall,
// origin at the feet, +Z forward, Y up. The scene scales pieces by 1.3.

const SEGMENTS = 28;

function lathe(points: Array<[number, number]>): BufferGeometry {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), SEGMENTS);
}

/** Merge parts into one geometry, so a piece is a single draw call. */
function merge(parts: BufferGeometry[]): BufferGeometry {
  return mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)));
}

/** The round plinth the knight, pawn and dragon stand on. */
function plinth(): BufferGeometry {
  return lathe([[0, 0], [0.42, 0], [0.44, 0.04], [0.42, 0.1], [0.34, 0.14], [0, 0.14]]);
}

/** Extrude a side profile drawn facing +X, centre it, and turn it to face +Z. */
function profile(shape: Shape, depth: number): BufferGeometry {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return g;
}

function pawnGeometry(): BufferGeometry {
  return lathe([
    [0, 0], [0.42, 0], [0.44, 0.04], [0.42, 0.1], [0.32, 0.16], [0.2, 0.24], [0.16, 0.42], [0.13, 0.56], [0.24, 0.6],
    [0.24, 0.65], [0.13, 0.68], [0.17, 0.73], [0.21, 0.79], [0.22, 0.86], [0.2, 0.93], [0.14, 0.99], [0.07, 1.02], [0, 1.03],
  ]);
}

function knightGeometry(): BufferGeometry {
  const head = new Shape();
  head.moveTo(-0.22, 0.1);
  head.lineTo(0.2, 0.1);
  head.quadraticCurveTo(0.26, 0.38, 0.14, 0.52);
  head.lineTo(0.34, 0.64);
  head.quadraticCurveTo(0.44, 0.74, 0.34, 0.84);
  head.lineTo(0.06, 0.95);
  head.lineTo(0.02, 1.06);
  head.lineTo(-0.07, 0.94);
  head.quadraticCurveTo(-0.32, 0.78, -0.26, 0.44);
  head.quadraticCurveTo(-0.24, 0.26, -0.22, 0.1);
  return merge([plinth(), profile(head, 0.26)]);
}

function meepleGeometry(): BufferGeometry {
  const body = new Shape();
  body.moveTo(-0.42, 0);
  body.lineTo(-0.1, 0);
  body.lineTo(0, 0.2);
  body.lineTo(0.1, 0);
  body.lineTo(0.42, 0);
  body.quadraticCurveTo(0.3, 0.3, 0.2, 0.46);
  body.quadraticCurveTo(0.42, 0.46, 0.46, 0.56);
  body.quadraticCurveTo(0.46, 0.66, 0.34, 0.68);
  body.lineTo(0.14, 0.7);
  body.absarc(0, 0.84, 0.17, -0.784, Math.PI + 0.784, false);
  body.lineTo(-0.34, 0.68);
  body.quadraticCurveTo(-0.46, 0.66, -0.46, 0.56);
  body.quadraticCurveTo(-0.42, 0.46, -0.2, 0.46);
  body.quadraticCurveTo(-0.3, 0.3, -0.42, 0);
  const g = new ExtrudeGeometry(body, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10 });
  // The bevel grows the outline below y = 0; stand it back on the origin.
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox!.min.y, -0.15);
  return g;
}

function dragonGeometry(): BufferGeometry {
  const head = new Shape();
  head.moveTo(-0.2, 0.1);
  head.lineTo(0.18, 0.1);
  head.quadraticCurveTo(0.22, 0.34, 0.12, 0.48);
  head.lineTo(0.4, 0.54);
  head.lineTo(0.43, 0.6);
  head.lineTo(0.2, 0.63);
  head.lineTo(0.45, 0.7);
  head.quadraticCurveTo(0.42, 0.83, 0.16, 0.85);
  head.lineTo(0.09, 1.05);
  head.lineTo(0.01, 0.87);
  head.lineTo(-0.15, 1.1);
  head.lineTo(-0.12, 0.85);
  head.quadraticCurveTo(-0.32, 0.7, -0.24, 0.44);
  head.lineTo(-0.31, 0.37);
  head.lineTo(-0.22, 0.31);
  head.quadraticCurveTo(-0.2, 0.2, -0.2, 0.1);
  return merge([plinth(), profile(head, 0.28)]);
}

export const PIECE_GEOMETRY: Record<PieceId, () => BufferGeometry> = {
  knight: knightGeometry,
  pawn: pawnGeometry,
  meeple: meepleGeometry,
  dragon: dragonGeometry,
};

/** Die faces in BoxGeometry's face order (+X, −X, +Y, −Y, +Z, −Z); opposite faces sum to 7. */
export const DIE_FACES = [3, 4, 1, 6, 2, 5] as const;
export const DIE_SIZE = 0.5;

/** A rounded die whose faces each map into their cell (n − 1) of a 3×2 pip atlas, row 0 at the bottom. */
export function dieGeometry(): BufferGeometry {
  const rounded = new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 2, 0.08);
  const g = rounded.index ? rounded.toNonIndexed() : rounded;
  const uv = g.getAttribute('uv');
  g.groups.forEach((group, face) => {
    const cell = DIE_FACES[face]! - 1;
    const col = cell % 3;
    const row = Math.floor(cell / 3);
    for (let i = group.start; i < group.start + group.count; i++) uv.setXY(i, (col + uv.getX(i)) / 3, (row + uv.getY(i)) / 2);
  });
  uv.needsUpdate = true;
  return g;
}

/** The die rotation that turns a face up (+Y). */
export function dieRotationFor(face: number): Vec3 {
  switch (face) {
    case 6:
      return [Math.PI, 0, 0];
    case 2:
      return [-Math.PI / 2, 0, 0];
    case 5:
      return [Math.PI / 2, 0, 0];
    case 3:
      return [0, 0, Math.PI / 2];
    case 4:
      return [0, 0, -Math.PI / 2];
    default:
      return [0, 0, 0];
  }
}

/** A gold band whose top edge rises into five points (for tile 100, spec #2 §6.1). */
export function crownGeometry(): BufferGeometry {
  const radial = 10;
  const g = new CylinderGeometry(0.5, 0.4, 0.42, radial, 1, true);
  const pos = g.getAttribute('position');
  // The first row of vertices is the top ring; every other one becomes a point (the seam vertex repeats the first).
  for (let x = 0; x <= radial; x += 2) pos.setY(x, pos.getY(x) + 0.26);
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}
