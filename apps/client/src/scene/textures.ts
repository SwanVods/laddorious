import type { Rarity } from '@laddorious/core';
import { CanvasTexture, SRGBColorSpace } from 'three';
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

/** All tile numbers and "?" glyphs in one transparent texture over the board (spec #2 §6.1). */
export function boardOverlayTexture(size: number, mystery: Record<number, Rarity>, glyph: Record<Rarity, string>, ink: string): CanvasTexture | null {
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
      ctx.font = `bold ${Math.round(cell * 0.24)}px system-ui, sans-serif`;
      ctx.fillText(String(tile), px - cell * 0.42, py - cell * 0.32);
      ctx.globalAlpha = 1;
      const rarity = mystery[tile];
      if (rarity) {
        ctx.textAlign = 'center';
        ctx.font = `900 ${Math.round(cell * 0.62)}px system-ui, sans-serif`;
        ctx.lineWidth = cell * 0.06;
        ctx.strokeStyle = ink;
        ctx.strokeText('?', px, py + cell * 0.04);
        ctx.fillStyle = glyph[rarity];
        ctx.fillText('?', px, py + cell * 0.04);
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
