// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpDialog, RULES } from '../src/app/HelpDialog';

afterEach(cleanup);

// The lobby's Help button (the user, 2026-10-17): the rules of the game, in a few short sections.
describe('the Help dialog (2026-10-17)', () => {
  it('lists every section of the rules with its text', () => {
    render(<HelpDialog onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeTruthy();
    for (const rule of RULES) {
      expect(screen.getByRole('heading', { name: rule.title })).toBeTruthy();
      expect(screen.getByText(rule.text)).toBeTruthy();
    }
  });

  it('covers the goal, the dice, rockets and whirlpools, face-offs and cards', () => {
    const all = RULES.map((r) => `${r.title} ${r.text}`).join(' ');
    for (const word of ['100', 'die', 'rocket', 'whirlpool', 'Rock, Paper, Scissors', 'card']) expect(all).toContain(word);
    // Only rockets and whirlpools on this board: no ladders or snakes.
    expect(all).not.toMatch(/ladder|snake/i);
  });

  it('closes from its close button', () => {
    const onClose = vi.fn();
    render(<HelpDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
