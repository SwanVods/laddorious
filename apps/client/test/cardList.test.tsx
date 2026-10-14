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
    expect(items[0]!.textContent).toContain('Leader: −3 on next roll');
    expect(items[1]!.getAttribute('aria-current')).toBe('true');
    expect(items[0]!.getAttribute('aria-current')).toBeNull();
    expect(items[1]!.textContent).toContain(SEATS[0]!.nickname);
  });

  it('shows nothing when there are no cards', () => {
    const { container } = render(<CardList seats={SEATS} cards={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
