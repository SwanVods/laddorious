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

describe('the card editor: filter and sort by rarity and type (2026-10-16)', () => {
  /** Each listed card's rarity and type, from its row, in list order. */
  const rows = () => screen.getAllByRole('listitem').map((li) => li.querySelector('.card-row-meta')!.textContent!.split(' · ').slice(0, 2));
  const count = (kind: 'rarity' | 'type', value: string) => CARD_CATALOG.cards.filter((c) => c[kind] === value).length;

  it('filters by rarity and by type, together', async () => {
    render(<CardsApp api={api()} />);
    await screen.findByText('Lucky Number');
    fireEvent.change(screen.getByRole('combobox', { name: 'Rarity' }), { target: { value: 'epic' } });
    expect(rows()).toHaveLength(count('rarity', 'epic'));
    expect(rows().every(([rarity]) => rarity === 'epic')).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'attack' } });
    expect(rows().every(([rarity, type]) => rarity === 'epic' && type === 'attack')).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: 'Rarity' }), { target: { value: 'all' } });
    expect(rows()).toHaveLength(count('type', 'attack'));
  });

  it('sorts by rarity, or by type, and back to the card file order', async () => {
    render(<CardsApp api={api()} />);
    await screen.findByText('Lucky Number');
    const fileOrder = screen.getAllByRole('listitem').map((li) => li.textContent);
    const sort = screen.getByRole('combobox', { name: 'Sort' });
    fireEvent.change(sort, { target: { value: 'rarity' } });
    const rarities = rows().map(([rarity]) => ['common', 'rare', 'epic'].indexOf(rarity!));
    expect(rarities).toEqual([...rarities].sort((a, b) => a - b));
    fireEvent.change(sort, { target: { value: 'type' } });
    const types = rows().map(([, type]) => ['movement', 'defense', 'attack', 'risky', 'misc'].indexOf(type!));
    expect(types).toEqual([...types].sort((a, b) => a - b));
    fireEvent.change(sort, { target: { value: 'file' } });
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(fileOrder);
  });
});
