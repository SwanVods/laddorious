// @vitest-environment jsdom
import type { ActiveEffect, PlayerView } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presentationFromView } from '../src/director/presentation';
import { EventFeed } from '../src/hud/EventFeed';
import type { FeedLine } from '../src/hud/feed';
import { nextRollMods } from '../src/hud/labels';
import { playerRows, type PlayerRow } from '../src/hud/model';
import { LONG_PRESS_MS, PlayerColumn } from '../src/hud/PlayerColumn';
import type { RoundRecord } from '../src/hud/record';
import { StageBar } from '../src/hud/StageBar';
import { YourPiece } from '../src/hud/YourPiece';
import { SEATS, openingUpdate } from './support/fixtures';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** jsdom has no matchMedia: answer every query with `matches`. */
function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })),
  );
}

function view(positions: Record<string, number>, change: Partial<PlayerView> = {}): PlayerView {
  const base = openingUpdate().view;
  return { ...base, players: base.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })), ...change };
}

const effect = (over: Partial<ActiveEffect>): ActiveEffect => ({
  id: 'e1',
  owner: 'p0',
  sourceCard: 'shield',
  sourcePlayer: 'p0',
  params: { hook: 'beforeAttack' },
  lifetime: { rounds: 3, charges: 1 },
  createdRound: 1,
  seq: 1,
  ...over,
});

/**
 * A Mystery window in round 3: You (p0) still pick on a Rare "?" square at tile 5; Mochi (p1)
 * has picked, face down, and wears a Shield; Pip (p2) rolled 5 but moves 2; Juno's (p3)
 * Sprint resolved as a hit.
 */
function mysteryRows(watch: string | null = null): PlayerRow[] {
  const base = view({ p0: 5, p1: 9, p2: 12, p3: 2 });
  const v: PlayerView = {
    ...base,
    board: { ...base.board, mystery: { ...base.board.mystery, 5: 'rare' } },
    effects: [effect({ owner: 'p1', sourcePlayer: 'p1' })],
    phase: { kind: 'mysterySelect', picked: { p0: false, p1: true } },
    awaiting: { windowId: 9, window: 'mystery', players: ['p0'], durationMs: 15_000 },
  };
  const record: RoundRecord = { round: 3, dice: { p2: { faces: [5], forced: [false], total: 2 } }, cards: { p3: { cardId: 'sprint', result: 'hit' } } };
  return playerRows({ view: v, presentation: presentationFromView(v), record, seats: SEATS, me: 'p0', watch });
}

const rowOf = (name: RegExp) => screen.getByRole('button', { name });

describe('StageBar (spec #2 §7.2)', () => {
  it('names only the current stage, marks the past ones done, and turns the timer coral at 3 s', () => {
    const { container, rerender } = render(<StageBar round={7} stage={2} timer={{ seconds: 3, fraction: 0.375 }} />);
    expect(container.querySelector('.stage-round')!.textContent).toBe('ROUND 7');
    const steps = within(screen.getByRole('list', { name: 'Stages of the round' })).getAllByRole('listitem');
    expect(steps.map((s) => s.className)).toEqual(['done', 'done', 'now', 'next', 'next']);
    expect(steps[2]!.getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('timer', { name: '3 seconds left' }).querySelector('.stage-tbar')!.className).toContain('low');
    rerender(<StageBar round={7} stage={0} timer={null} />);
    expect(screen.queryByRole('timer')).toBeNull();
  });
});

describe('EventFeed (spec #2 §7.2)', () => {
  it('lists the lines newest first, dashes private ones and draws names in their seat colour', () => {
    const lines: FeedLine[] = [
      { seq: 9, parts: ['You picked ', 'Rock'], private: true },
      { seq: 8, parts: [{ player: 'p1' }, ' rolled 4'], private: false },
    ];
    render(<EventFeed lines={lines} seats={SEATS} />);
    const items = within(screen.getByRole('list', { name: 'What just happened' })).getAllByRole('listitem');
    expect(items.map((li) => [li.textContent, li.className])).toEqual([
      ['You picked Rock', 'feed-line private'],
      ['Mochi rolled 4', 'feed-line'],
    ]);
    expect(items[1]!.querySelector<HTMLElement>('.who')!.style.getPropertyValue('--seat')).toBe(SEATS[1]!.color);
  });
});

