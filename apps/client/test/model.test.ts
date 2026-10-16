import type { ActiveEffect, GameEvent, PlayerView, PublicChallenge } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { Beat } from '../src/director/beats';
import type { PlayingBeat } from '../src/director/director';
import { presentationFromView } from '../src/director/presentation';
import { FACE_OFF_REVEAL_MS, KNOCKBACK, MAX_REROLLS, STAGES, bannerFor, cardPickModel, countdown, dockModel, faceOffModel, phoneCards, playerRows, resolutionQueue, stageFromLog, stageIndex } from '../src/hud/model';
import type { RoundRecord } from '../src/hud/record';
import { SEATS, openingUpdate } from './support/fixtures';

const EMPTY: RoundRecord = { round: 1, dice: {}, cards: {} };

/** The opening view (dice window, everyone to roll) with tiles and other changes. */
function view(positions: Record<string, number> = {}, change: Partial<PlayerView> = {}): PlayerView {
  const base = openingUpdate().view;
  return { ...base, players: base.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })), ...change };
}

function challenge(over: Partial<PublicChallenge> = {}): PublicChallenge {
  return { id: 'c4', tile: 23, participants: ['p0', 'p1'], contesting: ['p0', 'p1'], kind: 'rps', theme: null, pickRound: 1, picked: [], winner: null, ...over };
}

const beat = (kind: Beat['kind'], events: GameEvent[] = []): Beat => ({ kind, durationMs: 500, events, after: presentationFromView(view()) });
/** A beat on stage, started at time 0. */
const playing = (kind: Beat['kind'], events: GameEvent[] = []): PlayingBeat => ({ ...beat(kind, events), startedAt: 0 });

function rows(v: PlayerView, record = EMPTY, watch: string | null = null) {
  return playerRows({ view: v, presentation: presentationFromView(v), record, seats: SEATS, me: 'p0', watch });
}

describe('stage bar', () => {
  it('follows the beat on stage, then the open window, and keeps the stage through follow-on beats', () => {
    expect(STAGES.map((s) => s.label)).toEqual(['Dice', 'Move', 'Face-off', 'Mystery', 'Cards', 'Break']);
    expect(stageIndex(beat('roll'), 'dice', null)).toBe(0);
    expect(stageIndex(beat('move'), 'dice', 0)).toBe(1);
    expect(stageIndex(beat('slide'), 'dice', 4)).toBe(4);
    expect(stageIndex(null, 'challenge', 1)).toBe(2);
    expect(stageIndex(null, 'mystery', 1)).toBe(3);
    expect(stageIndex(beat('cardResolved'), 'mystery', 3)).toBe(4);
    expect(stageIndex(null, 'none', 4)).toBe(4);
  });

  it('finds the stage of the latest logged events', () => {
    const at = (events: GameEvent[]) => stageFromLog(events.map((event, i) => ({ seq: i + 1, event })));
    const dice: GameEvent = { type: 'Moved', player: 'p1', from: 0, to: 4, cause: 'dice', bounced: false, visibility: 'public' };
    const slide: GameEvent = { ...dice, from: 4, to: 1, cause: 'snake' };
    const card: GameEvent = { type: 'CardResolved', caster: 'p1', cardId: 'sprint', target: 'p1', result: 'hit', visibility: 'public' };
    expect(at([])).toBeNull();
    expect(at([dice, slide])).toBe(1);
    expect(at([card, slide])).toBe(4);
  });

  it('counts the window down', () => {
    expect(countdown({ endsAt: 12_000 }, 12_000, 4_500)).toEqual({ seconds: 8, fraction: 0.625 });
    expect(countdown({ endsAt: 12_000 }, 12_000, 20_000)).toEqual({ seconds: 0, fraction: 0 });
    expect(countdown(null, 12_000, 0)).toBeNull();
  });
});

