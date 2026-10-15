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

describe('the card editor: editing (2026-10-15)', () => {
  it('buffs Sprint: the preview follows, and Save sends the change', async () => {
    const { saveCards } = setup();
    fireEvent.click(await screen.findByRole('button', { name: /^Sprint/ }));
    fireEvent.change(screen.getByLabelText('Move: amount'), { target: { value: '4' } });
    expect(screen.getByTestId('card-preview').textContent).toContain('Move forward 4.');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    const sent = saveCards.mock.calls[0]![0];
    expect(sent.cards.find((c) => c.id === 'sprint')!.effects).toEqual([{ op: 'moveRelative', amount: 4 }]);
    expect(saveCards.mock.calls[0]![1]).toBe('v1');
  });

  it("won't save while a card has a problem, and says which", async () => {
    const { saveCards } = setup();
    fireEvent.click(await screen.findByRole('button', { name: /^Lucky Number/ }));
    fireEvent.change(screen.getByLabelText('Value n: lowest'), { target: { value: '7' } });
    expect(screen.getByRole('alert').textContent).toContain('Value n: the lowest (7) is above the highest (6).');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(saveCards).not.toHaveBeenCalled();
  });

  it('switches a card off', async () => {
    const { saveCards } = setup();
    fireEvent.click(await screen.findByRole('button', { name: /^Dash/ }));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'off' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Saved.');
    expect(saveCards.mock.calls[0]![0].cards.find((c) => c.id === 'dash')!.status).toBe('off');
  });
});
