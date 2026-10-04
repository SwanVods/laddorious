// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Director } from '../src/director/director';
import { MatchScene, WEBGL_MESSAGE } from '../src/scene/MatchScene';
import { SEATS, openingUpdate } from './support/fixtures';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('shows a message instead of the board when the browser has no WebGL (spec #2 §8)', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const director = new Director('p0', () => {});
  director.push(openingUpdate());
  render(<MatchScene director={director} seats={SEATS} me="p0" setting="auto" />);
  expect(screen.getByText(WEBGL_MESSAGE)).toBeTruthy();
});