describe('PlayerColumn (spec #2 §7.2, §9.2)', () => {
  it('marks an away player with an Away badge (spec #4 §3.3)', () => {
    const v = view({ p0: 4, p1: 9 });
    const rows = playerRows({ view: v, presentation: presentationFromView(v), record: { round: 1, dice: {}, cards: {} }, seats: SEATS, me: 'p0', watch: null, away: ['p1'] });
    expect(rows.map((r) => [r.seat.playerId, r.away])).toEqual([['p1', true], ['p0', false], ['p2', false], ['p3', false]]);
    render(<PlayerColumn rows={rows} onWatch={() => {}} reducedMotion={false} />);
    const mochi = rowOf(/^Mochi, tile 9, rank 1, away\./);
    expect(within(mochi).getByText('Away')).toBeTruthy();
    expect(within(rowOf(/^You \(you\)/)).queryByText('Away')).toBeNull();
  });

  it('lists the players front-runner first, with rank badges and my row marked', () => {
    render(<PlayerColumn rows={mysteryRows()} onWatch={() => {}} reducedMotion={false} />);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')!.split(',')[0]);
    expect(names).toEqual(['Pip', 'Mochi', 'You (you)', 'Juno']);
    expect(['Pip', 'Mochi', 'You', 'Juno'].map((n) => rowOf(new RegExp(`^${n}`)).querySelector('.portrait-badge')!.textContent)).toEqual(['1', '2', '3', '4']);
    expect(rowOf(/^You/).className).toContain('me');
  });

  it("shows this round's dice, the \"?\" chip, effect chips and the face-down and revealed card chips", () => {
    render(<PlayerColumn rows={mysteryRows()} onWatch={() => {}} reducedMotion={false} />);
    const pip = within(rowOf(/^Pip/));
    expect(pip.getByRole('img', { name: '5' })).toBeTruthy();
    expect(rowOf(/^Pip/).querySelector('.prow-total')!.textContent).toBe('=2');
    expect(within(rowOf(/^You/)).getByRole('img', { name: 'On a Rare ? square' })).toBeTruthy();
    const mochi = within(rowOf(/^Mochi/));
    expect(mochi.getByRole('img', { name: 'Shield' })).toBeTruthy();
    expect(mochi.getByRole('img', { name: 'Card picked, face down' })).toBeTruthy();
    expect(within(rowOf(/^Juno/)).getByRole('img', { name: 'Sprint: Hit' })).toBeTruthy();
    expect(rowOf(/^Juno/).querySelector('.chip-card i')!.className).toBe('hit');
  });

  it("shows a revealed card as a one-line bubble beside its player's row (polish pass)", () => {
    render(<PlayerColumn rows={mysteryRows()} onWatch={() => {}} reducedMotion={false} bubbles={{ p1: 'shield' }} />);
    const bubbles = document.querySelectorAll('.pbubble');
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]!.closest('li')).toBe(rowOf(/^Mochi/).closest('li'));
    expect(bubbles[0]!.querySelector('.pbubble-name')!.textContent).toBe('Shield');
    expect(bubbles[0]!.querySelector('.pbubble-summary')!.textContent).toBe('Block the next attack');
  });

  it('says what each player is doing', () => {
    render(<PlayerColumn rows={mysteryRows()} onWatch={() => {}} reducedMotion={false} />);
    expect(rowOf(/^You/).getAttribute('aria-label')).toBe('You (you), tile 5, rank 3. Your card to pick');
    expect(rowOf(/^Mochi/).querySelector('.prow-status')!.className).toBe('prow-status locked');
  });

  it('watches a piece on tap, and goes back to mine from the watched row or my own', () => {
    const onWatch = vi.fn();
    const { rerender } = render(<PlayerColumn rows={mysteryRows()} onWatch={onWatch} reducedMotion={false} />);
    fireEvent.click(rowOf(/^Mochi/));
    expect(onWatch).toHaveBeenLastCalledWith('p1');
    rerender(<PlayerColumn rows={mysteryRows('p1')} onWatch={onWatch} reducedMotion={false} />);
    expect(rowOf(/^Mochi/).className).toContain('watched');
    fireEvent.click(rowOf(/^Mochi/));
    expect(onWatch).toHaveBeenLastCalledWith(null);
    fireEvent.click(rowOf(/^You/));
    expect(onWatch).toHaveBeenLastCalledWith(null);
  });

  it('opens the details card on a long press without watching, and closes it on the next tap', () => {
    vi.useFakeTimers();
    const onWatch = vi.fn();
    render(<PlayerColumn rows={mysteryRows()} onWatch={onWatch} reducedMotion={false} />);
    const pip = rowOf(/^Pip/);
    fireEvent.pointerDown(pip, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1));
    expect(screen.queryByRole('note')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    const card = screen.getByRole('note', { name: 'Pip' });
    expect(card.textContent).toContain('Meeple · tile 12 · rank 1 of 4');
    expect(card.textContent).toContain('Moves 2');
    fireEvent.pointerUp(pip, { pointerType: 'touch' });
    fireEvent.click(pip);
    expect(screen.getByRole('note', { name: 'Pip' })).toBeTruthy();
    fireEvent.click(pip);
    expect(screen.queryByRole('note')).toBeNull();
    expect(onWatch).not.toHaveBeenCalled();
  });

  it('opens the details card while a mouse hovers a row', () => {
    render(<PlayerColumn rows={mysteryRows()} onWatch={() => {}} reducedMotion={false} />);
    fireEvent.pointerEnter(rowOf(/^Mochi/), { pointerType: 'mouse' });
    const card = screen.getByRole('note', { name: 'Mochi' });
    expect(card.textContent).toContain('Shield');
    expect(card.textContent).toContain('Picked a card. It stays hidden until everyone has picked.');
    fireEvent.pointerLeave(rowOf(/^Mochi/), { pointerType: 'mouse' });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.pointerEnter(rowOf(/^Mochi/), { pointerType: 'touch' });
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('YourPiece (spec #2 §7.2)', () => {
  const effects = [
    effect({ id: 'e1', sourceCard: 'heavy-boots', sourcePlayer: 'p1', params: { hook: 'diceTotal', op: 'add', value: -3 }, lifetime: { charges: 1 }, seq: 2 }),
    effect({ id: 'e2', sourceCard: 'loaded-die', params: { hook: 'diceFace', die: 'first', set: 6 }, lifetime: { charges: 1 }, seq: 1 }),
  ];

  function mine(withEffects: ActiveEffect[]) {
    const v = view({ p0: 30, p1: 52, p2: 30, p3: 7 }, { effects: withEffects });
    const rows = playerRows({ view: v, presentation: presentationFromView(v), record: { round: 1, dice: {}, cards: {} }, seats: SEATS, me: 'p0', watch: null });
    return { row: rows.find((r) => r.me)!, mods: nextRollMods(withEffects, 'p0'), players: rows.length };
  }

  it('shows my tile and rank, what changes my next roll in order, and my effects in full', () => {
    mockMatchMedia(false);
    render(<YourPiece {...mine(effects)} boardSize={100} />);
    expect(screen.getByRole('button', { name: /Your knight/ }).textContent).toContain('Rank 2 of 4');
    expect(screen.getByText('30').closest('.yp-tile')!.textContent).toBe('30/100');
    expect([...document.querySelectorAll('.yp-next b')].map((b) => b.textContent)).toEqual(['Die = 6', 'Total −3']);
    const list = within(screen.getByRole('list', { name: 'Effects on you' }));
    expect(list.getAllByRole('listitem').map((li) => li.querySelector('strong')!.textContent)).toEqual(['Heavy Boots', 'Loaded Die']);
    expect(list.getByText(/Next dice total −3, from Mochi/)).toBeTruthy();
  });

  it('says when nothing changes my roll and no effect is on me', () => {
    mockMatchMedia(false);
    render(<YourPiece {...mine([])} boardSize={100} />);
    expect(document.querySelector('.yp-next b')!.textContent).toBe('No modifiers');
    expect(screen.getByText('No effects on you right now.')).toBeTruthy();
  });

  it('collapses, and starts collapsed on screens under 450 px tall', () => {
    mockMatchMedia(true);
    render(<YourPiece {...mine(effects)} boardSize={100} />);
    const head = screen.getByRole('button', { name: /Your knight/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Effects on you' })).toBeNull();
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('list', { name: 'Effects on you' })).toBeTruthy();
  });
});