describe('player rows (spec #2 §7.2)', () => {
  it('sorts by tile, shares ranks on a tile, and marks my row and the watched one', () => {
    const list = rows(view({ p0: 30, p1: 52, p2: 30, p3: 7 }), EMPTY, 'p3');
    expect(list.map((r) => [r.seat.playerId, r.tile, r.rank])).toEqual([['p1', 52, 1], ['p0', 30, 2], ['p2', 30, 2], ['p3', 7, 4]]);
    expect(list.find((r) => r.me)?.seat.playerId).toBe('p0');
    expect(list.find((r) => r.watched)?.seat.playerId).toBe('p3');
  });

  it('shows who still has to roll', () => {
    const v = view({}, { awaiting: { windowId: 3, window: 'dice', players: ['p0', 'p2'], durationMs: 12_000 } });
    expect(rows(v).map((r) => [r.seat.playerId, r.status])).toEqual([['p0', 'turn'], ['p1', 'done'], ['p2', 'waiting'], ['p3', 'done']]);
  });

  it('shows dice, effects, the "?" chip before a pick, a face-down card after it, and the revealed card', () => {
    const effect: ActiveEffect = { id: 'e1', owner: 'p1', sourceCard: 'shield', sourcePlayer: 'p1', params: { hook: 'beforeAttack' }, lifetime: { rounds: 3, charges: 1 }, createdRound: 1, seq: 1 };
    const base = view({ p0: 5, p1: 9, p2: 12, p3: 2 });
    const mystery = { ...base.board.mystery, 5: 'rare' as const, 9: 'epic' as const };
    const v: PlayerView = {
      ...base,
      board: { ...base.board, mystery },
      effects: [effect],
      phase: { kind: 'mysterySelect', picked: { p0: false, p1: true } },
      awaiting: { windowId: 9, window: 'mystery', players: ['p0'], durationMs: 15_000 },
    };
    const record: RoundRecord = { round: 1, dice: { p2: { faces: [5], forced: [false], total: 2 } }, cards: { p3: { cardId: 'sprint', result: 'hit' } } };
    const byId = Object.fromEntries(rows(v, record).map((r) => [r.seat.playerId, r]));
    expect(byId.p0).toMatchObject({ mystery: 'rare', card: null, status: 'turn' });
    expect(byId.p1).toMatchObject({ mystery: null, card: 'facedown', status: 'locked' });
    expect(byId.p1!.effects.map((e) => e.name)).toEqual(['Shield']);
    expect(byId.p2).toMatchObject({ dice: { faces: [5], total: 2 }, status: 'idle' });
    expect(byId.p3!.card).toEqual({ cardId: 'sprint', result: 'hit' });
  });
});

