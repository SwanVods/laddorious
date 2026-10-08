import type { CSSProperties } from 'react';
import type { PieceId } from '../service/matchService';

// 2D portraits of the four pieces for the HUD (spec #2 §7.2): white silhouettes with an ink
// outline, drawn on a disc in the seat colour. The outlines follow the in-match mockup.

type Command = ['M' | 'L', number, number] | ['Q', number, number, number, number];

const SHAPES: Record<Exclude<PieceId, 'pawn'>, { eye?: [number, number]; cmds: Command[] }> = {
  knight: {
    eye: [0.22, 0.7],
    cmds: [['M', -0.26, 0], ['L', 0.22, 0], ['Q', 0.24, 0.18, 0.16, 0.3], ['Q', 0.26, 0.38, 0.4, 0.42], ['Q', 0.5, 0.46, 0.46, 0.56], ['Q', 0.42, 0.64, 0.3, 0.66], ['Q', 0.2, 0.72, 0.14, 0.8], ['L', 0.06, 0.98], ['L', -0.02, 0.84], ['Q', -0.2, 0.82, -0.28, 0.6], ['Q', -0.34, 0.36, -0.26, 0]],
  },
  dragon: {
    eye: [0.2, 0.75],
    cmds: [['M', -0.2, 0], ['L', 0.16, 0], ['Q', 0.1, 0.22, 0.2, 0.36], ['L', 0.42, 0.42], ['L', 0.55, 0.47], ['L', 0.4, 0.52], ['L', 0.56, 0.58], ['Q', 0.6, 0.66, 0.48, 0.68], ['Q', 0.34, 0.7, 0.22, 0.8], ['Q', 0.12, 0.9, 0, 0.88], ['Q', -0.12, 0.86, -0.16, 0.76], ['L', -0.31, 0.74], ['L', -0.22, 0.63], ['L', -0.35, 0.56], ['L', -0.25, 0.45], ['L', -0.34, 0.36], ['L', -0.23, 0.27], ['Q', -0.28, 0.12, -0.2, 0]],
  },
  meeple: {
    cmds: [['M', -0.36, 0], ['L', -0.1, 0], ['Q', 0, 0.24, 0.1, 0], ['L', 0.36, 0], ['Q', 0.3, 0.2, 0.2, 0.34], ['Q', 0.42, 0.38, 0.4, 0.5], ['Q', 0.36, 0.6, 0.16, 0.6], ['Q', 0.24, 0.74, 0.16, 0.84], ['Q', 0, 0.96, -0.16, 0.84], ['Q', -0.24, 0.74, -0.16, 0.6], ['Q', -0.36, 0.6, -0.4, 0.5], ['Q', -0.42, 0.38, -0.2, 0.34], ['Q', -0.3, 0.2, -0.36, 0]],
  },
};
const PAWN_SIDE: Array<[number, number]> = [[0.36, 0], [0.37, 0.04], [0.35, 0.1], [0.27, 0.13], [0.25, 0.18], [0.18, 0.22], [0.14, 0.34], [0.115, 0.5], [0.11, 0.56], [0.2, 0.6], [0.21, 0.63], [0.12, 0.67]];

interface Drawn {
  d: string;
  eye: [number, number] | null;
  head: { cx: number; cy: number; r: number } | null;
}

/** Fit a shape into a 40×40 box: path, eye and (pawn) head in SVG coordinates. */
function draw(piece: PieceId): Drawn {
  const cmds: Command[] =
    piece === 'pawn'
      ? [['M', 0, 0], ...PAWN_SIDE.map(([x, y]): Command => ['L', x, y]), ['L', 0, 0.67], ...[...PAWN_SIDE].reverse().map(([x, y]): Command => ['L', -x, y])]
      : SHAPES[piece].cmds;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of cmds) {
    for (let i = 1; i < c.length; i += 2) {
      xs.push(c[i] as number);
      ys.push(c[i + 1] as number);
    }
  }
  if (piece === 'pawn') {
    xs.push(-0.19, 0.19);
    ys.push(1.01);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const k = 29 / Math.max(maxX - minX, Math.max(...ys) - minY);
  const cx = (minX + maxX) / 2;
  const X = (x: number) => +(20 + (x - cx) * k).toFixed(1);
  const Y = (y: number) => +(35 - (y - minY) * k).toFixed(1);
  const d = `${cmds.map((c) => (c[0] === 'Q' ? `Q${X(c[1])},${Y(c[2])} ${X(c[3])},${Y(c[4])}` : `${c[0]}${X(c[1])},${Y(c[2])}`)).join('')}Z`;
  const eye = piece === 'pawn' ? null : SHAPES[piece].eye ?? null;
  return {
    d,
    eye: eye ? [X(eye[0]), Y(eye[1])] : null,
    head: piece === 'pawn' ? { cx: X(0), cy: Y(0.82), r: +(0.19 * k).toFixed(1) } : null,
  };
}

const DRAWN: Record<PieceId, Drawn> = { knight: draw('knight'), pawn: draw('pawn'), meeple: draw('meeple'), dragon: draw('dragon') };

/** A piece silhouette. The fill and outline come from CSS (.piece-icon). */
export function PieceIcon({ piece }: { piece: PieceId }) {
  const { d, eye, head } = DRAWN[piece];
  return (
    <svg className="piece-icon" viewBox="0 0 40 40" aria-hidden="true">
      <path d={d} />
      {head && <circle cx={head.cx} cy={head.cy} r={head.r} />}
      {eye && <circle className="piece-eye" cx={eye[0]} cy={eye[1]} r={1.8} />}
    </svg>
  );
}

/** A round portrait: the piece on a disc in the seat colour, with an optional badge. */
export function Portrait({ piece, color, className, badge }: { piece: PieceId; color: string; className?: string; badge?: string | number }) {
  return (
    <span className={className ? `portrait ${className}` : 'portrait'} style={{ '--seat': color } as CSSProperties}>
      <PieceIcon piece={piece} />
      {badge !== undefined && <span className="portrait-badge display">{badge}</span>}
    </span>
  );
}
