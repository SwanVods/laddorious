import type { Rarity } from '@laddorious/core';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { COLUMNS, TILE_SIZE, tileToWorld } from './layout';

/** Paint a canvas texture, or return null where there is no DOM (tests) or no 2D context. */
function paint(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const BOARD_PX = 1024;

/** The game's display face for the numbers and "?" glyphs, with fallbacks while it loads (2026-10-15). */
const BOARD_FONT = "'Lilita One', 'Arial Rounded MT Bold', system-ui, sans-serif";

/**
 * All tile numbers and "?" glyphs in one transparent texture over the board (spec #2 §6.1): in the game's
 * display face once the web fonts have loaded, in the system's until then (the board paints again). An epic
 * "?" stands out (2026-10-17): a little bigger, filled with `epic`'s gradient, and glowing.
 */
export function boardOverlayTexture(size: number, mystery: Record<number, Rarity>, glyph: Record<Rarity, string>, ink: string, fontsLoaded = true, epic?: readonly [string, string]): CanvasTexture | null {
  const face = fontsLoaded ? BOARD_FONT : 'system-ui, sans-serif';
  const span = TILE_SIZE * COLUMNS;
  const cell = BOARD_PX / COLUMNS;
  return paint(BOARD_PX, BOARD_PX, (ctx) => {
    ctx.textBaseline = 'middle';
    for (let tile = 1; tile <= size; tile++) {
      const [x, , z] = tileToWorld(tile);
      const px = (x / span + 0.5) * BOARD_PX;
      const py = (z / span + 0.5) * BOARD_PX;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = ink;
      ctx.textAlign = 'left';
      ctx.font = `${Math.round(cell * 0.26)}px ${face}`;
      ctx.fillText(String(tile), px - cell * 0.42, py - cell * 0.32);
      ctx.globalAlpha = 1;
      const rarity = mystery[tile];
      if (rarity) {
        const shines = rarity === 'epic' && epic !== undefined;
        const y = py + cell * 0.04;
        ctx.textAlign = 'center';
        ctx.font = `${Math.round(cell * (shines ? 0.7 : 0.62))}px ${face}`;
        ctx.lineWidth = cell * (shines ? 0.08 : 0.06);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = ink;
        if (shines) {
          // A bright halo, twice over so it reads at a distance.
          ctx.save();
          ctx.shadowColor = epic[0];
          ctx.shadowBlur = cell * 0.22;
          ctx.strokeText('?', px, y);
          ctx.strokeText('?', px, y);
          ctx.restore();
          // Top to bottom across the glyph itself, leaning a little like the card's frame.
          const h = cell * 0.2;
          const fill = ctx.createLinearGradient(px - h * 0.3, y - h, px + h * 0.3, y + h);
          fill.addColorStop(0, epic[0]);
          fill.addColorStop(1, epic[1]);
          ctx.fillStyle = fill;
        } else {
          ctx.strokeText('?', px, y);
          ctx.fillStyle = glyph[rarity];
        }
        ctx.fillText('?', px, y);
      }
    }
  });
}

/** A three-armed spiral for the vortex at a slide's head. */
export type EndIcon = 'rocket' | 'flag' | 'swirl' | 'splat';

/**
 * A ladder's or portal's end drawn flat for Low quality (Step 2, round 5): light with a grey outline on a
 * clear ground, so the instance colour paints it its pair's colour. Its top is the board's far side.
 */
export function endIconTexture(kind: EndIcon, light: string, shade: string): CanvasTexture | null {
  return paint(128, 128, (ctx) => {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = shade;
    ctx.fillStyle = light;
    const shape = (draw: () => void) => {
      ctx.beginPath();
      draw();
      ctx.fill();
      ctx.stroke();
    };
    if (kind === 'rocket') {
      shape(() => {
        ctx.moveTo(38, 104);
        ctx.lineTo(26, 120);
        ctx.lineTo(48, 108);
      });
      shape(() => {
        ctx.moveTo(90, 104);
        ctx.lineTo(102, 120);
        ctx.lineTo(80, 108);
      });
      shape(() => {
        ctx.moveTo(64, 8);
        ctx.bezierCurveTo(96, 30, 92, 88, 82, 110);
        ctx.lineTo(46, 110);
        ctx.bezierCurveTo(36, 88, 32, 30, 64, 8);
      });
      ctx.fillStyle = shade;
      shape(() => ctx.arc(64, 50, 15, 0, Math.PI * 2));
      ctx.fillStyle = light;
      shape(() => ctx.arc(64, 50, 10, 0, Math.PI * 2));
    } else if (kind === 'flag') {
      shape(() => ctx.ellipse(40, 112, 18, 8, 0, 0, Math.PI * 2));
      shape(() => ctx.rect(36, 14, 8, 98));
      shape(() => {
        ctx.moveTo(44, 16);
        ctx.bezierCurveTo(64, 6, 84, 26, 112, 16);
        ctx.lineTo(112, 60);
        ctx.bezierCurveTo(84, 70, 64, 50, 44, 60);
      });
    } else if (kind === 'swirl') {
      shape(() => ctx.arc(64, 64, 60, 0, Math.PI * 2));
      ctx.lineWidth = 9;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) {
          const r = 14 + (44 * i) / 30;
          const a = 1.6 * Math.log(r / 14) + (k * Math.PI * 2) / 3;
          if (i === 0) ctx.moveTo(64 + r * Math.cos(a), 64 + r * Math.sin(a));
          else ctx.lineTo(64 + r * Math.cos(a), 64 + r * Math.sin(a));
        }
        ctx.stroke();
      }
    } else {
      shape(() => {
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const r = 42 + 8 * Math.sin(5 * a + 0.6) + 5 * Math.sin(9 * a + 1.3);
          if (i === 0) ctx.moveTo(64 + r * Math.cos(a), 64 + r * Math.sin(a));
          else ctx.lineTo(64 + r * Math.cos(a), 64 + r * Math.sin(a));
        }
        ctx.closePath();
      });
      for (const [x, y, r] of [[112, 40, 6], [18, 76, 5], [100, 108, 5]]) shape(() => ctx.arc(x!, y!, r!, 0, Math.PI * 2));
    }
  });
}

