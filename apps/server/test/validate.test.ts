import { PROTOCOL_VERSION } from '@laddorious/host';
import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES, RateLimit, cleanNickname, parseLobbyMessage, parseMatchMessage } from '../src/validate';

const json = (v: unknown) => JSON.stringify(v);
const TOKEN = 'a'.repeat(32);

describe('parseLobbyMessage (spec #4 §6, §7)', () => {
  it('reads hello with a clean profile, and the other lobby messages', () => {
    expect(parseLobbyMessage(json({ type: 'hello', version: PROTOCOL_VERSION, profile: { nickname: '  Ari ', piece: 'meeple' } }))).toEqual({
      kind: 'ok',
      msg: { type: 'hello', version: PROTOCOL_VERSION, profile: { nickname: 'Ari', piece: 'meeple' } },
    });
    for (const type of ['find', 'cancel', 'playWithBots']) expect(parseLobbyMessage(json({ type }))).toEqual({ kind: 'ok', msg: { type } });
    expect(parseLobbyMessage(json({ type: 'ping', t: 1234.5 }))).toEqual({ kind: 'ok', msg: { type: 'ping', t: 1234.5 } });
  });

  it('reads the private room messages; any short code is fine, it just may not match a room (2026-10-16)', () => {
    for (const type of ['createRoom', 'startRoom']) expect(parseLobbyMessage(json({ type }))).toEqual({ kind: 'ok', msg: { type } });
    expect(parseLobbyMessage(json({ type: 'joinRoom', code: 'duck' }))).toEqual({ kind: 'ok', msg: { type: 'joinRoom', code: 'duck' } });
    expect(parseLobbyMessage(json({ type: 'joinRoom', code: 'x' }))).toEqual({ kind: 'ok', msg: { type: 'joinRoom', code: 'x' } });
    for (const code of [42, null, 'x'.repeat(17)]) expect(parseLobbyMessage(json({ type: 'joinRoom', code })).kind).toBe('close');
  });

  it('turns a bad nickname into Guest, and closes on a piece that is not one of the four', () => {
    const hello = (profile: unknown) => parseLobbyMessage(json({ type: 'hello', version: 1, profile }));
    for (const nickname of ['   ', 'x'.repeat(17), 42]) {
      expect(hello({ nickname, piece: 'pawn' })).toMatchObject({ kind: 'ok', msg: { profile: { nickname: 'Guest', piece: 'pawn' } } });
    }
    expect(hello({ nickname: 'Ari', piece: 'queen' }).kind).toBe('close');
    expect(hello(null).kind).toBe('close');
  });

  it('accepts the three new pieces (spec #5 §4.1)', () => {
    for (const piece of ['rook', 'hat', 'duck']) {
      expect(parseLobbyMessage(json({ type: 'hello', version: 2, profile: { nickname: 'Ari', piece } }))).toMatchObject({ kind: 'ok', msg: { profile: { piece } } });
    }
  });

  it('ignores unknown types and closes on malformed frames', () => {
    expect(parseLobbyMessage(json({ type: 'dance' }))).toEqual({ kind: 'ignore' });
    const malformed = [
      '{not json',
      json([1, 2]),
      json({ kind: 'find' }),
      json({ type: 7 }),
      new ArrayBuffer(4),
      json({ type: 'ping', t: 'soon' }),
      json({ type: 'hello', version: 1.5, profile: { nickname: 'A', piece: 'pawn' } }),
    ];
    for (const raw of malformed) expect(parseLobbyMessage(raw).kind).toBe('close');
  });

  it('closes on a message over 8 KB, counted in bytes', () => {
    expect(parseLobbyMessage(json({ type: 'find', pad: 'x'.repeat(MAX_MESSAGE_BYTES) })).kind).toBe('close');
    // Short in characters, long in bytes: é takes two.
    expect(parseLobbyMessage(json({ type: 'find', pad: 'é'.repeat(MAX_MESSAGE_BYTES / 2) })).kind).toBe('close');
  });
});

describe('parseMatchMessage (spec #4 §6, §7)', () => {
  it('reads join, every action, playbackDone, leave and ping', () => {
    expect(parseMatchMessage(json({ type: 'join', token: TOKEN }))).toEqual({ kind: 'ok', msg: { type: 'join', token: TOKEN } });
    const actions = [
      { type: 'roll' },
      { type: 'reroll', slot: 1 },
      { type: 'pickCard', slot: 2 },
      { type: 'challengePick', challengeId: 'c-3', choice: 'rock' },
      { type: 'challengePick', challengeId: 'c-4', choice: 'B' },
    ];
    for (const action of actions) {
      expect(parseMatchMessage(json({ type: 'action', action, windowId: 5 }))).toEqual({ kind: 'ok', msg: { type: 'action', action, windowId: 5 } });
    }
    expect(parseMatchMessage(json({ type: 'playbackDone', windowId: 5 }))).toEqual({ kind: 'ok', msg: { type: 'playbackDone', windowId: 5 } });
    expect(parseMatchMessage(json({ type: 'leave' }))).toEqual({ kind: 'ok', msg: { type: 'leave' } });
    expect(parseMatchMessage(json({ type: 'ping', t: 9 }))).toEqual({ kind: 'ok', msg: { type: 'ping', t: 9 } });
  });

  it('never lets an action name a player: extra fields are dropped (spec #4 §7)', () => {
    expect(parseMatchMessage(json({ type: 'action', action: { type: 'roll', player: 'p3' }, windowId: 1, player: 'p3' }))).toEqual({
      kind: 'ok',
      msg: { type: 'action', action: { type: 'roll' }, windowId: 1 },
    });
  });

  it('closes on fields of the wrong type or out of range, and ignores unknown types', () => {
    const bad = [
      { type: 'join', token: 'short' },
      { type: 'join', token: 'A'.repeat(32) },
      { type: 'action', action: { type: 'roll' }, windowId: -1 },
      { type: 'action', action: { type: 'roll' }, windowId: 1.5 },
      { type: 'action', action: { type: 'fly' }, windowId: 1 },
      { type: 'action', action: { type: 'pickCard', slot: 99 }, windowId: 1 },
      { type: 'action', action: { type: 'challengePick', challengeId: 'c', choice: 'lizard' }, windowId: 1 },
      { type: 'action', action: { type: 'challengePick', challengeId: 'c'.repeat(65), choice: 'rock' }, windowId: 1 },
      { type: 'playbackDone', windowId: 'one' },
    ];
    for (const msg of bad) expect(parseMatchMessage(json(msg)).kind).toBe('close');
    expect(parseMatchMessage(json({ type: 'wave' }))).toEqual({ kind: 'ignore' });
  });
});

describe('cleanNickname', () => {
  it('trims, and allows 1 to 16 characters', () => {
    expect(cleanNickname(' Juno ')).toBe('Juno');
    expect(cleanNickname('a'.repeat(16))).toBe('a'.repeat(16));
    expect(cleanNickname('')).toBe('Guest');
  });
});

describe('RateLimit (spec #4 §7)', () => {
  it('allows 30 messages a second and refuses the 31st', () => {
    const limit = new RateLimit();
    for (let i = 0; i < 30; i++) expect(limit.hit(1000 + i)).toBe(true);
    expect(limit.hit(1100)).toBe(false);
  });

  it('forgets messages older than a second', () => {
    const limit = new RateLimit();
    for (let i = 0; i < 30; i++) limit.hit(0);
    expect(limit.hit(1000)).toBe(true);
  });
});