describe('the dock (spec #2 §7.2)', () => {
  it('offers ROLL in my dice window, else names who is still rolling', () => {
    expect(dockModel({ beat: null, view: view(), record: EMPTY, me: 'p0' })).toEqual({ kind: 'roll', windowId: 1 });
    const v = view({}, { awaiting: { windowId: 1, window: 'dice', players: ['p2'], durationMs: 12_000 } });
    expect(dockModel({ beat: null, view: v, record: EMPTY, me: 'p0' })).toEqual({ kind: 'wait', parts: ['Waiting for ', { player: 'p2' }, ' to roll'] });
  });

  it('waits for a face-off I am not in, and shows nothing when I am in it', () => {
    const settle = { kind: 'settle' as const, challenges: [challenge({ participants: ['p1', 'p2'], contesting: ['p1', 'p2'] })] };
    const v = view({}, { phase: settle, awaiting: { windowId: 4, window: 'challenge', players: ['p1', 'p2'], durationMs: 8_000 } });
    expect(dockModel({ beat: null, view: v, record: EMPTY, me: 'p0' })).toEqual({
      kind: 'wait',
      parts: ['Face-off on tile 23: waiting for ', { player: 'p1' }, ' and ', { player: 'p2' }],
    });
    expect(dockModel({ beat: null, view: v, record: EMPTY, me: 'p1' })).toEqual({ kind: 'none' });
  });

  it('names who still picks a card', () => {
    const v = view({}, { phase: { kind: 'mysterySelect', picked: { p1: false, p3: false } }, awaiting: { windowId: 6, window: 'mystery', players: ['p1', 'p3'], durationMs: 15_000 } });
    expect(dockModel({ beat: null, view: v, record: EMPTY, me: 'p0' })).toEqual({ kind: 'wait', parts: ['Waiting for ', { player: 'p1' }, ' and ', { player: 'p3' }, ' to pick their cards'] });
  });

  it('captions moves with this round’s totals, and slides with who slides', () => {
    const record: RoundRecord = { round: 2, dice: { p0: { faces: [4], forced: [false], total: null }, p1: { faces: [5], forced: [false], total: 2 } }, cards: {} };
    expect(dockModel({ beat: beat('move'), view: view(), record, me: 'p0' })).toEqual({
      kind: 'caption',
      parts: ['Everyone moves'],
      totals: [{ player: 'p0', total: 4 }, { player: 'p1', total: 2 }],
    });
    const slide: GameEvent = { type: 'Moved', player: 'p3', from: 40, to: 12, cause: 'snake', bounced: false, visibility: 'public' };
    expect(dockModel({ beat: beat('slide', [slide]), view: view(), record, me: 'p0' })).toEqual({ kind: 'caption', parts: [{ player: 'p3' }, ' slides down'], totals: null });
  });

  it('says a Sore Loser moves forward, not that they are knocked back (2026-10-16)', () => {
    const record: RoundRecord = { round: 2, dice: {}, cards: {} };
    const back: GameEvent = { type: 'Moved', player: 'p2', from: 10, to: 7, cause: 'knockback', bounced: false, visibility: 'public' };
    const forward: GameEvent = { type: 'Moved', player: 'p1', from: 10, to: 13, cause: 'knockback', bounced: false, visibility: 'public' };
    expect(dockModel({ beat: beat('knockback', [back]), view: view(), record, me: 'p0' })).toEqual({ kind: 'caption', parts: [{ player: 'p2' }, ' is knocked back'], totals: null });
    expect(dockModel({ beat: beat('knockback', [forward]), view: view(), record, me: 'p0' })).toEqual({ kind: 'caption', parts: [{ player: 'p1' }, ' lost, but moves forward'], totals: null });
  });

  it('lists the cards in the order the engine revealed them (last place first), marking the one resolving', () => {
    const record: RoundRecord = {
      round: 7,
      dice: {},
      cards: { p1: { cardId: 'heavy-boots', result: 'hit' }, p3: { cardId: 'sprint', result: 'hit' }, p0: { cardId: 'aegis', result: null } },
    };
    const resolving: GameEvent = { type: 'CardResolved', caster: 'p0', cardId: 'aegis', target: 'p0', result: 'hit', visibility: 'public' };
    expect(resolutionQueue(record, beat('cardResolved', [resolving]))).toEqual([
      { caster: 'p1', cardId: 'heavy-boots', result: 'hit', current: false },
      { caster: 'p3', cardId: 'sprint', result: 'hit', current: false },
      { caster: 'p0', cardId: 'aegis', result: null, current: true },
    ]);
  });

  it("keeps the phone's card list through the moves a card makes, like a launch after Sprint (2026-10-15)", () => {
    const record: RoundRecord = { round: 7, dice: {}, cards: { p3: { cardId: 'sprint', result: 'hit' } } };
    const launch = beat('launch', [{ type: 'Moved', player: 'p3', from: 12, to: 31, cause: 'ladder', bounced: false, visibility: 'public' }]);
    expect(dockModel({ beat: launch, view: view(), record, me: 'p0' }).kind).toBe('caption');
    expect(phoneCards(record, launch)).toEqual([{ caster: 'p3', cardId: 'sprint', result: 'hit', current: false }]);
    expect(phoneCards(record, null)).toHaveLength(1);
    expect(phoneCards(EMPTY, launch)).toEqual([]);
  });

  it('shows the card queue without a caption about the order while cards resolve (2026-10-14)', () => {
    const record: RoundRecord = { round: 7, dice: {}, cards: { p0: { cardId: 'aegis', result: null } } };
    const resolving: GameEvent = { type: 'CardResolved', caster: 'p0', cardId: 'aegis', target: 'p0', result: 'hit', visibility: 'public' };
    expect(dockModel({ beat: beat('cardResolved', [resolving]), view: view(), record, me: 'p0' })).toMatchObject({ kind: 'queue', caption: null });
  });
});

