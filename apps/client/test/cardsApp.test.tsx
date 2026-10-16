// @vitest-environment jsdom
import { CARD_CATALOG } from '@laddorious/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardsApp } from '../src/cards/CardsApp';

afterEach(cleanup);
const api = () => ({ loadCards: vi.fn(async () => ({ catalog: structuredClone(CARD_CATALOG), version: 'v1' })), saveCards: vi.fn() });

describe('the card editor: the list (2026-10-15)', () => {
  it('lists every card with its counts by status', async () => {
    render(<CardsApp api={api()} />);
    expect(await screen.findByText('Lucky Number')).toBeTruthy();
    expect(screen.getByText('66 on · 0 drafts · 2 off')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(68);
  });

  it('filters by status and searches by name or note', async () => {
    render(<CardsApp api={api()} />);
    await screen.findByText('Lucky Number');
    // Every card is on or off now (2026-10-16: no drafts left): the Off filter shows the two kept off.
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search cards' }), { target: { value: 'ular' } });
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(screen.queryByText('Lucky Number')).toBeNull();
  });

  it("shows each card's generated text", async () => {
    render(<CardsApp api={api()} />);
    expect(await screen.findByText('Your next die shows 1–6.')).toBeTruthy();
  });
});
