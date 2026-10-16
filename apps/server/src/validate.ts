import type { ChallengeChoice } from '@laddorious/core';
import { PIECES, type LobbyIn, type MatchIn, type PlayerAction, type Profile } from '@laddorious/host';

// Every frame from a game is checked here before the lobby or a match sees it (spec #4 §7).

/** Bigger messages close the socket. */
export const MAX_MESSAGE_BYTES = 8 * 1024;
/** More messages than this within a second close the socket. */
export const MAX_MESSAGES_PER_SECOND = 30;
/** Nicknames are 1–16 characters, as the client's own check. */
export const NICKNAME_MAX = 16;

/** What to do with one frame: handle it, ignore it (an unknown type), or close the socket. */
export type Parsed<T> = { kind: 'ok'; msg: T } | { kind: 'ignore' } | { kind: 'close'; reason: string };

type Fields = Record<string, unknown>;

const CHOICES: readonly ChallengeChoice[] = ['rock', 'paper', 'scissors', 'A', 'B'];
const TOKEN = /^[0-9a-f]{32}$/;
const MAX_ID = 64;
/** A typed room code, before it is trimmed and matched. */
const MAX_ROOM_CODE = 16;
const MAX_SLOT = 15;
const MAX_INT = 2 ** 31 - 1;

const ok = <T>(msg: T): Parsed<T> => ({ kind: 'ok', msg });
const bad = (type: string): { kind: 'close'; reason: string } => ({ kind: 'close', reason: `bad ${type} message` });
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isFields = (v: unknown): v is Fields => typeof v === 'object' && v !== null && !Array.isArray(v);

/** One text frame as a JSON object with a string `type`, or why the socket should close. */
function frame(raw: unknown): Fields | string {
  if (typeof raw !== 'string') return 'binary frames are not allowed';
  if (raw.length > MAX_MESSAGE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) return 'message too large';
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return 'malformed JSON';
  }
  return isFields(data) && typeof data.type === 'string' ? data : 'not a message';
}

/** A nickname trimmed to 1–16 characters, otherwise "Guest" (spec #4 §7). */
export function cleanNickname(raw: unknown): string {
  if (typeof raw !== 'string') return 'Guest';
  const name = raw.trim();
  return name.length >= 1 && [...name].length <= NICKNAME_MAX ? name : 'Guest';
}

function profileOf(raw: unknown): Profile | null {
  if (!isFields(raw)) return null;
  const piece = PIECES.find((p) => p === raw.piece);
  return piece ? { nickname: cleanNickname(raw.nickname), piece } : null;
}

/** An action rebuilt from its known fields only: whatever else was sent (a player id) is dropped. */
function actionOf(raw: unknown): PlayerAction | null {
  if (!isFields(raw)) return null;
  const { type, slot, challengeId, choice } = raw;
  if (type === 'roll') return { type: 'roll' };
  if (type === 'reroll' || type === 'pickCard') return isInt(slot, 0, MAX_SLOT) ? { type, slot } : null;
  if (type === 'challengePick') {
    const picked = CHOICES.find((c) => c === choice);
    return typeof challengeId === 'string' && challengeId.length <= MAX_ID && picked ? { type, challengeId, choice: picked } : null;
  }
  return null;
}

/** Reads one frame from a /lobby socket. */
export function parseLobbyMessage(raw: unknown): Parsed<LobbyIn> {
  const data = frame(raw);
  if (typeof data === 'string') return { kind: 'close', reason: data };
  const type = data.type as string;
  switch (type) {
    case 'hello': {
      const { version } = data;
      const profile = profileOf(data.profile);
      return isInt(version, 0, MAX_INT) && profile ? ok<LobbyIn>({ type, version, profile }) : bad(type);
    }
    case 'find':
    case 'cancel':
    case 'playWithBots':
    case 'createRoom':
    case 'startRoom':
      return ok<LobbyIn>({ type });
    case 'joinRoom': {
      // Any short code: a typo just finds no room (2026-10-16).
      const { code } = data;
      return typeof code === 'string' && code.length <= MAX_ROOM_CODE ? ok<LobbyIn>({ type, code }) : bad(type);
    }
    case 'ping': {
      const { t } = data;
      return isTime(t) ? ok<LobbyIn>({ type, t }) : bad(type);
    }
    default:
      return { kind: 'ignore' };
  }
}

/** Reads one frame from a /match/:id socket. */
export function parseMatchMessage(raw: unknown): Parsed<MatchIn> {
  const data = frame(raw);
  if (typeof data === 'string') return { kind: 'close', reason: data };
  const type = data.type as string;
  switch (type) {
    case 'join': {
      const { token } = data;
      return typeof token === 'string' && TOKEN.test(token) ? ok<MatchIn>({ type, token }) : bad(type);
    }
    case 'action': {
      const { windowId } = data;
      const action = actionOf(data.action);
      return action && isInt(windowId, 0, MAX_INT) ? ok<MatchIn>({ type, action, windowId }) : bad(type);
    }
    case 'playbackDone': {
      const { windowId } = data;
      return isInt(windowId, 0, MAX_INT) ? ok<MatchIn>({ type, windowId }) : bad(type);
    }
    case 'leave':
      return ok<MatchIn>({ type });
    case 'ping': {
      const { t } = data;
      return isTime(t) ? ok<MatchIn>({ type, t }) : bad(type);
    }
    default:
      return { kind: 'ignore' };
  }
}

/** Counts one socket's messages: more than 30 within any second closes it (spec #4 §7). */
export class RateLimit {
  private readonly times: number[] = [];

  constructor(
    private readonly limit = MAX_MESSAGES_PER_SECOND,
    private readonly windowMs = 1000,
  ) {}

  /** Records a message at `now`; false once the socket is over the limit. */
  hit(now: number): boolean {
    while (this.times.length > 0 && now - this.times[0]! >= this.windowMs) this.times.shift();
    this.times.push(now);
    return this.times.length <= this.limit;
  }
}