describe('the face-off popup (spec #2 §7.2, C11)', () => {
  const settle = (c: PublicChallenge): Partial<PlayerView> => ({
    phase: { kind: 'settle', challenges: [c] },
    awaiting: { windowId: 4, window: 'challenge', players: c.contesting.filter((p) => !c.picked.includes(p)), durationMs: 8_000 },
  });

  it('shows only to its players, with lock states, and lets me pick once', () => {
    const v = view({}, settle(challenge({ picked: ['p1'] })));
    expect(faceOffModel({ beat: null, view: { ...v, me: 'p2' }, me: 'p2', nowMs: 0 })).toBeNull();
    const model = faceOffModel({ beat: null, view: v, me: 'p0', nowMs: 0 })!;
    expect(model).toMatchObject({ challengeId: 'c4', tile: 23, kind: 'rps', canPick: true, myPick: null });
    expect(model.choices.map((c) => c.label)).toEqual(['Rock', 'Paper', 'Scissors']);
    expect(model.fighters).toEqual([
      { player: 'p0', locked: false, pick: null, out: false },
      { player: 'p1', locked: true, pick: null, out: false },
    ]);
    const picked = faceOffModel({ beat: null, view: { ...v, myPicks: { c4: 'rock' } }, me: 'p0', nowMs: 0 })!;
    expect(picked).toMatchObject({ canPick: false, myPick: 'rock' });
  });

  it("uses the Minority theme's two choices", () => {
    const v = view({}, settle(challenge({ participants: ['p0', 'p1', 'p2'], contesting: ['p0', 'p1', 'p2'], kind: 'minority', theme: ['Sun', 'Moon'] })));
    expect(faceOffModel({ beat: null, view: v, me: 'p0', nowMs: 0 })!.choices).toEqual([
      { choice: 'A', label: 'Sun' },
      { choice: 'B', label: 'Moon' },
    ]);
  });

  it('opens only after the FACE-OFF! intro, never during it (2026-10-14)', () => {
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c4', tile: 23, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' };
    const v = view({}, settle(challenge({})));
    expect(faceOffModel({ beat: playing('faceOff', [started]), view: v, me: 'p0', nowMs: 100 })).toBeNull();
  });

  it('closes for the result once the picks have shown, and stays shut while the knock-back plays (2026-10-14)', () => {
    const v = view({}, settle(challenge({ picked: ['p0', 'p1'] })));
    const resolved: GameEvent = { type: 'ChallengeResolved', challengeId: 'c4', pickRound: 1, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win', visibility: 'public' };
    expect(faceOffModel({ beat: playing('faceOffResult', [resolved]), view: v, me: 'p0', nowMs: FACE_OFF_REVEAL_MS })).toBeNull();
    const open = view({}, settle(challenge({})));
    expect(faceOffModel({ beat: playing('knockback', []), view: open, me: 'p0', nowMs: 100 })).toBeNull();
    expect(faceOffModel({ beat: playing('info', []), view: open, me: 'p0', nowMs: 100 })).not.toBeNull();
  });

  it('reveals the picks while the result plays', () => {
    const v = view({}, settle(challenge({ picked: ['p0', 'p1'] })));
    const resolved: GameEvent = { type: 'ChallengeResolved', challengeId: 'c4', pickRound: 1, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win', visibility: 'public' };
    expect(faceOffModel({ beat: playing('faceOffResult', [resolved]), view: v, me: 'p0', nowMs: FACE_OFF_REVEAL_MS - 1 })).toMatchObject({
      canPick: false,
      result: { winner: 'p1' },
      fighters: [
        { player: 'p0', pick: 'rock' },
        { player: 'p1', pick: 'paper' },
      ],
    });
  });
});

describe('the card-pick popup (spec #2 §7.2)', () => {
  const offerView = (rerolled: [boolean, boolean, boolean], rerollsUsed: number, picked: number | null = null) =>
    view({ p0: 9 }, {
      phase: { kind: 'mysterySelect', picked: { p0: picked !== null } },
      myOffer: { player: 'p0', tile: 9, rarity: 'epic', cards: ['aegis', 'switcheroo', 'jackpot'], rerolled, rerollsUsed, seen: ['aegis', 'switcheroo', 'jackpot'], picked, autoPicked: false },
      awaiting: { windowId: 7, window: 'mystery', players: picked === null ? ['p0'] : [], durationMs: 15_000 },
    });

  it('offers my three cards with rerolls, warning about a fizzle', () => {
    const model = cardPickModel(offerView([false, false, false], 0))!;
    expect(model.rerollsLeft).toBe(MAX_REROLLS);
    expect(model.slots.map((s) => [s.info.name, s.canReroll])).toEqual([['Aegis', true], ['Switcheroo', true], ['Jackpot!', true]]);
    expect(model.slots[1]!.warning).toBe('Nobody is ahead of you right now. If that holds, it fizzles.');
  });

  it('disables a rerolled slot, and every slot once the rerolls run out', () => {
    expect(cardPickModel(offerView([false, true, false], 1))!.slots.map((s) => s.canReroll)).toEqual([true, false, true]);
    expect(cardPickModel(offerView([true, true, false], 2))!.slots.map((s) => s.canReroll)).toEqual([false, false, false]);
  });

  it('is gone once I have picked, and for players without an offer', () => {
    expect(cardPickModel(offerView([false, false, false], 0, 1))).toBeNull();
    expect(cardPickModel(view())).toBeNull();
  });

  it('stays closed, and the card queue stays up, through the pause after a card (2026-10-14)', () => {
    const offer = offerView([false, false, false], 0);
    const resolving: GameEvent = { type: 'CardResolved', caster: 'p0', cardId: 'aegis', target: 'p0', result: 'hit', visibility: 'public' };
    const pause: Beat = { kind: 'pause', durationMs: 600, events: [], after: presentationFromView(view()), holds: beat('cardResolved', [resolving]) };
    expect(cardPickModel(offer, pause)).toBeNull();
    const record: RoundRecord = { round: 7, dice: {}, cards: { p0: { cardId: 'aegis', result: 'hit' } } };
    expect(dockModel({ beat: pause, view: view(), record, me: 'p0' })).toMatchObject({ kind: 'queue' });
  });

  it('closes while the cards resolve, even if my window timed out before I picked (2026-10-14)', () => {
    const offer = offerView([false, false, false], 0);
    for (const kind of ['cardReveal', 'cardResolved', 'cardMove', 'boardEdit'] as const) expect(cardPickModel(offer, beat(kind))).toBeNull();
    expect(cardPickModel(offer, beat('move'))).not.toBeNull();
  });
});

describe('banners (spec #2 §5.1)', () => {
  const resolved = (over: Partial<Extract<GameEvent, { type: 'ChallengeResolved' }>>): GameEvent => ({
    type: 'ChallengeResolved', challengeId: 'c4', pickRound: 1, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win', visibility: 'public', ...over,
  });
  const card = (over: Partial<Extract<GameEvent, { type: 'CardResolved' }>>): GameEvent => ({ type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p0', result: 'hit', visibility: 'public', ...over });
  const banner = (kind: Beat['kind'], events: GameEvent[]) => bannerFor(beat(kind, events), 'p0', SEATS);

  it('calls out my own face-off and how it ends for me', () => {
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c4', tile: 23, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' };
    expect(banner('faceOff', [started])).toEqual({ text: 'COLLISION!', tone: 'bad' }); // as in the mockup (2026-10-14)
    expect(banner('faceOff', [{ ...started, players: ['p2', 'p3'] }])).toBeNull();
    // The result waits until the popup has shown both picks and closed (2026-10-14).
    const after = { delayMs: FACE_OFF_REVEAL_MS };
    expect(banner('faceOffResult', [resolved({})])).toEqual({ text: 'YOU LOSE', tone: 'bad', ...after });
    expect(banner('faceOffResult', [resolved({ winner: 'p0', losers: ['p1'] })])).toEqual({ text: 'YOU WIN!', tone: 'good', ...after });
    expect(banner('faceOffResult', [resolved({ winner: null, losers: [], outcome: 'replay' })])).toEqual({ text: 'DRAW!', tone: 'info', ...after });
    expect(banner('faceOffResult', [resolved({ picks: { p2: 'rock', p3: 'paper' }, winner: 'p3', losers: ['p2'] })])).toBeNull();
  });

  it('calls out cards that touch me, the reveal and clashes', () => {
    expect(banner('cardReveal', [])).toEqual({ text: 'CARDS REVEALED', tone: 'info' });
    expect(banner('cardResolved', [card({})])).toEqual({ text: 'HIT!', tone: 'bad' });
    expect(banner('cardResolved', [card({ result: 'blocked' })])).toEqual({ text: 'BLOCKED!', tone: 'cool' });
    expect(banner('cardResolved', [card({ caster: 'p0', target: null, result: 'fizzled' })])).toEqual({ text: 'FIZZLED', tone: 'info' });
    expect(banner('cardResolved', [card({ target: 'p2' })])).toBeNull();
    expect(banner('clash', [{ type: 'Clash', cardIds: ['switcheroo', 'shove'], casters: ['p0', 'p2'], players: ['p0', 'p2'], visibility: 'public' }])).toEqual({ text: 'CLASH!', tone: 'bad' });
  });

  it('calls out my dodged slide and the winner of the match', () => {
    expect(banner('snakeBlocked', [{ type: 'SnakeBlocked', player: 'p0', tile: 47, effectId: 'e1', visibility: 'public' }])).toEqual({ text: 'DODGED!', tone: 'cool' });
    const won = (winner: string): GameEvent => ({ type: 'MatchWon', winner, rankings: [], visibility: 'public' });
    expect(banner('victory', [won('p0')])).toEqual({ text: 'VICTORY!', tone: 'good' });
    expect(banner('victory', [won('p2')])).toEqual({ text: 'PIP WINS!', tone: 'info' });
    expect(banner('ranks', [won('p2')])).toBeNull(); // the ranks reveal replays the win without a second banner
    expect(KNOCKBACK).toBe(3);
  });
});
