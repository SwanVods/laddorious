// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NameTags } from '../src/hud/NameTags';
import { createTagRegistry } from '../src/scene/tags';
import { SEATS } from './support/fixtures';

afterEach(cleanup);

describe('NameTags', () => {
  it('shows a card bubble above the caster’s name: medal, name, effect and target (polish spec §4.4)', () => {
    const { container } = render(<NameTags seats={SEATS} me="p0" tags={createTagRegistry()} bubbles={{ p1: { cardId: 'shove', level: 1 } }} />);
    const bubble = container.querySelector('.bubble');
    expect(bubble?.classList.contains('common')).toBe(true);
    expect(bubble?.textContent).toContain('Shove');
    expect(bubble?.textContent).toContain('The nearest player ahead of you moves back 3.');
    expect(bubble?.closest('.tag')?.textContent).toContain('Mochi');
    expect((bubble as HTMLElement).style.getPropertyValue('--level')).toBe('1');
    expect(container.querySelectorAll('.bubble')).toHaveLength(1);
  });

  it('pops a rank badge over a non-winner during the ranks reveal, delayed by its turn (polish spec §4.5)', () => {
    const { container } = render(<NameTags seats={SEATS} me="p0" tags={createTagRegistry()} ranks={{ p2: { label: '3rd', delayMs: 500 } }} />);
    const badge = container.querySelector('.rank-badge') as HTMLElement | null;
    expect(badge?.textContent).toBe('3rd');
    expect(badge?.closest('.tag')?.textContent).toContain('Pip');
    expect(badge?.style.animationDelay).toBe('500ms');
  });

  it('shows no bubble when nobody has a card up', () => {
    const { container } = render(<NameTags seats={SEATS} me="p0" tags={createTagRegistry()} />);
    expect(container.querySelector('.bubble')).toBeNull();
  });
});
