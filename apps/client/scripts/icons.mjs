// The app icon (the user, 2026-10-16): a red rocket blasting up out of a mint whirlpool, on tangerine. Draws it
// once and writes every file the page and the manifest use into public/: the SVG favicon, a classic favicon.ico,
// and PNGs for phones. Run with `pnpm --filter @laddorious/client icons` after changing the drawing.
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const PUBLIC = new URL('../public/', import.meta.url);
const INK = '#0f2e36';
const MINT = '#5ff0c5';
const RED = '#ff5470';
const CREAM = '#fff7ec';
const GOLD = '#ffcc33';
const TANGERINE = '#ff7a1a';

/** The launch rocket (art/models/pad.py): a rounded body, swept fins, a cream porthole, a gold flame. Nose up round (0, 0). */
function rocket({ x, y, scale }) {
  const w = 3 / scale;
  return `<g transform="translate(${x} ${y}) scale(${scale})" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round">
    <path d="M-5 9 C-5 16 -2.5 20 0 26 C2.5 20 5 16 5 9 Z" fill="${GOLD}"/>
    <path d="M-7 0 C-12.5 3 -14.5 9 -14.5 15 L-7 10.5 Z M7 0 C12.5 3 14.5 9 14.5 15 L7 10.5 Z" fill="${RED}"/>
    <path d="M0 -19 C8.5 -12 9.5 -2 8.2 10 L-8.2 10 C-9.5 -2 -8.5 -12 0 -19 Z" fill="${RED}"/>
    <circle cx="0" cy="-2.5" r="4.3" fill="${CREAM}"/>
    <path d="M-4.6 -9 C-4 -12 -2.4 -14.2 -1 -15.4" fill="none" stroke="#ffffff" stroke-width="${1.8 / scale}" stroke-linecap="round" opacity="0.7"/>
  </g>`;
}

/** A whirlpool seen at a slant (art/models/vortex.py): three arms spiral in to a cream eye. */
function whirlpool({ cx, cy, r, squash }) {
  const arms = [0, 1, 2].map((a) => {
    const points = Array.from({ length: 41 }, (_, i) => {
      const t = i / 40;
      const theta = (a * 2 * Math.PI) / 3 + t * 1.35 * Math.PI;
      const rad = r * (0.28 + 0.72 * t);
      return `${(cx + rad * Math.cos(theta)).toFixed(2)} ${(cy + rad * Math.sin(theta) * squash).toFixed(2)}`;
    });
    return `M${points.join(' L')}`;
  });
  const d = arms.join(' ');
  return `<ellipse cx="${cx}" cy="${cy}" rx="${r + 3}" ry="${(r + 3) * squash}" fill="${INK}" opacity="0.28"/>
    <path d="${d}" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="${MINT}" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${r * 0.3}" ry="${r * 0.3 * squash}" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>`;
}

const picture = `${whirlpool({ cx: 32, cy: 50, r: 20, squash: 0.42 })}
  ${rocket({ x: 32, y: 22, scale: 0.92 })}`;

/** On a rounded tangerine tile with an ink rim, on a 64-unit grid: tabs and Android. */
const tile = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="60" height="60" rx="14" fill="${TANGERINE}" stroke="${INK}" stroke-width="4"/>
  ${picture}
</svg>
`;

/** Edge to edge, the picture shrunk into the middle, for phones that cut their own shape (iPhone, maskable Android). */
const fullBleed = (shrink) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <rect width="64" height="64" fill="${TANGERINE}"/>
  <g transform="translate(32 32) scale(${shrink}) translate(-32 -32)">${picture}</g>
</svg>
`;

const browser = await chromium.launch();
const page = await browser.newPage();
/** The SVG drawn at size pixels square, as a PNG with clear corners. */
async function png(svg, size) {
  await page.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  return page.locator('svg').screenshot({ omitBackground: true });
}

/** An .ico holding PNGs: a 6-byte header, a 16-byte entry each, then the images. */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size % 256, at);
    header.writeUInt8(size % 256, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

const write = (name, data) => writeFileSync(new URL(name, PUBLIC), data);
write('favicon.svg', tile);
write('favicon.ico', ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(tile, size) })))));
write('icon-192.png', await png(tile, 192));
write('icon-512.png', await png(tile, 512));
write('icon-maskable-512.png', await png(fullBleed(0.78), 512));
write('apple-touch-icon.png', await png(fullBleed(0.86), 180));
await browser.close();
console.log('icons written to public/');
