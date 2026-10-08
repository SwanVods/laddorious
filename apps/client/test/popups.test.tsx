// @vitest-environment jsdom
import type { GameEvent } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlayingBeat } from '../src/director/director';
import { presentationFromView } from '../src/director/presentation';
import { BANNER_MS, BannerView, useBanner } from '../src/hud/Banner';
import { CardPickPopup } from '../src/hud/CardPickPopup';
import { Dock } from '../src/hud/Dock';
import { FaceOffPopup } from '../src/hud/FaceOffPopup';
import { cardInfo } from '../src/hud/labels';
import type { CardPickModel, DockModel, FaceOffModel } from '../src/hud/model';
import { SEATS, openingUpdate } from './support/fixtures';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const press = (key: string) => fireEvent.keyDown(window, { key });

describe('Dock (spec #2 §7.2)', () => {
  it('rolls once per dice window, by tap or by Space', () => {
    const onRoll = vi.fn();
    const { rerender } = render(<Dock model={{ kind: 'roll', windowId: 3 }} seats={SEATS} onRoll={onRoll} />);
    fireEvent.click(screen.getByRole('button', { name: 'ROLL' }));
    expect(onRoll).toHaveBeenCalledWith(3);
    expect(screen.getByRole('button', { name: 'Rolling…' }).hasAttribute('disabled')).toBe(true);
    press(' ');
    expect(onRoll).toHaveBeenCalledTimes(1);
    rerender(<Dock model={{ kind: 'roll', windowId: 4 }} seats={SEATS} onRoll={onRoll} />);
    press(' ');
    expect(onRoll).toHaveBeenLastCalledWith(4);
    expect(onRoll).toHaveBeenCalledTimes(2);
  });

  it('names who the round waits for', () => {
    render(<Dock model={{ kind: 'wait', parts: ['Waiting for ', { player: 'p2' }, ' to roll'] }} seats={SEATS} onRoll={() => {}} />);
    expect(screen.getByRole('status').textContent).toBe('Waiting for Pip to roll');
  });

  it("captions the move with everyone's total", () => {
    const model: DockModel = { kind: 'caption', parts: ['Everyone moves'], totals: [{ player: 'p1', total: 4 }, { player: 'p3', total: 2 }] };
    render(<Dock model={model} seats={SEATS} onRoll={() => {}} />);
    expect(screen.getByRole('status').textContent).toBe('Everyone moves');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Mochi +4', 'Juno +2']);
  });

  it('lines up the cards in resolution order, stamping results and raising the one resolving', () => {
    const model: DockModel = {
      kind: 'queue',
      caption: 'Cards resolve',
      cards: [
        { caster: 'p3', cardId: 'sprint', result: 'hit', current: false },
        { caster: 'p0', cardId: 'aegis', result: null, current: true },
        { caster: 'p1', cardId: 'heavy-boots', result: null, current: false },
      ],
    };
    render(<Dock model={model} seats={SEATS} onRoll={() => {}} />);
    const cards = within(screen.getByRole('list', { name: 'Cards in resolution order' })).getAllByRole('listitem');
    expect(cards.map((c) => c.querySelector('.q-order')!.textContent)).toEqual(['1', '2', '3']);
    expect(cards[0]!.textContent).toContain('Sprint');
    expect(cards[0]!.querySelector('.stamp')!.textContent).toBe('Hit');
    expect(cards[1]!.className).toContain('now');
    expect(cards[2]!.textContent).toContain('Mochi → The leader');
  });

  it('shows nothing when there is nothing to say', () => {
    const { container } = render(<Dock model={{ kind: 'none' }} seats={SEATS} onRoll={() => {}} />);
    expect(container.textContent).toBe('');
  });
});

const faceOff = (over: Partial<FaceOffModel> = {}): FaceOffModel => ({
  challengeId: 'c4',
  tile: 23,
  kind: 'rps',
  pickRound: 1,
  choices: [
    { choice: 'rock', label: 'Rock' },
    { choice: 'paper', label: 'Paper' },
    { choice: 'scissors', label: 'Scissors' },
  ],
  fighters: [
    { player: 'p0', locked: false, pick: null, out: false },
    { player: 'p1', locked: true, pick: null, out: false },
  ],
  myPick: null,
  canPick: true,
  result: null,
  ...over,
});

