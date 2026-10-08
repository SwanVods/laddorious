// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NameTags } from '../src/hud/NameTags';
import { createTagRegistry } from '../src/scene/tags';
import { SEATS } from './support/fixtures';

afterEach(cleanup);

describe('NameTags', () => {
  it('pops a rank badge over a non-winner during the ranks reveal, delayed by its turn (polish spec §4.5)', () => {
    const { container } = render(<NameTags seats={SEATS} me="p0" tags={createTagRegistry()} ranks={{ p2: { label: '3rd', delayMs: 500 } }} />);
    const badge = container.querySelector('.rank-badge') as HTMLElement | null;
    expect(badge?.textContent).toBe('3rd');
    expect(badge?.closest('.tag')?.textContent).toContain('Pip');
    expect(badge?.style.animationDelay).toBe('500ms');
  });
});
