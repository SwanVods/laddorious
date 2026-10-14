import { describe, expect, it } from 'vitest';
import { PODIUM_COLORS } from '../src/app/theme';

// Every source file's text, read through Vite's raw imports.
const SOURCES = import.meta.glob<string>('../src/**/*.{css,ts,tsx}', { query: '?raw', import: 'default', eager: true });
/** The only files allowed to spell out a colour (spec #2 §7.4). */
const THEME_FILES = new Set(['../src/app/theme.ts', '../src/app/theme.css']);
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

describe('design tokens (spec #2 §7.4)', () => {
  it('keeps every colour in the theme files', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
    const offenders = Object.entries(SOURCES)
      .filter(([file]) => !THEME_FILES.has(file))
      .flatMap(([file, text]) =>
        text
          .split('\n')
          .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
          .filter((l) => COLOUR.test(l.text)),
      );
    expect(offenders).toEqual([]);
  });

  it('has the Tangerine Dusk podium colours', () => {
    expect(PODIUM_COLORS).toEqual({ top: '#fff3e3', band: '#ff9a3d', base: '#147676', ring: '#ff5470' });
  });
});