describe('FaceOffPopup (spec #2 §7.2)', () => {
  it('shows both fighters with their lock states, and picks by tap or by 1–3, once', () => {
    const onPick = vi.fn();
    render(<FaceOffPopup model={faceOff()} seats={SEATS} me="p0" onPick={onPick} />);
    const dialog = screen.getByRole('dialog', { name: 'FACE-OFF!' });
    expect(dialog.textContent).toContain('Tile 23');
    expect(dialog.textContent).toContain('knocked back 3');
    const fighters = within(dialog).getAllByRole('group');
    expect(fighters.map((f) => f.getAttribute('aria-label'))).toEqual(['You: Your pick', 'Mochi: Pick locked']);
    press('2');
    expect(onPick).toHaveBeenCalledWith('paper');
    fireEvent.click(screen.getByRole('button', { name: /Rock/ }));
    press('3');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('uses the Minority theme for 3 or 4 players, with keys 1–2 only', () => {
    const onPick = vi.fn();
    const model = faceOff({
      kind: 'minority',
      choices: [
        { choice: 'A', label: 'Sun' },
        { choice: 'B', label: 'Moon' },
      ],
      fighters: ['p0', 'p1', 'p2'].map((player) => ({ player, locked: false, pick: null, out: false })),
    });
    render(<FaceOffPopup model={model} seats={SEATS} me="p0" onPick={onPick} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1Sun', '2Moon']);
    press('3');
    expect(onPick).not.toHaveBeenCalled();
    press('1');
    expect(onPick).toHaveBeenCalledWith('A');
  });

  it("reveals everyone's pick and the winner, with the buttons off", () => {
    const onPick = vi.fn();
    const model = faceOff({
      canPick: false,
      myPick: 'rock',
      fighters: [
        { player: 'p0', locked: true, pick: 'rock', out: false },
        { player: 'p1', locked: true, pick: 'paper', out: false },
      ],
      result: { winner: 'p1' },
    });
    render(<FaceOffPopup model={model} seats={SEATS} me="p0" onPick={onPick} />);
    expect(screen.getAllByRole('group').map((f) => f.getAttribute('aria-label'))).toEqual(['You: Rock', 'Mochi: Paper']);
    expect(screen.getByRole('dialog').textContent).toContain('Mochi wins the face-off');
    expect(screen.getAllByRole('button').every((b) => b.hasAttribute('disabled'))).toBe(true);
    press('1');
    expect(onPick).not.toHaveBeenCalled();
  });
});

const offer = (over: Partial<CardPickModel> = {}): CardPickModel => ({
  rarity: 'epic',
  tile: 9,
  rerollsLeft: 2,
  slots: ['aegis', 'switcheroo', 'jackpot'].map((id, slot) => ({
    slot,
    info: cardInfo(id),
    warning: id === 'switcheroo' ? 'Nobody is ahead of you right now. If that holds, it fizzles.' : null,
    rerolled: false,
    canReroll: true,
  })),
  ...over,
});

describe('CardPickPopup (spec #2 §7.2)', () => {
  it('offers three cards with type, rules, target line and fizzle warning, and picks one at once', () => {
    const onPick = vi.fn();
    render(<CardPickPopup model={offer()} onPick={onPick} onReroll={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Choose One' });
    expect(dialog.textContent).toContain('Epic ? square');
    expect(dialog.textContent).toContain('2 rerolls left');
    const switcheroo = screen.getByRole('button', { name: /^Switcheroo/ });
    expect(switcheroo.textContent).toContain('ATTACK');
    expect(switcheroo.textContent).toContain('Furthest player ahead');
    expect(switcheroo.textContent).toContain('it fizzles');
    fireEvent.click(switcheroo);
    expect(onPick).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: /^Aegis/ }));
    press('3');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('rerolls a card once, and disables rerolls that are used or run out', () => {
    const onReroll = vi.fn();
    const model = offer({ rerollsLeft: 1, slots: offer().slots.map((s) => ({ ...s, rerolled: s.slot === 0, canReroll: s.slot !== 0 })) });
    render(<CardPickPopup model={model} onPick={() => {}} onReroll={onReroll} />);
    expect(screen.getByRole('button', { name: 'Reroll Aegis' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reroll Jackpot' }));
    expect(onReroll).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Reroll Jackpot' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('dialog').textContent).toContain('1 reroll left');
  });

  it('peeks at the board and comes back, and picks by 1–3', () => {
    const onPick = vi.fn();
    render(<CardPickPopup model={offer()} onPick={onPick} onReroll={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Peek at the board' }));
    expect(screen.queryByRole('button', { name: /^Aegis/ })).toBeNull();
    press('1');
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the cards' }));
    press('3');
    expect(onPick).toHaveBeenCalledWith(2);
  });
});

describe('banners (spec #2 §5.1)', () => {
  const after = presentationFromView(openingUpdate().view);
  const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c4', tile: 23, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' };
  const beat = (startedAt: number): PlayingBeat => ({ kind: 'faceOff', durationMs: 500, events: [started], after, startedAt });

  function Harness({ playing }: { playing: PlayingBeat | null }) {
    return <BannerView banner={useBanner(playing, 'p0', SEATS)} />;
  }

  it('shows a beat’s banner for a while, even after the beat is over', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness playing={beat(1000)} />);
    expect(screen.getByText('FACE-OFF!').className).toBe('banner bad');
    rerender(<Harness playing={null} />);
    act(() => vi.advanceTimersByTime(BANNER_MS - 1));
    expect(screen.getByText('FACE-OFF!')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('FACE-OFF!')).toBeNull();
  });
});
