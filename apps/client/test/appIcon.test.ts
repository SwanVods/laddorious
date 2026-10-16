import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The app icon (the user, 2026-10-16): a red rocket blasting out of a mint whirlpool on tangerine. The page links
// a favicon for tabs and an icon for phones; the manifest gives the home-screen sizes.

const client = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const html = readFileSync(client('index.html'), 'utf8');
const linked = (rel: string) => html.match(new RegExp(`<link rel="${rel}"[^>]*href="/([^"]+)"`))?.[1];
/** A PNG's width and height, from its header. */
const pngSize = (path: string) => {
  const png = readFileSync(client(`public/${path}`));
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};

describe('the app icon', () => {
  it('links a favicon, an iPhone icon and a manifest that all exist', () => {
    for (const rel of ['icon', 'apple-touch-icon', 'manifest']) {
      const path = linked(rel);
      expect(path, rel).toBeTruthy();
      expect(existsSync(client(`public/${path}`)), path).toBe(true);
    }
    expect(pngSize(linked('apple-touch-icon')!)).toEqual([180, 180]);
  });

  it('gives phones the sizes it names', () => {
    const manifest = JSON.parse(readFileSync(client(`public/${linked('manifest')}`), 'utf8'));
    expect(manifest.name).toBe('Laddorious');
    for (const icon of manifest.icons) {
      const [w] = icon.sizes.split('x').map(Number);
      expect(pngSize(icon.src.replace(/^\//, '')), icon.src).toEqual([w, w]);
    }
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});
