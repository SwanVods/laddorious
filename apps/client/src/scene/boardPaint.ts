import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector3, type BufferGeometry, type Texture } from 'three';
import { WORLD_COLORS } from '../app/theme';
import { PLATFORM } from './layout';

// The painted platform (the user, 2026-10-16): big, colourful brush strokes over the cream deck and the rim,
// in place of its plain cream and red stripes. One texture, painted in code once, repeated across the platform.

/** The platform materials that take the paint: the deck and the rim's stripes. */
export const PAINTED = new Set(['Deck', 'Stripe']);
/** World units per repeat of the texture on the board's platform: far apart, so the strokes read big. */
export const PAINT_REPEAT = 22;
/** The board platform's width; a smaller model (the lobby podium) repeats the paint as much closer (2026-10-16). */
export const PLATFORM_WIDTH = PLATFORM.halfWidth * 2;
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
 * The paint, read in the shader from the model's own position (the model has no texture coordinates): from above,
 * and from either side, each weighted by how much the point faces that way, then mixed. It flows round the rim's
 * curve without a seam (the user, 2026-10-16: projecting each triangle one way cut it into patches) and never
 * smears down a wall. The sides' heights are stretched, so a low wall shows whole strokes.
 */
const triplanar = (repeat: number) => [
  'vec3 paintWeight = pow( abs( normalize( vPaintNormal ) ), vec3( 4.0 ) );',
  'paintWeight /= paintWeight.x + paintWeight.y + paintWeight.z;',
  `vec3 paintAt = vPaintPos / ${repeat.toFixed(2)};`,
  `float paintWall = ${PAINT_WALL.toFixed(1)};`,
  'vec4 paintTexel = texture2D( paintMap, vec2( paintAt.z, paintAt.y * paintWall ) ) * paintWeight.x',
  '  + texture2D( paintMap, paintAt.xz ) * paintWeight.y',
  '  + texture2D( paintMap, vec2( paintAt.x, paintAt.y * paintWall ) ) * paintWeight.z;',
  'diffuseColor *= paintTexel;',
].join('\n');

/** How often the paint repeats on a model: in step with its width, so any platform shows the same big strokes. */
export function paintRepeat(geometry: BufferGeometry): number {
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(new Vector3());
  return (PAINT_REPEAT * Math.max(size.x, size.z)) / PLATFORM_WIDTH;
}

/** A painted copy of a Deck or Stripe material: the paint shows in its own colours, blended as above. */
export function paintedMaterial(material: MeshStandardMaterial, map: Texture, repeat = PAINT_REPEAT): MeshStandardMaterial {
  const copy = material.clone();
  copy.color.set(1, 1, 1);
  copy.roughness = 0.7;
  copy.onBeforeCompile = (shader) => {
    shader.uniforms.paintMap = { value: map };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaintPos;\nvarying vec3 vPaintNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintPos = position;\nvPaintNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D paintMap;\nvarying vec3 vPaintPos;\nvarying vec3 vPaintNormal;')
      .replace('#include <map_fragment>', triplanar(repeat));
  };
  copy.customProgramCacheKey = () => `board-paint-${repeat.toFixed(2)}`;
  return copy;
}
