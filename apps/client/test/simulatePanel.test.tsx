// @vitest-environment jsdom
import { CARD_CATALOG } from '@laddorious/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulatePanel } from '../src/cards/SimulatePanel';

afterEach(cleanup);
const stat = (cardId: string, winRate: number, flag: 'strong' | 'weak' | null = null) => ({ cardId, dealt: 100, picked: 40, resolved: 40, hit: 40, blocked: 0, fizzled: 0, avgTiles: 3, playedBy: 40, wins: Math.round(40 * winRate), winRate, flag });

describe('Simulate (2026-10-15)', () => {
  it('runs bot matches with the cards on screen and flags outliers', async () => {
    const run = vi.fn(async () => [stat('jackpot', 0.5, 'strong'), stat('moonwalk', 0.1, 'weak')]);
    render(<SimulatePanel catalog={CARD_CATALOG} run={run} />);
    fireEvent.click(screen.getByRole('button', { name: 'Simulate 1,000 matches' }));
    expect(await screen.findByText('Jackpot!')).toBeTruthy();
    expect(screen.getByText('Strong')).toBeTruthy();
    expect(screen.getByText('Weak')).toBeTruthy();
    expect(run).toHaveBeenCalledWith(CARD_CATALOG, 1000, expect.any(Function));
  });

  it("shows the last run's win rate beside the new one", async () => {
    const run = vi.fn().mockResolvedValueOnce([stat('jackpot', 0.5)]).mockResolvedValueOnce([stat('jackpot', 0.3)]);
    render(<SimulatePanel catalog={CARD_CATALOG} run={run} />);
    fireEvent.click(screen.getByRole('button', { name: 'Simulate 1,000 matches' }));
    await screen.findByText('50%');
    fireEvent.click(screen.getByRole('button', { name: 'Simulate 1,000 matches' }));
    expect(await screen.findByText('30% (was 50%)')).toBeTruthy();
  });
});
