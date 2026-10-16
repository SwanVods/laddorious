import { BufferAttribute, CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, type BufferGeometry, type Texture } from 'three';
import { WORLD_COLORS } from '../app/theme';

// The painted platform (the user, 2026-10-16): big, colourful brush strokes over the cream deck and the rim,
// in place of its plain cream and red stripes. One texture, painted in code once, repeated across the platform.

/** The platform materials that take the paint: the deck and the rim's stripes. */
export const PAINTED = new Set(['Deck', 'Stripe']);
/** World units per repeat of the texture: far apart, so the strokes read big. */
export const PAINT_REPEAT = 22;
/** A wall's height is stretched this much in the paint, so the rim's low walls show whole strokes, not a thin band. */
export const PAINT_WALL = 6;
const SIZE = 1024;
const STROKES = 16;
const BRISTLES = 138;

/** A seeded random, so the paint is the same on every load. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Big strokes on the cream: each a curved band of many thin bristle lines carrying more or less paint, so it
 * reads as a brush; drawn at every wrap, so the texture repeats without a seam.
 */
function paint(ctx: CanvasRenderingContext2D): void {
  const rand = seeded(23);
  ctx.fillStyle = WORLD_COLORS.deck;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.lineCap = 'round';
  for (let i = 0; i < STROKES; i++) {
    const x0 = rand() * SIZE;
    const y0 = rand() * SIZE;
    const angle = rand() * Math.PI * 2;
    const length = SIZE * (0.35 + rand() * 0.35);
    const bend = (rand() - 0.5) * length * 0.8;
    const x1 = x0 + Math.cos(angle) * length;
    const y1 = y0 + Math.sin(angle) * length;
    const cx = (x0 + x1) / 2 - Math.sin(angle) * bend;
    const cy = (y0 + y1) / 2 + Math.cos(angle) * bend;
    const width = SIZE * (0.15 + rand() * 0.18);
    ctx.strokeStyle = WORLD_COLORS.paint[i % WORLD_COLORS.paint.length]!;
    for (let b = 0; b < BRISTLES; b++) {
      const off = (b / (BRISTLES - 1) - 0.5) * width;
      const nx = -Math.sin(angle) * off;
      const ny = Math.cos(angle) * off;
      const start = rand() * 0.12;
      const end = 1 - rand() * 0.18;
      const at = (t: number) => {
        const u = 1 - t;
        return [u * u * x0 + 2 * u * t * cx + t * t * x1 + nx, u * u * y0 + 2 * u * t * cy + t * t * y1 + ny] as const;
      };
      ctx.globalAlpha = 0.5 + rand() * 0.4;
      ctx.lineWidth = 1.5 + rand() * 3;
      for (const dx of [-SIZE, 0, SIZE]) {
        for (const dy of [-SIZE, 0, SIZE]) {
          ctx.beginPath();
          const [sx, sy] = at(start);
          ctx.moveTo(sx + dx, sy + dy);
          for (let k = 1; k <= 24; k++) {
            const [px, py] = at(start + ((end - start) * k) / 24);
            ctx.lineTo(px + dx + (rand() - 0.5) * 1.2, py + dy + (rand() - 0.5) * 1.2);
          }
          ctx.stroke();
        }
      }
    }
  }
  ctx.globalAlpha = 1;
}

let made: CanvasTexture | null | undefined;

/** The paint texture, made once; null where there's no canvas (tests, a worker). */
export function paintTexture(): CanvasTexture | null {
  if (made !== undefined) return made;
  made = null;
  if (typeof document === 'undefined') return made;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return made;
  paint(ctx);
  made = new CanvasTexture(canvas);
  made.colorSpace = SRGBColorSpace;
  made.wrapS = RepeatWrapping;
  made.wrapT = RepeatWrapping;
  made.anisotropy = 4;
  return made;
}

/**
 * Texture coordinates for a model that has none: each vertex is projected along its normal's main axis, from
 * above on the deck and from the side on the rim's walls, so the paint never smears into streaks.
 */
export function paintUv(geometry: BufferGeometry): void {
  if (geometry.getAttribute('uv')) return;
  const pos = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const [nx, ny, nz] = normal ? [Math.abs(normal.getX(i)), Math.abs(normal.getY(i)), Math.abs(normal.getZ(i))] : [0, 1, 0];
    const [u, v] = ny >= nx && ny >= nz ? [x, z] : nx >= nz ? [z, y * PAINT_WALL] : [x, y * PAINT_WALL];
    uv[i * 2] = u / PAINT_REPEAT;
    uv[i * 2 + 1] = v / PAINT_REPEAT;
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2));
}

/** A painted copy of a Deck or Stripe material: the paint shows in its own colours. */
export function paintedMaterial(material: MeshStandardMaterial, map: Texture): MeshStandardMaterial {
  const copy = material.clone();
  copy.map = map;
  copy.color.set(1, 1, 1);
  copy.roughness = 0.7;
  return copy;
}