export function swirlTexture(base: string, arm: string): CanvasTexture | null {
  return paint(128, 128, (ctx) => {
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = arm;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2.2 + (k * Math.PI * 2) / 3;
        const r = 6 + (i / 40) * 54;
        if (i === 0) ctx.moveTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
        else ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      ctx.stroke();
    }
  });
}

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

/** The 3×2 pip atlas the die faces map into: face n in cell n − 1, row 0 at the bottom. */
export function dieAtlasTexture(face: string, pip: string): CanvasTexture | null {
  return paint(384, 256, (ctx) => {
    for (let n = 1; n <= 6; n++) {
      const cell = n - 1;
      const x0 = (cell % 3) * 128;
      const y0 = (1 - Math.floor(cell / 3)) * 128;
      ctx.fillStyle = face;
      ctx.fillRect(x0, y0, 128, 128);
      ctx.fillStyle = pip;
      for (const [u, v] of PIPS[n]!) {
        ctx.beginPath();
        ctx.arc(x0 + u * 128, y0 + v * 128, 13, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
}

/** The sky behind everything: teal at the top melting into apricot at the horizon (spec #2 §7.4). */
export function skyTexture(stops: readonly string[]): CanvasTexture | null {
  return paint(2, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    stops.forEach((color, i) => gradient.addColorStop(i / (stops.length - 1), color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
  });
}

/**
 * The shine that sweeps across an Epic "?" tile (2026-10-14): one slanted soft band of `light` in an
 * otherwise empty strip. Scrolling its offset sweeps the band across, then leaves a pause before the next.
 */
export function sheenTexture(light: string): CanvasTexture | null {
  const texture = paint(256, 64, (ctx) => {
    ctx.fillStyle = light;
    ctx.setTransform(1, 0, -0.6, 1, 0, 0);
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = Math.sin((Math.PI * i) / 40) ** 2;
      ctx.fillRect(20 + i * 1.5, 0, 1.6, 64);
    }
  });
  if (texture) texture.wrapS = RepeatWrapping;
  return texture;
}

/**
 * A soft contact shadow (2026-10-16): faint circles of `ink` stacked from the edge in, so it builds to its darkest
 * in the middle and fades to nothing at the rim.
 */
export function blobTexture(ink: string): CanvasTexture | null {
  const size = 128;
  return paint(size, size, (ctx) => {
    ctx.fillStyle = ink;
    const rings = 36;
    for (let i = 0; i < rings; i++) {
      ctx.globalAlpha = 0.05;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, (size / 2) * (1 - i / rings), 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
