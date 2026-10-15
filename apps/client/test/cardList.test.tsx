// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CardList } from '../src/hud/CardList';
import { SEATS } from './support/fixtures';

afterEach(cleanup);

// On phones the card info is a compact list under the action log (the user, 2026-10-15).
describe('CardList', () => {
  it('lists the cards in resolution order, one line each, marking the one resolving and showing results', () => {
    render(
      <CardList
        seats={SEATS}
        cards={[
          { caster: 'p2', cardId: 'heavy-boots', result: 'hit', current: false },
          { caster: 'p0', cardId: 'shove', result: null, current: true },
          { caster: 'p1', cardId: 'shield', result: null, current: false },
        ]}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'Cards this round' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Heavy Boots'),
      expect.stringContaining('Shove'),
      expect.stringContaining('Shield'),
    ]);
    expect(items[0]!.textContent).toContain('Hit');
    expect(items[0]!.textContent).toContain("The leader's next dice total is reduced by 3.");
    expect(items[1]!.getAttribute('aria-current')).toBe('true');
    expect(items[0]!.getAttribute('aria-current')).toBeNull();
    expect(items[1]!.textContent).toContain(SEATS[0]!.nickname);
  });

  it('draws each card as a little card: its caster and name on top, what it does on a line of its own (2026-10-15)', () => {
    render(<CardList seats={SEATS} cards={[{ caster: 'p2', cardId: 'heavy-boots', result: 'hit', current: false }]} />);
    const item = screen.getByRole('listitem');
    expect(item.classList.contains('card-bubble')).toBe(true);
    expect(within(item).getByText('Heavy Boots').closest('.card-line-title')).not.toBeNull();
    expect(within(item).getByText("The leader's next dice total is reduced by 3.").classList.contains('card-line-gist')).toBe(true);
  });

  it('shows nothing when there are no cards', () => {
    const { container } = render(<CardList seats={SEATS} cards={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
