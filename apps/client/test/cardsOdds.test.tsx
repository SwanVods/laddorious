// @vitest-environment jsdom
import { CARD_CATALOG } from '@laddorious/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CardsApi } from '../src/cards/api';
import { CardsApp } from '../src/cards/CardsApp';

afterEach(cleanup);
const setup = () => {
  const saveCards = vi.fn<CardsApi['saveCards']>(async () => ({ ok: true, version: 'v2' }));
  render(<CardsApp api={{ loadCards: vi.fn(async () => ({ catalog: structuredClone(CARD_CATALOG), version: 'v1' })), saveCards }} />);
  return { saveCards };
};

describe('the card editor: odds and new cards (2026-10-15)', () => {
  it('changes the "?" square odds and shows them as percentages', async () => {
    const { saveCards } = setup();
    await screen.findByText('Lucky Number');
    fireEvent.change(screen.getByLabelText('Epic weight'), { target: { value: '10' } });
    expect(screen.getByText('Epic: 10 (10%)')).toBeTruthy(); // 10 of 70 + 25 + 10
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(saveCards.mock.calls[0]![0].odds.rarityWeights.epic).toBe(10);
  });

  it('adds a new card as a draft that needs a plan before saving', async () => {
    setup();
    await screen.findByText('Lucky Number');
    fireEvent.click(screen.getByRole('button', { name: 'New card' }));
    expect(screen.getByRole('alert').textContent).toContain('A draft needs a plan');
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'Everyone swaps dice.' } });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('deletes a card only after a second click to confirm', async () => {
    const { saveCards } = setup();
    fireEvent.click(await screen.findByRole('button', { name: /^Moonwalk/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Moonwalk for good' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(saveCards.mock.calls[0]![0].cards.some((c) => c.id === 'moonwalk')).toBe(false);
  });
});
