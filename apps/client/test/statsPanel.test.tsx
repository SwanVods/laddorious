// @vitest-environment jsdom
import { CARD_CATALOG } from '@laddorious/core';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatsPanel, fetchSummary, type StatsSummary } from '../src/cards/StatsPanel';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// The card editor's player stats (the user, 2026-10-17): totals from real matches, read with the stats key.

const SUMMARY: StatsSummary = {
  mode: 'all',
  matches: [
    { mode: 'offline', status: 'finished', matches: 8, avgRounds: 12.4, avgDurationMs: 410_000, humanWins: 3 },
    { mode: 'quick', status: 'abandoned', matches: 2, avgRounds: 4, avgDurationMs: 90_000, humanWins: 0 },
  ],
  players: { players: 5, leftEarly: 1 },
  cards: [{ cardId: 'sprint', rarity: 'common', offered: 20, picked: 10, auto: 2, hit: 9, blocked: 0, fizzled: 1, wins: 4 }],
};

function fill() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Game address' }), { target: { value: 'https://game.example' } });
  fireEvent.change(screen.getByLabelText('Stats key'), { target: { value: 'sekret' } });
}

describe("the card editor's player stats (2026-10-17)", () => {
  it('loads the totals with the address and key, for the chosen matches', async () => {
    const load = vi.fn(async () => SUMMARY);
    render(<StatsPanel catalog={CARD_CATALOG} load={load} />);
    fill();
    fireEvent.change(screen.getByRole('combobox', { name: 'Matches' }), { target: { value: 'offline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load player stats' }));
    expect(await screen.findByText('10 matches · 5 players')).toBeTruthy();
    expect(load).toHaveBeenCalledWith('https://game.example', 'sekret', 'offline');
    const row = within(screen.getByRole('table')).getByText('Sprint').closest('tr')!;
    // Shown, picked, pick rate, played out (hit · blocked · fizzled), timed-out picks, win rate when picked.
    expect([...row.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['Sprint', 'common', '20', '10', '50%', '9 · 0 · 1', '2', '40%']);
    expect(screen.getByText(/Offline finished: 8 matches, 12\.4 rounds, 6\.8 min, real players won 3/)).toBeTruthy();
    expect(screen.getByText(/Quick match abandoned: 2 matches/)).toBeTruthy();
  });

  it('remembers the address and key in this browser', async () => {
    const { unmount } = render(<StatsPanel catalog={CARD_CATALOG} load={vi.fn(async () => SUMMARY)} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Load player stats' }));
    await screen.findByText('10 matches · 5 players');
    unmount();
    render(<StatsPanel catalog={CARD_CATALOG} load={vi.fn(async () => SUMMARY)} />);
    expect((screen.getByRole('textbox', { name: 'Game address' }) as HTMLInputElement).value).toBe('https://game.example');
    expect((screen.getByLabelText('Stats key') as HTMLInputElement).value).toBe('sekret');
  });

  it('says what went wrong instead of a table', async () => {
    render(<StatsPanel catalog={CARD_CATALOG} load={vi.fn(async () => Promise.reject(new Error('Wrong stats key')))} />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Load player stats' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Wrong stats key');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('asks the server with the key, and explains a refused key', async () => {
    const ok = vi.fn(async () => Response.json(SUMMARY));
    await expect(fetchSummary('https://game.example/', 'sekret', 'online', ok)).resolves.toEqual(SUMMARY);
    expect(ok).toHaveBeenCalledWith('https://game.example/api/stats/summary?mode=online', { headers: { authorization: 'Bearer sekret' } });
    await expect(fetchSummary('https://game.example', 'nope', 'all', vi.fn(async () => new Response('', { status: 401 })))).rejects.toThrow('Wrong stats key');
    await expect(fetchSummary('https://game.example', 'k', 'all', vi.fn(async () => new Response('', { status: 500 })))).rejects.toThrow('The server answered 500');
  });
});
