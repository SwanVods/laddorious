# Multiplayer Server Implementation Plan

> **For agentic workers:** executed inline with superpowers:executing-plans (the user's rule: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real people play each other online. Quick match seats whoever is waiting, bots fill empty seats on request, the rules engine runs only on the server, and a player who drops can come back within 60 s. It runs on the user's Wi-Fi with one command and deploys to Cloudflare unchanged.

**Architecture:**
- **`packages/host` (new):** the match host moves out of the client's worker and learns about several humans, away seats and resync. The offline Web Worker and the server both run it.
- **`apps/server` (new):** one Cloudflare Worker that serves the built game and two kinds of Durable Object:
  - one lobby (`LobbyCore`);
  - one object per match (`MatchRoom`).

  Both are plain, Node-tested classes behind thin wrappers.
- **The client:** gains `OnlineMatchService` (a lobby socket, then a match socket with clock sync and reconnect), presence on the match screen, the unreachable-server fallback and reload rejoin. `VITE_SERVER` picks online or offline at build time.

**Tech Stack:** TypeScript, Cloudflare Workers + Durable Objects (`wrangler` 4.148.0, `@cloudflare/workers-types` 5.20261007.1), React 19, Zustand, Vitest 5 (jsdom for components), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-multiplayer-server-design.md`.

## Global Constraints

- **Browser-safe packages:** `packages/host` never imports `node:*` (the existing lint rule for `packages/*/src`).
- **Plain classes stay portable:** `apps/server/src/lobby.ts`, `room.ts` and `validate.ts` use no Workers-only API. Only `LobbyDO.ts`, `MatchDO.ts`, `socket.ts`, `index.ts` and `env.ts` may.
- **Pinned versions:** `wrangler` 4.148.0 and `@cloudflare/workers-types` 5.20261007.1, exactly. `compatibility_date = "2026-10-01"` (workerd 1.20261006 supports it).
- **Protocol:** `PROTOCOL_VERSION = 1`. JSON text frames, one object with a `type`.
- **Timings (spec §4, §5):**
  - playback cap 12 s;
  - bot offer after 15 s of your own waiting, bots seated 420 ms apart;
  - 15 s to join a match, 10 s of silence counts as gone;
  - rejoin within 60 s; 10 s linger after the win; a match with nobody connected ends after 60 s;
  - ping every 5 s, clock offset = median of the last 5;
  - reconnect backoff 0.5, 1, 2, 4, 8 s, then every 8 s, for up to 60 s;
  - the lobby must open within 5 s.
- **Limits (spec §7):** 8 KB per message, more than 30 messages a second closes the socket, 128-bit tokens, nicknames trimmed to 1–16 characters or "Guest", pieces one of the four.
- **Seat colours follow seat order (M10):** `#ff5470`, `#3b82f6`, `#a3e635`, `#8b5cf6`. Every colour stays in `app/theme.ts` or `theme.css` (`test/tokens.test.ts`).
- **Copy, exactly:**
  - "Can't reach the game server." and "Please reload, the game was updated.";
  - "*Name* lost connection", "*Name* is back", "Reconnecting…", "Back in the match";
  - "The match carried on without you";
  - "Try again", "Play offline with bots", "Away".
- **No deploying.** Claude never runs `wrangler deploy`, `wrangler login` or any Cloudflare account action. The deploy script and guide are written for the user.
- Commit at the end of every task with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer. Read test counts with `grep -E "Test Files|Tests "`.

## Decisions made while planning

The spec is the authority; these fill in what it leaves open. Each is a ruling the executor can rely on.

1. **Seats:** the shared `Seat` has no colour. The client's `SeatInfo extends Seat` adds `color`, set by seat index (M10).
2. **Matchmaking updates:** a `matchmaking` message carries `seats` in table order and `you` (your seat index). The client colours by the true index, then puts its own seat first (spec §4 step 3), so the overlay's colours match the match's.
3. **`MatchHost` options:**
   - `onEnd(outcome)` is added, because the room must know when the match is won or failed;
   - there's no `playbackCapMs` option: fast mode sets the cap, as today.
4. **Timers:** the plain classes use the global `setTimeout` and `Date.now`, which Vitest fakes. The Durable Object wrappers don't inject timers.
5. **Room timers before the first join:** the room keeps the match paused until the first player joins, since that is "no human connected" (spec §5.2). A slow first connection doesn't eat the opening window.
6. **After the win:** no `presence` messages, so end screens don't fill with "lost connection" toasts as players go back to the menu.
7. **Reconnecting:** "Reconnecting…" is a pill that stays up while my connection is down (a toast hides after 3.8 s). "Back in the match" is a toast.
8. **No lobby ping:** the lobby socket doesn't ping. The server's tick every second keeps it busy, and the lobby has no silence timeout.
9. **The deploy script** is `pnpm deploy:cloudflare`: `pnpm deploy` is a built-in pnpm command, so a script with that name can't be run as `pnpm deploy`.
10. **The saved seat** holds `me` and `seats` as well as `matchId` and `token`, so a reload can show the match at once.
11. **A finished match's object** keeps its closed room. Later sockets hear "This match is no longer running" (`server-error`), and the object is freed when idle.
12. **Four humans:** they start at once without a final `filling` update.
13. **The unreachable overlay** also has **Cancel**, back to the menu.

## Review Focus

1. **The whole house's Wi-Fi blips** (every human drops at once). Expected: the match pauses instead of racing through away-only windows, and picks up where it was. Pinned in Task 2 ("never closes windows early while no human is connected") and Task 6 ("pauses while nobody is connected and picks up where it was").
2. **A reload races its own old socket** (the new socket joins before the old one's close arrives). Expected: the new socket takes the seat, with no "lost connection" flicker for the others. Pinned in Task 6 ("lets a newer socket with the same token take the seat over").
3. **A player drops while bots take seats.** Expected: the match still starts, that seat is away after 15 s, and nobody waits for it. Pinned in Task 5 ("keeps the seat of a player who drops while bots take seats") and Task 6 ("counts a player who never joins within 15 s as away").
4. **Players leave from the end screen.** Expected: no "lost connection" toasts over the results, and no reconnecting after a won match. Pinned in Task 6 ("closes every socket 10 s after the win and tells nobody who left") and Task 10 ("stops reconnecting and forgets the seat once the match is won").
5. **A stale saved seat on reload** (the match ended, or its object restarted). Expected: a clear screen, never a hang on an empty board. Pinned in Task 6 ("ends the match after 60 s with nobody connected": a later socket hears "no longer running") and Task 10 ("passes the server's failures on"). The App shows the error screen for those (Task 8).

## File map

| Path | Task | What it holds |
|---|---|---|
| `packages/host/src/types.ts` | 1 | `PieceId`, `PIECES`, `Profile`, `Seat`, `PlayerAction`, `MatchUpdate`, `FromHost` |
| `packages/host/src/timers.ts` | 1 | `PausableTimers`, moved from the client |
| `packages/host/src/matchHost.ts` | 1, 2 | `MatchHost`, `PLAYBACK_CAP_MS`, `BOT_DELAY_*`, `FAST` |
| `packages/host/src/seats.ts` | 3 | `BOT_NAMES`, `TABLE_SIZE`, `buildSeats`, `randomHex` |
| `packages/host/src/protocol.ts` | 3 | `PROTOCOL_VERSION`, `FailReason`, `LobbyIn/Out`, `MatchIn/Out` |
| `apps/client/src/worker/localHost.ts` | 1 | the offline worker's adapter onto `MatchHost` |
| `apps/client/src/service/seats.ts` | 3 | `colorSeat`, `colorSeats` |
| `apps/server/src/validate.ts` | 4 | message parsing, `cleanNickname`, `RateLimit` |
| `apps/server/src/lobby.ts` | 5 | `LobbyCore` |
| `apps/server/src/room.ts` | 6 | `MatchRoom` |
| `apps/server/src/{env,socket,LobbyDO,MatchDO,index}.ts`, `wrangler.toml` | 7 | the Worker and its Durable Objects |
| `apps/client/src/hud/presence.ts` | 8 | `presenceToast` |
| `apps/client/src/service/{channel,onlineSocket,savedSeat,onlineSession}.ts` | 10 | the match socket |
| `apps/client/src/service/onlineMatchService.ts` | 11 | `OnlineMatchService`, `serverUrl` |
| `apps/server/scripts/online.mjs`, `apps/server/README.md` | 12 | `pnpm serve`, `dev:online`, `deploy:cloudflare`, the deploy guide |
| `apps/client/e2e/online.spec.ts` | 13 | two-player e2e against `wrangler dev` |

---
### Task 1: Move the match host into `packages/host`

A refactor: offline play must behave exactly as before. The existing host and timer tests move with the code and are the safety net.

**Files:**
- Create:
  - `packages/host/package.json`, `packages/host/tsconfig.json`, `packages/host/README.md`;
  - `packages/host/src/index.ts`, `src/types.ts`, `src/matchHost.ts`;
  - `packages/host/test/matchHost.test.ts`.
- Move (`git mv`): `apps/client/src/worker/timers.ts` → `packages/host/src/timers.ts`; `apps/client/test/timers.test.ts` → `packages/host/test/timers.test.ts`.
- Modify:
  - `apps/client/package.json` (dependency `@laddorious/host`);
  - `apps/client/src/service/matchService.ts` (shared types come from the host);
  - `apps/client/src/worker/protocol.ts` (`FromHost` comes from the host);
  - `apps/client/src/worker/localHost.ts` (becomes an adapter);
  - `apps/client/test/localHost.test.ts` (adapter tests);
  - `package.json` (typecheck the new package).

**Interfaces:**
- **Consumes:** `@laddorious/core` (`createMatch`, `step`, `awaiting`, `viewFor`, `eventsFor`), `@laddorious/bots` (`makeBots`).
- **Produces:**
  - `Seat { playerId; nickname; piece; bot }`, `Profile`, `PieceId`, `PIECES`, `PlayerAction`, `MatchUpdate`, `FromHost`;
  - `PausableTimers`;
  - `class MatchHost` with `new MatchHost({ send(to, msg), fast? })`, `create(seats, seed, rngSeed)`, `action(player, action, windowId)`, `playbackDone(player, windowId)`, `pause()`, `resume()`, `stop()`;
  - `PLAYBACK_CAP_MS`, `BOT_DELAY_MIN_MS`, `BOT_DELAY_MAX_MS`, `FAST`;
  - client: `SeatInfo extends Seat { color }`.

- [ ] **Step 1: Create the package and move the timers.**

`packages/host/package.json`:

```json
{
  "name": "@laddorious/host",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@laddorious/bots": "workspace:*",
    "@laddorious/core": "workspace:*"
  }
}
```

`packages/host/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"]
}
```

`packages/host/README.md`:

```markdown
# @laddorious/host

The match host (spec #4 §3.1): one match's engine state, window timers and bots, for any mix of humans and bots. Each human only ever receives `viewFor(state, them)` and `eventsFor(events, them)`.

Two places run it:

- the client's offline Web Worker (`apps/client/src/worker/localHost.ts`), with one human;
- the server's match room (`apps/server/src/room.ts`), with up to four.

It also holds what both sides share: the seat and update types, the wire protocol (`PROTOCOL_VERSION`, the lobby and match messages) and `buildSeats`. Browser-safe: no Node built-ins.
```

Then move the timers and their test:

```bash
git mv apps/client/src/worker/timers.ts packages/host/src/timers.ts
git mv apps/client/test/timers.test.ts packages/host/test/timers.test.ts
```

In `packages/host/test/timers.test.ts`, change the import to `import { PausableTimers } from '../src/timers';`.

Add `"@laddorious/host": "workspace:*"` to `apps/client/package.json` dependencies (alphabetical, after `@laddorious/core`). In the root `package.json`, make `typecheck` start with `tsc -p packages/core && tsc -p packages/bots && tsc -p packages/host && ...` (the rest unchanged). Run `pnpm install`.

Run: `pnpm vitest run packages/host/test/timers.test.ts`
Expected: PASS (5 tests): the move changed nothing.

- [ ] **Step 2: Write the shared types.** Create `packages/host/src/types.ts`:

```ts
import type { ChallengeChoice, GameEvent, InputError, PlayerId, PlayerView } from '@laddorious/core';

// What a match host and its human seats exchange (spec #4 §3.1). The offline Web Worker and
// the multiplayer server both use these.

export type PieceId = 'knight' | 'pawn' | 'meeple' | 'dragon';

/** Piece picker order. Bots take the pieces no human chose, in this order (spec #2 §4.4). */
export const PIECES: readonly PieceId[] = ['knight', 'pawn', 'meeple', 'dragon'];

export interface Profile {
  nickname: string;
  piece: PieceId;
}

/** A seat at the table. Seat colours belong to the client (spec #4 M10). */
export interface Seat {
  playerId: PlayerId;
  nickname: string;
  piece: PieceId;
  bot: boolean;
}

export type PlayerAction =
  | { type: 'roll' }
  | { type: 'challengePick'; challengeId: string; choice: ChallengeChoice }
  | { type: 'reroll'; slot: number }
  | { type: 'pickCard'; slot: number };

export interface MatchUpdate {
  view: PlayerView; // viewFor(state, me) after this step
  events: GameEvent[]; // eventsFor(events, me) produced by this step
  timer: { windowId: number; endsAt: number } | null; // null while waiting for playback or when no window is open
}

/** Host → one human seat: only what that seat may see (spec #2 §4.2). */
export type FromHost =
  | { type: 'update'; update: MatchUpdate }
  | { type: 'rejected'; error: InputError }
  | { type: 'failed'; message: string };
```

Create `packages/host/src/index.ts`:

```ts
export * from './types';
export * from './timers';
export * from './matchHost';
```

- [ ] **Step 3: Write the failing host tests.** These are `apps/client/test/localHost.test.ts`'s tests on the new API: `action`, `playbackDone`, `pause`, `resume` and `stop` take the place of `handle({ type: ... })`. Create `packages/host/test/matchHost.test.ts`:

```ts
import { HeuristicBot } from '@laddorious/bots';
import { DEFAULT_WINDOWS, InvariantError } from '@laddorious/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_DELAY_MAX_MS, BOT_DELAY_MIN_MS, MatchHost, PLAYBACK_CAP_MS } from '../src/matchHost';
import type { FromHost, Seat } from '../src/types';

const SECRET = 'secret-rng-seed-7f3a';

/** You and three bots, as "Play with bots" seats them when you chose the knight. */
const SOLO: Seat[] = [
  { playerId: 'p0', nickname: 'You', piece: 'knight', bot: false },
  { playerId: 'p1', nickname: 'Mochi', piece: 'pawn', bot: true },
  { playerId: 'p2', nickname: 'Pip', piece: 'meeple', bot: true },
  { playerId: 'p3', nickname: 'Juno', piece: 'dragon', bot: true },
];

/** A host on a fresh match. Messages are cloned like postMessage would, so anything uncloneable fails here. */
function startHost(seed = 'board-seed') {
  const sent: FromHost[] = [];
  const host = new MatchHost({ send: (_to, msg) => sent.push(structuredClone(msg)) });
  host.create(SOLO, seed, SECRET);
  const updates = () => sent.filter((m) => m.type === 'update').map((m) => m.update);
  const last = () => updates().at(-1)!;
  const events = () => updates().flatMap((u) => u.events);
  return { host, sent, updates, last, events };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MatchHost window timing', () => {
  it('opens round 1 with every seat awaited and no countdown until playback is done', () => {
    const { updates, last } = startHost();
    expect(updates()).toHaveLength(1);
    expect(last().view.round).toBe(1);
    expect(last().view.awaiting).toMatchObject({ windowId: 1, window: 'dice', players: ['p0', 'p1', 'p2', 'p3'] });
    expect(last().timer).toBeNull();
    vi.advanceTimersByTime(PLAYBACK_CAP_MS - 1);
    expect(updates()).toHaveLength(1); // no countdown, and no bot has rolled
  });

  it('starts the countdown as soon as the human seat reports playback done', () => {
    const { host, last } = startHost();
    vi.advanceTimersByTime(3000);
    host.playbackDone('p0', 1);
    expect(last().timer).toEqual({ windowId: 1, endsAt: 3000 + DEFAULT_WINDOWS.diceMs });
  });

  it('starts the countdown after the 12 s cap when playback never finishes', () => {
    const { last } = startHost();
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last().timer).toEqual({ windowId: 1, endsAt: PLAYBACK_CAP_MS + DEFAULT_WINDOWS.diceMs });
  });

  it('ignores playbackDone for another window, and a repeated one', () => {
    const { host, updates } = startHost();
    host.playbackDone('p0', 7);
    expect(updates()).toHaveLength(1);
    host.playbackDone('p0', 1);
    host.playbackDone('p0', 1);
    expect(updates()).toHaveLength(2);
  });

  it('lets each bot act between 0.6 s and 2.5 s into the countdown', () => {
    const { host, last, events } = startHost();
    host.playbackDone('p0', 1);
    vi.advanceTimersByTime(BOT_DELAY_MIN_MS - 1);
    expect(last().view.awaiting.players).toEqual(['p0', 'p1', 'p2', 'p3']);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS - BOT_DELAY_MIN_MS + 1);
    expect(last().view.awaiting.players).toEqual(['p0']);
    const rolled = events().filter((e) => e.type === 'DieRolled').map((e) => e.player);
    expect(rolled.sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('times the window out at endsAt: the human seat rolls automatically and the next window waits for playback', () => {
    const { host, last, events } = startHost();
    host.playbackDone('p0', 1);
    vi.advanceTimersByTime(DEFAULT_WINDOWS.diceMs - 1);
    expect(last().view.awaiting.windowId).toBe(1);
    vi.advanceTimersByTime(1);
    expect(events()).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: true }));
    expect(last().view.awaiting.windowId).toBeGreaterThan(1);
    expect(last().timer).toBeNull();
  });

  it('plays a whole match to the end on timers alone when the human never acts', () => {
    const { last } = startHost();
    vi.runAllTimers();
    expect(last().view.phase.kind).toBe('finished');
    expect(last().view.awaiting.window).toBe('none');
    expect(last().timer).toBeNull();
  });
});

describe('MatchHost visibility (spec #2 §4.2)', () => {
  it('sends only the human seat its own view and events, and never the rng seed', () => {
    const { sent, updates, events } = startHost();
    vi.runAllTimers();
    for (const u of updates()) {
      expect(u.view.me).toBe('p0');
      if (u.view.myOffer) expect(u.view.myOffer.player).toBe('p0');
      for (const e of u.events) expect(e.visibility === 'public' || e.visibility.private === 'p0').toBe(true);
    }
    // The bots were offered cards (their picks were revealed), but their hands never arrived.
    expect(events().some((e) => e.type === 'CardSelected' && e.player !== 'p0')).toBe(true);
    expect(events().some((e) => e.type === 'MysteryOffered' && e.player !== 'p0')).toBe(false);
    expect(JSON.stringify(sent)).not.toContain(SECRET);
  });
});

describe('MatchHost inputs', () => {
  it("applies the human seat's action, even before the countdown starts", () => {
    const { host, last } = startHost();
    host.action('p0', { type: 'roll' }, 1);
    expect(last().events).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: false }));
    expect(last().view.awaiting.players).toEqual(['p1', 'p2', 'p3']);
    expect(last().timer).toBeNull();
  });

  it('rejects a bad action with the engine error code and leaves the match unchanged', () => {
    const { host, sent, updates, last } = startHost();
    host.action('p0', { type: 'roll' }, 99);
    host.action('p0', { type: 'pickCard', slot: 0 }, 1);
    expect(sent.filter((m) => m.type === 'rejected').map((m) => m.error.code)).toEqual(['STALE_INPUT', 'WRONG_PHASE']);
    expect(updates()).toHaveLength(1);
    host.action('p0', { type: 'roll' }, 1);
    expect(last().view.awaiting.players).not.toContain('p0');
  });
});

describe('MatchHost pause and resume (spec #2 C14)', () => {
  it('freezes the countdown and the bots while paused, and sends the new end time on resume', () => {
    const { host, updates, last } = startHost();
    host.playbackDone('p0', 1);
    const endsAt = last().timer!.endsAt;
    host.pause();
    vi.advanceTimersByTime(60_000);
    expect(updates()).toHaveLength(2); // no bot rolled and the window did not time out
    host.resume();
    expect(last().timer).toEqual({ windowId: 1, endsAt: endsAt + 60_000 });
    vi.advanceTimersByTime(DEFAULT_WINDOWS.diceMs);
    expect(last().view.awaiting.windowId).toBeGreaterThan(1);
  });

  it('freezes the playback cap too', () => {
    const { host, last } = startHost();
    host.pause();
    vi.advanceTimersByTime(60_000);
    expect(last().timer).toBeNull();
    host.resume();
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last().timer).not.toBeNull();
  });
});

describe('MatchHost failures', () => {
  it('fails and stops when the match cannot be created', () => {
    const sent: FromHost[] = [];
    const host = new MatchHost({ send: (_to, msg) => sent.push(msg) });
    host.create([SOLO[0]!, SOLO[0]!], 's', 'r');
    expect(sent).toEqual([{ type: 'failed', message: 'player ids must be unique' }]);
    host.action('p0', { type: 'roll' }, 1);
    expect(sent).toHaveLength(1);
  });

  it('fails and stops when a timer throws, such as an engine InvariantError', () => {
    vi.spyOn(HeuristicBot.prototype, 'decide').mockImplementation(() => {
      throw new InvariantError('board corrupted');
    });
    const { host, sent } = startHost();
    host.playbackDone('p0', 1);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(sent.at(-1)).toEqual({ type: 'failed', message: 'board corrupted' });
    const count = sent.length;
    vi.runAllTimers();
    host.resume();
    expect(sent).toHaveLength(count);
  });

  it('stops on stop', () => {
    const { host, sent } = startHost();
    host.playbackDone('p0', 1);
    host.stop();
    const count = sent.length;
    vi.runAllTimers();
    expect(sent).toHaveLength(count);
  });
});

describe('MatchHost fast mode (e2e builds, spec #2 §9.3)', () => {
  it('plays every seat itself, the human one included, and finishes a match quickly', () => {
    const sent: FromHost[] = [];
    const host = new MatchHost({ send: (_to, msg) => sent.push(msg), fast: true });
    host.create(SOLO, 'board-seed', SECRET);
    const events = () => sent.flatMap((m) => (m.type === 'update' ? m.update.events : []));
    for (let t = 0; t < 600_000 && !events().some((e) => e.type === 'MatchWon'); t += 100) vi.advanceTimersByTime(100);
    expect(events().some((e) => e.type === 'MatchWon')).toBe(true);
    const myRolls = events().filter((e) => e.type === 'DieRolled' && e.player === 'p0');
    expect(myRolls.length).toBeGreaterThan(0);
    expect(myRolls.every((e) => e.type === 'DieRolled' && !e.auto)).toBe(true);
    expect(sent.some((m) => m.type === 'failed' || m.type === 'rejected')).toBe(false);
  });
});
```

Run: `pnpm vitest run packages/host/test/matchHost.test.ts`
Expected: FAIL, `Cannot find module '../src/matchHost'` (or `Failed to resolve import`).

- [ ] **Step 4: Write `MatchHost`.** Create `packages/host/src/matchHost.ts`:

```ts
import { makeBots, type Bot } from '@laddorious/bots';
import { awaiting, createMatch, eventsFor, step, viewFor, type GameEvent, type Input, type MatchState, type PlayerId } from '@laddorious/core';
import { PausableTimers } from './timers';
import type { FromHost, MatchUpdate, PlayerAction, Seat } from './types';

/** How long a new window waits for the humans' playbackDone before its countdown starts anyway (spec #2 C13). */
export const PLAYBACK_CAP_MS = 12_000;
/** Each awaited bot acts at a random moment this far into the countdown (spec #2 §4.4). */
export const BOT_DELAY_MIN_MS = 600;
export const BOT_DELAY_MAX_MS = 2_500;
/** Fast mode (e2e builds, spec #2 §9.3): every seat plays itself at once and windows are short, so a match takes seconds. */
export const FAST = { windows: { diceMs: 1500, challengeMs: 1500, mysteryMs: 1500 }, botDelayMinMs: 20, botDelayMaxMs: 80, playbackCapMs: 1500 } as const;

export interface MatchHostOptions {
  /** Delivers a message to one human seat. */
  send(to: PlayerId, msg: FromHost): void;
  /** e2e builds: bots play every seat, the humans' too, with short windows (spec #2 §9.3). */
  fast?: boolean;
}

/**
 * One match (spec #4 §3.1): the engine state, the window timers and the bots, for any mix of
 * humans and bots. The offline Web Worker and the server's match room both run it, and tests
 * drive it with fake timers. Each human only ever receives their own view and events (spec #2 §4.2).
 */
export class MatchHost {
  private match: MatchState | null = null;
  private humans: PlayerId[] = [];
  private bots: Record<PlayerId, Bot> = {};
  /** The window the current timers belong to. */
  private windowId = 0;
  /** Humans who haven't yet watched the events that opened the current window. */
  private watching = new Set<PlayerId>();
  private stopped = false;
  private readonly fast: boolean;
  private readonly timers = new PausableTimers();

  constructor(private readonly opts: MatchHostOptions) {
    this.fast = opts.fast ?? false;
  }

  create(seats: readonly Seat[], seed: string, rngSeed: string): void {
    this.guard(() => {
      this.humans = [...new Set(seats.filter((s) => !s.bot).map((s) => s.playerId))];
      // In fast mode a bot plays the human seats too.
      const played = this.fast ? seats : seats.filter((s) => s.bot);
      this.bots = makeBots(played.map((s) => ({ id: s.playerId })), 'heuristic', rngSeed, 0);
      this.match = createMatch(this.fast ? { seed, rngSeed, windows: FAST.windows } : { seed, rngSeed }, seats.map((s) => ({ id: s.playerId })));
      this.afterStep([]);
    });
  }

  /** A human seat's input. Engine errors go back to that seat as `rejected`; the match is unchanged. */
  action(player: PlayerId, action: PlayerAction, windowId: number): void {
    this.guard(() => {
      const result = step(this.state(), { ...action, player, windowId });
      if (!result.ok) {
        this.opts.send(player, { type: 'rejected', error: result.error });
        return;
      }
      this.match = result.state;
      this.afterStep(result.events);
    });
  }

  /** A human has watched the events that opened this window. The countdown starts once every human has (C13). */
  playbackDone(player: PlayerId, windowId: number): void {
    this.guard(() => {
      if (windowId !== this.windowId || !this.timers.has('playback')) return;
      this.watching.delete(player);
      if (this.watching.size === 0) this.startCountdown();
    });
  }

  pause(): void {
    this.guard(() => this.timers.pause());
  }

  resume(): void {
    this.guard(() => {
      this.timers.resume();
      if (this.timers.has('countdown')) this.sendUpdates([]); // the countdown now ends later
    });
  }

  stop(): void {
    this.stopped = true;
    this.timers.clearAll();
  }

  /** Bot and timeout inputs are built from the current state, so a rejection here is a host bug. */
  private apply(input: Input): void {
    const result = step(this.state(), input);
    if (!result.ok) throw new Error(`host input rejected: ${result.error.code} ${result.error.message}`);
    this.match = result.state;
    this.afterStep(result.events);
  }

  private afterStep(events: GameEvent[]): void {
    const aw = awaiting(this.state());
    if (aw.windowId !== this.windowId) {
      // A new window: no countdown until the humans have watched the events (C13).
      this.timers.clearAll();
      this.windowId = aw.windowId;
      this.watching = new Set(this.humans);
      if (aw.window !== 'none') this.timers.set('playback', this.fast ? FAST.playbackCapMs : PLAYBACK_CAP_MS, () => this.guard(() => this.startCountdown()));
    } else if (this.timers.has('countdown')) {
      this.scheduleBots(); // a bot that rerolled a card still has to pick
    }
    this.sendUpdates(events);
  }

  private startCountdown(): void {
    this.timers.clear('playback');
    const aw = awaiting(this.state());
    this.timers.set('countdown', aw.durationMs, () => this.guard(() => this.apply({ type: 'timeout', windowId: aw.windowId })));
    this.scheduleBots();
    this.sendUpdates([]);
  }

  private scheduleBots(): void {
    for (const id of awaiting(this.state()).players) {
      const bot = this.bots[id];
      const key = `bot:${id}`;
      if (!bot || this.timers.has(key)) continue;
      const [min, max] = this.fast ? [FAST.botDelayMinMs, FAST.botDelayMaxMs] : [BOT_DELAY_MIN_MS, BOT_DELAY_MAX_MS];
      const delay = min + Math.random() * (max - min);
      this.timers.set(key, delay, () =>
        this.guard(() => {
          const input = bot.decide(viewFor(this.state(), id));
          if (input !== 'idle') this.apply(input);
        }),
      );
    }
  }

  /** Every human gets their own view and events. */
  private sendUpdates(events: GameEvent[]): void {
    for (const id of this.humans) this.opts.send(id, { type: 'update', update: this.updateFor(id, events) });
  }

  private updateFor(player: PlayerId, events: GameEvent[]): MatchUpdate {
    const endsAt = this.timers.dueAt('countdown');
    return { view: viewFor(this.state(), player), events: eventsFor(events, player), timer: endsAt === undefined ? null : { windowId: this.windowId, endsAt } };
  }

  /** Every entry point runs here: an escaping exception (an engine InvariantError included) ends the match. */
  private guard(fn: () => void): void {
    if (this.stopped) return;
    try {
      fn();
    } catch (err) {
      this.stop();
      const message = err instanceof Error ? err.message : String(err);
      for (const id of this.humans) this.opts.send(id, { type: 'failed', message });
    }
  }

  private state(): MatchState {
    if (!this.match) throw new Error('no match yet: create comes first');
    return this.match;
  }
}
```

Run: `pnpm vitest run packages/host/test`
Expected: PASS (all tests in `matchHost.test.ts` and `timers.test.ts`).

- [ ] **Step 5: Pin the adapter's behaviour before changing it.** Replace `apps/client/test/localHost.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalHost } from '../src/worker/localHost';
import type { FromHost } from '../src/worker/protocol';
import { SEATS } from './support/fixtures';

// The host's own rules are tested in packages/host; this checks the worker's messages reach it.

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

function startHost() {
  const sent: FromHost[] = [];
  const host = new LocalHost((msg) => sent.push(structuredClone(msg)));
  host.handle({ type: 'create', seats: SEATS, seed: 'board-seed', rngSeed: 'secret' });
  const updates = () => sent.filter((m) => m.type === 'update').map((m) => m.update);
  return { host, sent, updates, last: () => updates().at(-1)! };
}

describe('LocalHost (the offline worker, spec #2 §4.4)', () => {
  it('starts the match and sends the human seat its opening view', () => {
    const { updates, last } = startHost();
    expect(updates()).toHaveLength(1);
    expect(last().view.me).toBe('p0');
  });

  it("passes the human seat's roll and playback to the match host", () => {
    const { host, last } = startHost();
    host.handle({ type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(last().events).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: false }));
    host.handle({ type: 'playbackDone', windowId: 1 });
    expect(last().timer).not.toBeNull();
  });

  it('freezes on pause and goes quiet on leave', () => {
    const { host, sent } = startHost();
    host.handle({ type: 'playbackDone', windowId: 1 });
    host.handle({ type: 'pause' });
    const count = sent.length;
    vi.advanceTimersByTime(60_000);
    expect(sent).toHaveLength(count);
    host.handle({ type: 'resume' });
    host.handle({ type: 'leave' });
    const after = sent.length;
    vi.runAllTimers();
    expect(sent).toHaveLength(after);
  });

  it('fails a match without a human seat', () => {
    const sent: FromHost[] = [];
    new LocalHost((msg) => sent.push(msg)).handle({ type: 'create', seats: SEATS.map((s) => ({ ...s, bot: true })), seed: 's', rngSeed: 'r' });
    expect(sent).toEqual([{ type: 'failed', message: 'a local match needs a human seat' }]);
  });
});
```

Run: `pnpm vitest run apps/client/test/localHost.test.ts`
Expected: PASS (4 tests) against the old `LocalHost`. These pin what the adapter must keep doing.

- [ ] **Step 6: Point the client at the host package.**

In `apps/client/src/service/matchService.ts`, replace the imports, the header comment and the `PieceId`, `PIECES`, `Profile`, `SeatInfo`, `PlayerAction` and `MatchUpdate` declarations with:

```ts
import type { InputErrorCode, PlayerId } from '@laddorious/core';
import type { MatchUpdate, PlayerAction, Profile, Seat } from '@laddorious/host';

// The contract between the screens and a match (spec #2 §4.3). LocalMatchService implements it
// with a Web Worker, and OnlineMatchService over the network (spec #4). The match types are
// shared with the host (packages/host).

export { PIECES, type MatchUpdate, type PieceId, type PlayerAction, type Profile } from '@laddorious/host';

/** A seat as the screens show it: the shared seat plus its colour (spec #4 M10). */
export interface SeatInfo extends Seat {
  color: string;
}
```

Keep `MatchmakingState`, `FindOptions`, `MatchService`, `Matchmaking` and `MatchSession` as they are.

In `apps/client/src/worker/protocol.ts`, replace the imports and the `FromHost` declaration with:

```ts
import type { FromHost } from '@laddorious/host';
import type { PlayerAction, SeatInfo } from '../service/matchService';

/** Host worker → main thread: only what a remote player would receive (spec #2 §4.2). */
export type { FromHost } from '@laddorious/host';
```

Keep `ToHost` and `HostWorker` as they are.

Replace `apps/client/src/worker/localHost.ts` with:

```ts
import type { PlayerId } from '@laddorious/core';
import { MatchHost } from '@laddorious/host';
import type { FromHost, ToHost } from './protocol';

/**
 * The offline match (spec #2 §4.4): the worker's messages for its one human seat, passed to the
 * shared MatchHost (spec #4 §3.1). A plain class so tests can drive it; host.worker.ts runs it.
 */
export class LocalHost {
  private host: MatchHost | null = null;
  private me: PlayerId = '';

  constructor(private readonly post: (msg: FromHost) => void) {}

  handle(msg: ToHost): void {
    if (msg.type === 'create') {
      const human = msg.seats.find((s) => !s.bot);
      if (!human) {
        this.post({ type: 'failed', message: 'a local match needs a human seat' });
        return;
      }
      this.me = human.playerId;
      this.host = new MatchHost({ send: (_to, out) => this.post(out), fast: msg.fast ?? false });
      this.host.create(msg.seats, msg.seed, msg.rngSeed);
      return;
    }
    const host = this.host;
    if (!host) return;
    switch (msg.type) {
      case 'action':
        host.action(this.me, msg.action, msg.windowId);
        return;
      case 'playbackDone':
        host.playbackDone(this.me, msg.windowId);
        return;
      case 'pause':
        host.pause();
        return;
      case 'resume':
        host.resume();
        return;
      case 'leave':
        host.stop();
        return;
    }
  }
}
```

- [ ] **Step 7: Run everything.**

Run: `pnpm vitest run apps/client/test/localHost.test.ts apps/client/test/workerSession.test.ts apps/client/test/localMatchService.test.ts packages/host`
Expected: PASS. `workerSession.test.ts` still plays a whole match through `loopbackWorker`.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green, with no test lost: the host tests moved, they didn't vanish.

- [ ] **Step 8: Commit.**

```bash
git add -A packages/host apps/client package.json pnpm-lock.yaml
git commit -m "refactor(host): move the match host into packages/host"
```

(With the trailer.)

### Task 2: The host with several humans: away seats, resync and the end

**Files:**
- Modify: `packages/host/src/matchHost.ts`, `packages/host/test/matchHost.test.ts`

**Interfaces:**
- **Consumes:** Task 1's `MatchHost`.
- **Produces:**
  - `MatchHostOptions.onEnd?(outcome: 'won' | 'failed'): void`, called once;
  - `MatchHost.setAway(player, away: boolean)`;
  - `MatchHost.resync(player)`: sends that player `{ view, events: [], timer }`;
  - updates go only to connected (not away) humans;
  - playback waits only for connected humans;
  - a window that only away humans are left in times out at once, but only while at least one human is connected.

- [ ] **Step 1: Write the failing tests.** Append to `packages/host/test/matchHost.test.ts`. Extend the imports first:

```ts
import { DEFAULT_WINDOWS, InvariantError, type PlayerId } from '@laddorious/core';
import { BOT_DELAY_MAX_MS, BOT_DELAY_MIN_MS, MatchHost, PLAYBACK_CAP_MS, type MatchHostOptions } from '../src/matchHost';
import type { FromHost, MatchUpdate, Seat } from '../src/types';
```

Then at the end of the file:

```ts
/** Two humans and two bots, as an online table seats them. */
const PAIR: Seat[] = [
  { playerId: 'p0', nickname: 'Ari', piece: 'knight', bot: false },
  { playerId: 'p1', nickname: 'Bo', piece: 'pawn', bot: false },
  { playerId: 'p2', nickname: 'Mochi', piece: 'meeple', bot: true },
  { playerId: 'p3', nickname: 'Pip', piece: 'dragon', bot: true },
];

/** A host with two humans; what it sends is recorded per seat. */
function startTable(opts: Omit<MatchHostOptions, 'send'> = {}) {
  const sent: Array<{ to: PlayerId; msg: FromHost }> = [];
  const host = new MatchHost({ send: (to, msg) => sent.push({ to, msg: structuredClone(msg) }), ...opts });
  host.create(PAIR, 'board-seed', SECRET);
  const updates = (to: PlayerId): MatchUpdate[] => sent.flatMap((s) => (s.to === to && s.msg.type === 'update' ? [s.msg.update] : []));
  const last = (to: PlayerId) => updates(to).at(-1)!;
  const events = (to: PlayerId) => updates(to).flatMap((u) => u.events);
  return { host, sent, updates, last, events };
}

describe('MatchHost with several humans (spec #4 §3.1)', () => {
  it('sends each human only their own view and events', () => {
    const { sent, updates, events } = startTable();
    vi.runAllTimers();
    for (const me of ['p0', 'p1']) {
      expect(updates(me).length).toBeGreaterThan(10);
      for (const u of updates(me)) {
        expect(u.view.me).toBe(me);
        for (const e of u.events) expect(e.visibility === 'public' || e.visibility.private === me).toBe(true);
      }
      expect(events(me).some((e) => e.type === 'MysteryOffered' && e.player !== me)).toBe(false);
    }
    expect(updates('p0')).toHaveLength(updates('p1').length);
    expect(sent.every((s) => s.to === 'p0' || s.to === 'p1')).toBe(true);
    expect(JSON.stringify(sent)).not.toContain(SECRET);
  });

  it('starts the countdown once every connected human has watched the playback', () => {
    const { host, last } = startTable();
    vi.advanceTimersByTime(2000);
    host.playbackDone('p0', 1);
    expect(last('p0').timer).toBeNull();
    host.playbackDone('p1', 1);
    expect(last('p0').timer).toEqual({ windowId: 1, endsAt: 2000 + DEFAULT_WINDOWS.diceMs });
    expect(last('p1').timer).toEqual(last('p0').timer);
  });

  it('caps the wait for a slow player at 12 s', () => {
    const { host, last } = startTable();
    host.playbackDone('p0', 1);
    vi.advanceTimersByTime(PLAYBACK_CAP_MS);
    expect(last('p1').timer).toEqual({ windowId: 1, endsAt: PLAYBACK_CAP_MS + DEFAULT_WINDOWS.diceMs });
  });

  it("applies each human's action to their own seat, and rejects only to the sender", () => {
    const { host, sent, events, last } = startTable();
    host.action('p1', { type: 'roll' }, 1);
    expect(events('p0')).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p1', auto: false }));
    expect(last('p0').view.awaiting.players).toEqual(['p0', 'p2', 'p3']);
    host.action('p0', { type: 'pickCard', slot: 0 }, 1);
    expect(sent.filter((s) => s.msg.type === 'rejected').map((s) => s.to)).toEqual(['p0']);
  });

  it('stops updating an away human and never waits for their playback; a returning human hears again', () => {
    const { host, updates, last } = startTable();
    host.setAway('p1', true);
    const before = updates('p1').length;
    host.playbackDone('p0', 1);
    expect(last('p0').timer).not.toBeNull();
    expect(updates('p1')).toHaveLength(before);
    host.setAway('p1', false);
    host.action('p0', { type: 'roll' }, 1);
    expect(updates('p1').length).toBeGreaterThan(before);
  });

  it('times a window out at once when only away humans are left in it (spec #4 M3)', () => {
    const { host, events, last } = startTable();
    host.setAway('p1', true);
    host.playbackDone('p0', 1);
    host.action('p0', { type: 'roll' }, 1);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS); // the bots roll; only the away seat is left
    expect(BOT_DELAY_MAX_MS).toBeLessThan(DEFAULT_WINDOWS.diceMs); // well before the window's own timeout
    expect(events('p0')).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p1', auto: true }));
    expect(last('p0').view.awaiting.windowId).toBeGreaterThan(1);
  });

  it('never closes windows early while no human is connected', () => {
    const { host, last } = startTable();
    host.setAway('p0', true);
    host.setAway('p1', true);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    host.setAway('p0', false);
    host.resync('p0');
    expect(last('p0').view.awaiting).toMatchObject({ windowId: 1, players: ['p0', 'p1'] });
  });

  it('resyncs one human with the current view, no events and the running countdown', () => {
    const { host, sent, last } = startTable();
    host.playbackDone('p0', 1);
    host.playbackDone('p1', 1);
    const count = sent.length;
    host.resync('p1');
    expect(sent.slice(count).map((s) => s.to)).toEqual(['p1']);
    expect(last('p1')).toMatchObject({ events: [], timer: { windowId: 1, endsAt: DEFAULT_WINDOWS.diceMs } });
    expect(last('p1').view.me).toBe('p1');
  });

  it('reports the end once when the match is won', () => {
    const onEnd = vi.fn();
    const host = new MatchHost({ send: () => {}, onEnd });
    host.create(SOLO, 'board-seed', SECRET);
    vi.runAllTimers();
    expect(onEnd.mock.calls).toEqual([['won']]);
  });

  it('tells every human and reports the end when the host fails', () => {
    vi.spyOn(HeuristicBot.prototype, 'decide').mockImplementation(() => {
      throw new InvariantError('board corrupted');
    });
    const onEnd = vi.fn();
    const { host, sent } = startTable({ onEnd });
    host.playbackDone('p0', 1);
    host.playbackDone('p1', 1);
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    expect(sent.filter((s) => s.msg.type === 'failed').map((s) => s.to)).toEqual(['p0', 'p1']);
    expect(onEnd.mock.calls).toEqual([['failed']]);
  });
});
```

Run: `pnpm vitest run packages/host/test/matchHost.test.ts`
Expected: FAIL. `host.setAway is not a function`, `host.resync is not a function`, and `onEnd` is never called. Task 1's tests still pass.

- [ ] **Step 2: Implement.** Replace `packages/host/src/matchHost.ts` with:

```ts
import { makeBots, type Bot } from '@laddorious/bots';
import { awaiting, createMatch, eventsFor, step, viewFor, type GameEvent, type Input, type MatchState, type PlayerId } from '@laddorious/core';
import { PausableTimers } from './timers';
import type { FromHost, MatchUpdate, PlayerAction, Seat } from './types';

/** How long a new window waits for the humans' playbackDone before its countdown starts anyway (spec #2 C13). */
export const PLAYBACK_CAP_MS = 12_000;
/** Each awaited bot acts at a random moment this far into the countdown (spec #2 §4.4). */
export const BOT_DELAY_MIN_MS = 600;
export const BOT_DELAY_MAX_MS = 2_500;
/** Fast mode (e2e builds, spec #2 §9.3): every seat plays itself at once and windows are short, so a match takes seconds. */
export const FAST = { windows: { diceMs: 1500, challengeMs: 1500, mysteryMs: 1500 }, botDelayMinMs: 20, botDelayMaxMs: 80, playbackCapMs: 1500 } as const;

export interface MatchHostOptions {
  /** Delivers a message to one human seat. */
  send(to: PlayerId, msg: FromHost): void;
  /** e2e builds: bots play every seat, the humans' too, with short windows (spec #2 §9.3). */
  fast?: boolean;
  /** Called once, when the match is won or the host fails. */
  onEnd?(outcome: 'won' | 'failed'): void;
}

/**
 * One match (spec #4 §3.1): the engine state, the window timers and the bots, for any mix of
 * humans and bots. The offline Web Worker and the server's match room both run it, and tests
 * drive it with fake timers. Each human only ever receives their own view and events (spec #2 §4.2).
 * A human whose connection is gone is away: no bot plays for them, and their windows run on
 * the engine's timeouts (spec #4 M2, M3).
 */
export class MatchHost {
  private match: MatchState | null = null;
  private humans: PlayerId[] = [];
  private readonly away = new Set<PlayerId>();
  private bots: Record<PlayerId, Bot> = {};
  /** The window the current timers belong to. */
  private windowId = 0;
  /** Connected humans who haven't yet watched the events that opened the current window. */
  private watching = new Set<PlayerId>();
  private stopped = false;
  private ended = false;
  private readonly fast: boolean;
  private readonly timers = new PausableTimers();

  constructor(private readonly opts: MatchHostOptions) {
    this.fast = opts.fast ?? false;
  }

  create(seats: readonly Seat[], seed: string, rngSeed: string): void {
    this.guard(() => {
      this.humans = [...new Set(seats.filter((s) => !s.bot).map((s) => s.playerId))];
      // In fast mode a bot plays the human seats too.
      const played = this.fast ? seats : seats.filter((s) => s.bot);
      this.bots = makeBots(played.map((s) => ({ id: s.playerId })), 'heuristic', rngSeed, 0);
      this.match = createMatch(this.fast ? { seed, rngSeed, windows: FAST.windows } : { seed, rngSeed }, seats.map((s) => ({ id: s.playerId })));
      this.afterStep([]);
    });
  }

  /** A human seat's input. Engine errors go back to that seat as `rejected`; the match is unchanged. */
  action(player: PlayerId, action: PlayerAction, windowId: number): void {
    this.guard(() => {
      const result = step(this.state(), { ...action, player, windowId });
      if (!result.ok) {
        this.opts.send(player, { type: 'rejected', error: result.error });
        return;
      }
      this.match = result.state;
      this.afterStep(result.events);
    });
  }

  /** A human has watched the events that opened this window. The countdown starts once every connected human has (C13). */
  playbackDone(player: PlayerId, windowId: number): void {
    this.guard(() => {
      if (windowId !== this.windowId || !this.timers.has('playback')) return;
      this.watching.delete(player);
      if (this.watching.size === 0) this.startCountdown();
    });
  }

  /** A human seat lost (true) or regained (false) its connection (spec #4 §5.2). */
  setAway(player: PlayerId, away: boolean): void {
    this.guard(() => {
      if (!this.humans.includes(player) || this.away.has(player) === away) return;
      if (away) {
        this.away.add(player);
        // Nobody waits for an away human's playback.
        if (this.timers.has('playback') && this.watching.delete(player) && this.watching.size === 0) this.startCountdown();
      } else {
        this.away.delete(player);
      }
      this.closeEarly();
    });
  }

  /** Sends one human the current view with no events, e.g. after they rejoin (spec #4 §5.2). */
  resync(player: PlayerId): void {
    this.guard(() => {
      if (this.humans.includes(player)) this.opts.send(player, { type: 'update', update: this.updateFor(player, []) });
    });
  }

  pause(): void {
    this.guard(() => this.timers.pause());
  }

  resume(): void {
    this.guard(() => {
      this.timers.resume();
      if (this.timers.has('countdown')) this.sendUpdates([]); // the countdown now ends later
    });
  }

  stop(): void {
    this.stopped = true;
    this.timers.clearAll();
  }

  /** Bot and timeout inputs are built from the current state, so a rejection here is a host bug. */
  private apply(input: Input): void {
    const result = step(this.state(), input);
    if (!result.ok) throw new Error(`host input rejected: ${result.error.code} ${result.error.message}`);
    this.match = result.state;
    this.afterStep(result.events);
  }

  private afterStep(events: GameEvent[]): void {
    const aw = awaiting(this.state());
    if (aw.windowId !== this.windowId) {
      // A new window: no countdown until the connected humans have watched the events (C13).
      this.timers.clearAll();
      this.windowId = aw.windowId;
      this.watching = new Set(this.connected());
      if (aw.window !== 'none') this.timers.set('playback', this.fast ? FAST.playbackCapMs : PLAYBACK_CAP_MS, () => this.guard(() => this.startCountdown()));
    } else if (this.timers.has('countdown')) {
      this.scheduleBots(); // a bot that rerolled a card still has to pick
    }
    this.sendUpdates(events);
    if (this.state().phase.kind === 'finished') this.end('won');
    else this.closeEarly();
  }

  private startCountdown(): void {
    this.timers.clear('playback');
    const aw = awaiting(this.state());
    this.timers.set('countdown', aw.durationMs, () => this.guard(() => this.apply({ type: 'timeout', windowId: aw.windowId })));
    this.scheduleBots();
    this.sendUpdates([]);
  }

  /**
   * When every seat the window still waits for is an away human, nobody is going to act: time
   * it out now (spec #4 M3). Not while nobody is connected: then the room pauses the match.
   */
  private closeEarly(): void {
    const aw = awaiting(this.state());
    if (aw.window === 'none' || aw.players.length === 0 || this.connected().length === 0) return;
    if (aw.players.every((id) => this.away.has(id) && !this.bots[id])) this.apply({ type: 'timeout', windowId: aw.windowId });
  }

  private scheduleBots(): void {
    for (const id of awaiting(this.state()).players) {
      const bot = this.bots[id];
      const key = `bot:${id}`;
      if (!bot || this.timers.has(key)) continue;
      const [min, max] = this.fast ? [FAST.botDelayMinMs, FAST.botDelayMaxMs] : [BOT_DELAY_MIN_MS, BOT_DELAY_MAX_MS];
      const delay = min + Math.random() * (max - min);
      this.timers.set(key, delay, () =>
        this.guard(() => {
          const input = bot.decide(viewFor(this.state(), id));
          if (input !== 'idle') this.apply(input);
        }),
      );
    }
  }

  /** Every connected human gets their own view and events. */
  private sendUpdates(events: GameEvent[]): void {
    for (const id of this.connected()) this.opts.send(id, { type: 'update', update: this.updateFor(id, events) });
  }

  private updateFor(player: PlayerId, events: GameEvent[]): MatchUpdate {
    const endsAt = this.timers.dueAt('countdown');
    return { view: viewFor(this.state(), player), events: eventsFor(events, player), timer: endsAt === undefined ? null : { windowId: this.windowId, endsAt } };
  }

  private connected(): PlayerId[] {
    return this.humans.filter((id) => !this.away.has(id));
  }

  private end(outcome: 'won' | 'failed'): void {
    if (this.ended) return;
    this.ended = true;
    this.opts.onEnd?.(outcome);
  }

  /** Every entry point runs here: an escaping exception (an engine InvariantError included) ends the match. */
  private guard(fn: () => void): void {
    if (this.stopped) return;
    try {
      fn();
    } catch (err) {
      this.stop();
      const message = err instanceof Error ? err.message : String(err);
      for (const id of this.humans) this.opts.send(id, { type: 'failed', message });
      this.end('failed');
    }
  }

  private state(): MatchState {
    if (!this.match) throw new Error('no match yet: create comes first');
    return this.match;
  }
}
```

Run: `pnpm vitest run packages/host/test/matchHost.test.ts`
Expected: PASS (all of Task 1's tests and the 10 new ones).

- [ ] **Step 3: Run the suite.** `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green. Offline play is unchanged: one human is never away.

- [ ] **Step 4: Commit.** `git commit -am "feat(host): several humans, away seats, resync and the match's end"` (with the trailer).

### Task 3: Seats, the wire protocol and seat colours by seat order

**Files:**
- Create: `packages/host/src/seats.ts`, `packages/host/src/protocol.ts`, `packages/host/test/seats.test.ts`, `apps/client/src/service/seats.ts`, `apps/client/test/seats.test.ts`
- Modify:
  - `packages/host/src/index.ts`;
  - `apps/client/src/app/theme.ts` (`SEAT_COLORS` becomes a list in seat order);
  - `apps/client/src/app/MenuScreen.tsx`, `apps/client/src/scene/MenuScene.tsx` (`SEAT_COLORS.you` → `SEAT_COLORS[0]`);
  - `apps/client/src/service/localMatchService.ts` (uses `buildSeats`, `colorSeats`, `randomHex`).

**Interfaces:**
- **Consumes:** `Seat`, `Profile`, `PIECES`, `MatchUpdate`, `PlayerAction` (Task 1).
- **Produces:**
  - `BOT_NAMES`, `TABLE_SIZE = 4`;
  - `buildSeats(humans: readonly Profile[], botNames?: readonly string[]): Seat[]`;
  - `randomHex(bytes = 16): string`;
  - `PROTOCOL_VERSION = 1`, `FailReason`, `LobbyIn`, `LobbyOut`, `MatchIn`, `MatchOut`;
  - client: `SEAT_COLORS: readonly [pink, blue, lime, purple]`, `colorSeat(seat, index): SeatInfo`, `colorSeats(seats): SeatInfo[]`.

- [ ] **Step 1: Write the failing tests.** Create `packages/host/test/seats.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BOT_NAMES, buildSeats, randomHex } from '../src/seats';

describe('buildSeats (spec #4 §4)', () => {
  it('seats one human, then Mochi, Pip and Juno on the pieces the human left, in picker order', () => {
    expect(buildSeats([{ nickname: 'Ari', piece: 'meeple' }])).toEqual([
      { playerId: 'p0', nickname: 'Ari', piece: 'meeple', bot: false },
      { playerId: 'p1', nickname: 'Mochi', piece: 'knight', bot: true },
      { playerId: 'p2', nickname: 'Pip', piece: 'pawn', bot: true },
      { playerId: 'p3', nickname: 'Juno', piece: 'dragon', bot: true },
    ]);
  });

  it('keeps humans in join order, lets their pieces repeat, and gives the bots unused pieces (M10)', () => {
    const seats = buildSeats([
      { nickname: 'Ari', piece: 'knight' },
      { nickname: 'Bo', piece: 'knight' },
      { nickname: 'Cy', piece: 'pawn' },
    ]);
    expect(seats.map((s) => [s.playerId, s.nickname, s.piece, s.bot])).toEqual([
      ['p0', 'Ari', 'knight', false],
      ['p1', 'Bo', 'knight', false],
      ['p2', 'Cy', 'pawn', false],
      ['p3', 'Mochi', 'meeple', true],
    ]);
  });

  it('seats four humans with no bots', () => {
    const four = ['A', 'B', 'C', 'D'].map((nickname) => ({ nickname, piece: 'dragon' as const }));
    expect(buildSeats(four).map((s) => s.bot)).toEqual([false, false, false, false]);
    expect(BOT_NAMES).toEqual(['Mochi', 'Pip', 'Juno']);
  });
});

describe('randomHex', () => {
  it('makes 128 random bits as 32 hex characters', () => {
    const a = randomHex();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(randomHex()).not.toBe(a);
  });
});
```

Create `apps/client/test/seats.test.ts`:

```ts
import { buildSeats } from '@laddorious/host';
import { describe, expect, it } from 'vitest';
import { colorSeat, colorSeats } from '../src/service/seats';

describe('seat colours (spec #4 M10)', () => {
  it('colours seats by their place at the table: pink, blue, lime, purple', () => {
    const seats = buildSeats([{ nickname: 'Ari', piece: 'knight' }, { nickname: 'Bo', piece: 'pawn' }]);
    expect(colorSeats(seats).map((s) => s.color)).toEqual(['#ff5470', '#3b82f6', '#a3e635', '#8b5cf6']);
    expect(colorSeat(seats[1]!, 1)).toEqual({ ...seats[1], color: '#3b82f6' });
  });
});
```

Run: `pnpm vitest run packages/host/test/seats.test.ts apps/client/test/seats.test.ts`
Expected: FAIL, the modules don't exist.

- [ ] **Step 2: Implement the host side.** Create `packages/host/src/seats.ts`:

```ts
import { PIECES, type Profile, type Seat } from './types';

/** The bots' names, in the order they take seats (spec #2 §4.4). */
export const BOT_NAMES = ['Mochi', 'Pip', 'Juno'] as const;
/** Every match has four seats. */
export const TABLE_SIZE = 4;

/**
 * A table's seats (spec #4 §4): the humans first, in join order, then bots in the empty seats.
 * Bots take the pieces no human chose, in picker order. Names and pieces may repeat (M10).
 * Four seats always leave at least as many free pieces as bots.
 */
export function buildSeats(humans: readonly Profile[], botNames: readonly string[] = BOT_NAMES): Seat[] {
  const taken = new Set(humans.map((h) => h.piece));
  const free = PIECES.filter((p) => !taken.has(p));
  const seats: Seat[] = humans.map((h, i) => ({ playerId: `p${i}`, nickname: h.nickname, piece: h.piece, bot: false }));
  for (let b = 0; seats.length < TABLE_SIZE; b++) {
    seats.push({ playerId: `p${seats.length}`, nickname: botNames[b]!, piece: free[b]!, bot: true });
  }
  return seats;
}

/** Random bits as hex (128 by default) from the platform's secure generator: seeds and rejoin tokens. */
export function randomHex(bytes = 16): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}
```

Create `packages/host/src/protocol.ts`:

```ts
import type { InputError, PlayerId } from '@laddorious/core';
import type { MatchUpdate, PlayerAction, Profile, Seat } from './types';

// The messages between the game and the multiplayer server (spec #4 §6): JSON text frames,
// one object with a `type` each.

/** Bumped whenever these messages change. The game and the server are built from the same commit. */
export const PROTOCOL_VERSION = 1;

/** Why the server ended a lobby or match connection. */
export type FailReason = 'version' | 'bad-token' | 'seat-lost' | 'server-error';

/** Game → server on /lobby. `hello` comes first. */
export type LobbyIn =
  | { type: 'hello'; version: number; profile: Profile }
  | { type: 'find' }
  | { type: 'cancel' }
  | { type: 'playWithBots' }
  | { type: 'ping'; t: number };

/** Server → game on /lobby. `seats` are in table order; `you` is your own seat's index in it. */
export type LobbyOut =
  | { type: 'matchmaking'; state: 'searching' | 'filling'; seats: Array<Seat | null>; you: number; elapsedMs: number }
  | { type: 'found'; matchId: string; me: PlayerId; seats: Seat[]; token: string }
  | { type: 'pong'; t: number; serverTime: number }
  | { type: 'failed'; reason: FailReason; message: string };

/** Game → server on /match/:id. `join` comes first. Actions name no player: the server uses the joined seat (spec #4 §7). */
export type MatchIn =
  | { type: 'join'; token: string }
  | { type: 'action'; action: PlayerAction; windowId: number }
  | { type: 'playbackDone'; windowId: number }
  | { type: 'leave' }
  | { type: 'ping'; t: number };

/** Server → game on /match/:id. */
export type MatchOut =
  | { type: 'welcome'; me: PlayerId; seats: Seat[]; serverTime: number }
  | { type: 'update'; update: MatchUpdate }
  | { type: 'rejected'; error: InputError }
  | { type: 'presence'; away: PlayerId[] }
  | { type: 'pong'; t: number; serverTime: number }
  | { type: 'failed'; reason: FailReason; message: string };
```

Add to `packages/host/src/index.ts`:

```ts
export * from './seats';
export * from './protocol';
```

- [ ] **Step 3: Implement the client side.** In `apps/client/src/app/theme.ts`, replace `SEAT_COLORS` with:

```ts
/** Seat colours in seat order: pink, blue, lime, purple (spec #4 M10). Offline, you're always seat 0. */
export const SEAT_COLORS = ['#ff5470', '#3b82f6', '#a3e635', '#8b5cf6'] as const;
```

In `apps/client/src/app/MenuScreen.tsx` (line 82) and `apps/client/src/scene/MenuScene.tsx` (lines 185 and 188), replace `SEAT_COLORS.you` with `SEAT_COLORS[0]`.

Create `apps/client/src/service/seats.ts`:

```ts
import type { Seat } from '@laddorious/host';
import { SEAT_COLORS } from '../app/theme';
import type { SeatInfo } from './matchService';

/** A seat with its colour, which follows its place at the table on every screen (spec #4 M10). */
export function colorSeat(seat: Seat, index: number): SeatInfo {
  return { ...seat, color: SEAT_COLORS[index % SEAT_COLORS.length]! };
}

export function colorSeats(seats: readonly Seat[]): SeatInfo[] {
  return seats.map((seat, i) => colorSeat(seat, i));
}
```

In `apps/client/src/service/localMatchService.ts`:
- delete the `SEAT_COLORS` import, `BOT_NAMES`, `seatsFor` and `randomSeed`;
- add `import { buildSeats, randomHex } from '@laddorious/host';` and `import { colorSeats } from './seats';`;
- remove the now-unused `PIECES` and `SeatInfo` names from the `./matchService` import if nothing else uses them (`SeatInfo` is still used by `LocalMatchmaking`: keep that one);
- in `findMatch`, build the table with `colorSeats(buildSeats([profile]))`;
- in `seatBot`, use `randomHex()` for both seeds: `{ seed: this.boardSeed ?? randomHex(), rngSeed: randomHex() }`.

Update the comment above the seats: "Seat 0 is you; the bots take the pieces you didn't choose, in picker order (buildSeats)."

- [ ] **Step 4: Run the tests.**

Run: `pnpm vitest run packages/host/test/seats.test.ts apps/client/test/seats.test.ts apps/client/test/localMatchService.test.ts apps/client/test/tokens.test.ts`
Expected: PASS. `localMatchService.test.ts` still finds Mochi, Pip and Juno in blue, lime and purple, and the 32-hex seeds.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

- [ ] **Step 5: Commit.** `git add -A packages/host apps/client && git commit -m "feat(host): seats, the wire protocol and seat colours by seat order"` (with the trailer).

### Task 4: The server package and message checks

**Files:**
- Create:
  - `apps/server/package.json`;
  - `apps/server/tsconfig.json` (the Worker, with Workers types);
  - `apps/server/test/tsconfig.json` (the Node tests);
  - `apps/server/src/validate.ts`;
  - `apps/server/test/validate.test.ts`.
- Modify: `pnpm-workspace.yaml` (`allowBuilds`), `package.json` (typecheck), `.gitignore`

**Interfaces:**
- **Consumes:** `LobbyIn`, `MatchIn`, `PlayerAction`, `Profile`, `PIECES` (Tasks 1, 3).
- **Produces:**
  - `Parsed<T> = { kind: 'ok'; msg: T } | { kind: 'ignore' } | { kind: 'close'; reason: string }`;
  - `parseLobbyMessage(raw: unknown): Parsed<LobbyIn>`, `parseMatchMessage(raw: unknown): Parsed<MatchIn>`;
  - `cleanNickname(raw: unknown): string`;
  - `class RateLimit { hit(now: number): boolean }`;
  - `MAX_MESSAGE_BYTES = 8192`, `MAX_MESSAGES_PER_SECOND = 30`.

- [ ] **Step 1: Create the package.** `apps/server/package.json`:

```json
{
  "name": "@laddorious/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --port 8787",
    "e2e:serve": "wrangler dev --ip 127.0.0.1 --port 8788 --assets ../client/dist-online-e2e --var FAST:1 --show-interactive-dev-session=false"
  },
  "dependencies": {
    "@laddorious/core": "workspace:*",
    "@laddorious/host": "workspace:*"
  }
}
```

`apps/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src"]
}
```

`apps/server/test/tsconfig.json` (the tests run in Node and import only the plain classes):

```json
{
  "extends": "../../../tsconfig.base.json",
  "include": ["."]
}
```

In `pnpm-workspace.yaml`, add to `allowBuilds` (wrangler's runtime and its image library run install scripts):

```yaml
allowBuilds:
  esbuild: true
  sharp: true
  workerd: true
```

Then install the pinned tools:

```bash
pnpm --filter @laddorious/server add -D wrangler@4.148.0 @cloudflare/workers-types@5.20261007.1
```

Expected: `apps/server/package.json` lists `"wrangler": "4.148.0"` and `"@cloudflare/workers-types": "5.20261007.1"`; pin them exact if pnpm wrote ranges. If pnpm reports another ignored build script, add that package to `allowBuilds` with `true` and run `pnpm install` again.

In the root `package.json`, extend `typecheck` with `&& tsc -p apps/server && tsc -p apps/server/test` after `tsc -p apps/sim`. In `.gitignore`, add `.wrangler/` and `dist-online-e2e/`.

- [ ] **Step 2: Write the failing tests.** Create `apps/server/test/validate.test.ts`:

```ts
import { PROTOCOL_VERSION } from '@laddorious/host';
import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_BYTES, RateLimit, cleanNickname, parseLobbyMessage, parseMatchMessage } from '../src/validate';

const json = (v: unknown) => JSON.stringify(v);
const TOKEN = 'a'.repeat(32);

describe('parseLobbyMessage (spec #4 §6, §7)', () => {
  it('reads hello with a clean profile, and the other lobby messages', () => {
    expect(parseLobbyMessage(json({ type: 'hello', version: PROTOCOL_VERSION, profile: { nickname: '  Ari ', piece: 'meeple' } }))).toEqual({
      kind: 'ok',
      msg: { type: 'hello', version: 1, profile: { nickname: 'Ari', piece: 'meeple' } },
    });
    for (const type of ['find', 'cancel', 'playWithBots']) expect(parseLobbyMessage(json({ type }))).toEqual({ kind: 'ok', msg: { type } });
    expect(parseLobbyMessage(json({ type: 'ping', t: 1234.5 }))).toEqual({ kind: 'ok', msg: { type: 'ping', t: 1234.5 } });
  });

  it('turns a bad nickname into Guest, and closes on a piece that is not one of the four', () => {
    const hello = (profile: unknown) => parseLobbyMessage(json({ type: 'hello', version: 1, profile }));
    for (const nickname of ['   ', 'x'.repeat(17), 42]) {
      expect(hello({ nickname, piece: 'pawn' })).toMatchObject({ kind: 'ok', msg: { profile: { nickname: 'Guest', piece: 'pawn' } } });
    }
    expect(hello({ nickname: 'Ari', piece: 'queen' }).kind).toBe('close');
    expect(hello(null).kind).toBe('close');
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
```

Run: `pnpm vitest run apps/server/test/validate.test.ts`
Expected: FAIL, `../src/validate` doesn't exist.

- [ ] **Step 3: Implement.** Create `apps/server/src/validate.ts`:

```ts
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
      return ok<LobbyIn>({ type });
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
```

Run: `pnpm vitest run apps/server/test/validate.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 4: Run the gate.** `pnpm typecheck` (now including `apps/server` and `apps/server/test`), `pnpm lint` and `pnpm test`. Expected: all green.

- [ ] **Step 5: Commit.**

```bash
git add -A apps/server package.json pnpm-workspace.yaml pnpm-lock.yaml .gitignore
git commit -m "feat(server): the server package and message checks"
```

(With the trailer.)

### Task 5: The lobby (`LobbyCore`)

**Files:**
- Create: `apps/server/src/lobby.ts`, `apps/server/test/lobby.test.ts`

**Interfaces:**
- **Consumes:** `buildSeats`, `BOT_NAMES`, `TABLE_SIZE`, `PROTOCOL_VERSION`, `LobbyIn`, `LobbyOut`, `Seat`, `Profile` (Task 3).
- **Produces:**
  - `interface LobbyConn { send(msg: LobbyOut): void; close(): void }`;
  - `interface StartedMatch { matchId: string; tokens: Record<PlayerId, string> }`;
  - `class LobbyCore` with `new LobbyCore(startMatch: (seats: Seat[]) => Promise<StartedMatch>)`, `receive(conn, msg: LobbyIn)` and `drop(conn)`;
  - `LOBBY_TICK_MS = 1000`, `BOTS_OFFER_MS = 15_000`, `BOT_SEAT_MS = 420`, `VERSION_MESSAGE`.

- [ ] **Step 1: Write the failing tests.** Create `apps/server/test/lobby.test.ts`:

```ts
import { PROTOCOL_VERSION, type LobbyOut, type PieceId, type Seat } from '@laddorious/host';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_SEAT_MS, BOTS_OFFER_MS, LOBBY_TICK_MS, LobbyCore, type LobbyConn } from '../src/lobby';

/** A game's lobby socket: what it was sent, and whether it was closed. */
class FakeConn implements LobbyConn {
  sent: LobbyOut[] = [];
  closed = false;

  send(msg: LobbyOut): void {
    this.sent.push(structuredClone(msg));
  }

  close(): void {
    this.closed = true;
  }

  last(): LobbyOut {
    return this.sent.at(-1)!;
  }

  /** The last matchmaking update: its state, the nicknames in seat order (null = open), my seat and my time. */
  table() {
    const m = this.sent.findLast((x) => x.type === 'matchmaking');
    if (m?.type !== 'matchmaking') throw new Error('no matchmaking update yet');
    return { state: m.state, names: m.seats.map((s) => s?.nickname ?? null), you: m.you, elapsedMs: m.elapsedMs };
  }
}

/** A lobby whose matches start at once (or fail to), with each started table recorded. */
function setup(fail = false) {
  const started: Seat[][] = [];
  const lobby = new LobbyCore(async (seats) => {
    started.push(seats);
    if (fail) throw new Error('no match objects left');
    return { matchId: `match-${started.length}`, tokens: Object.fromEntries(seats.filter((s) => !s.bot).map((s) => [s.playerId, `token-${s.playerId}`])) };
  });
  const join = (nickname: string, piece: PieceId = 'knight') => {
    const conn = new FakeConn();
    lobby.receive(conn, { type: 'hello', version: PROTOCOL_VERSION, profile: { nickname, piece } });
    lobby.receive(conn, { type: 'find' });
    return conn;
  };
  return { lobby, started, join };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LobbyCore seating (spec #4 §4)', () => {
  it('seats the first player at a new table and tells them their waiting time every second', () => {
    const { join } = setup();
    const ari = join('Ari');
    expect(ari.table()).toEqual({ state: 'searching', names: ['Ari', null, null, null], you: 0, elapsedMs: 0 });
    vi.advanceTimersByTime(LOBBY_TICK_MS);
    expect(ari.table().elapsedMs).toBe(1000);
  });

  it('seats the next player at the same table; each hears their own seat and time', () => {
    const { join } = setup();
    const ari = join('Ari');
    vi.advanceTimersByTime(3000);
    const bo = join('Bo', 'pawn');
    expect(ari.table()).toEqual({ state: 'searching', names: ['Ari', 'Bo', null, null], you: 0, elapsedMs: 3000 });
    expect(bo.table()).toEqual({ state: 'searching', names: ['Ari', 'Bo', null, null], you: 1, elapsedMs: 0 });
    vi.advanceTimersByTime(LOBBY_TICK_MS);
    expect(ari.table().elapsedMs).toBe(4000);
    expect(bo.table().elapsedMs).toBe(1000);
  });

  it('starts at once with four players and no bots, sending each their own seat and token', async () => {
    const { join, started } = setup();
    const conns = ['Ari', 'Bo', 'Cy', 'Di'].map((n) => join(n));
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toHaveLength(1);
    expect(started[0]!.map((s) => [s.nickname, s.bot])).toEqual([['Ari', false], ['Bo', false], ['Cy', false], ['Di', false]]);
    conns.forEach((conn, i) => expect(conn.last()).toEqual({ type: 'found', matchId: 'match-1', me: `p${i}`, seats: started[0], token: `token-p${i}` }));
  });

  it('opens a new table for the fifth player', () => {
    const { join } = setup();
    for (const n of ['Ari', 'Bo', 'Cy', 'Di']) join(n);
    expect(join('Eve').table()).toMatchObject({ names: ['Eve', null, null, null], you: 0 });
  });
});

describe('LobbyCore bots (spec #4 §4 step 5)', () => {
  it('offers bots to each player only after their own 15 s', () => {
    const { lobby, join } = setup();
    const ari = join('Ari');
    vi.advanceTimersByTime(BOTS_OFFER_MS - 5000);
    const bo = join('Bo');
    vi.advanceTimersByTime(5000);
    lobby.receive(bo, { type: 'playWithBots' });
    expect(ari.table().state).toBe('searching');
    lobby.receive(ari, { type: 'playWithBots' });
    expect(ari.table()).toMatchObject({ state: 'filling', names: ['Ari', 'Bo', null, null] });
    expect(bo.table()).toMatchObject({ state: 'filling', you: 1 });
  });

  it('fills the empty seats with bots 420 ms apart, then starts the match', async () => {
    const { lobby, join, started } = setup();
    const ari = join('Ari', 'meeple');
    vi.advanceTimersByTime(BOTS_OFFER_MS);
    lobby.receive(ari, { type: 'playWithBots' });
    expect(ari.table().names).toEqual(['Ari', null, null, null]);
    await vi.advanceTimersByTimeAsync(BOT_SEAT_MS);
    expect(ari.table().names).toEqual(['Ari', 'Mochi', null, null]);
    await vi.advanceTimersByTimeAsync(2 * BOT_SEAT_MS);
    expect(started[0]!.map((s) => [s.nickname, s.piece, s.bot])).toEqual([
      ['Ari', 'meeple', false],
      ['Mochi', 'knight', true],
      ['Pip', 'pawn', true],
      ['Juno', 'dragon', true],
    ]);
    expect(ari.last()).toMatchObject({ type: 'found', me: 'p0', token: 'token-p0' });
    vi.advanceTimersByTime(10_000);
    expect(ari.last().type).toBe('found'); // no more ticks
  });

  it('ignores cancel once bots are taking seats, and still starts the match', async () => {
    const { lobby, join, started } = setup();
    const ari = join('Ari');
    vi.advanceTimersByTime(BOTS_OFFER_MS);
    lobby.receive(ari, { type: 'playWithBots' });
    lobby.receive(ari, { type: 'cancel' });
    await vi.advanceTimersByTimeAsync(3 * BOT_SEAT_MS);
    expect(started).toHaveLength(1);
    expect(ari.last().type).toBe('found');
  });

  it('keeps the seat of a player who drops while bots take seats: they will be away in the match', async () => {
    const { lobby, join, started } = setup();
    const ari = join('Ari');
    const bo = join('Bo');
    vi.advanceTimersByTime(BOTS_OFFER_MS);
    lobby.receive(ari, { type: 'playWithBots' });
    lobby.drop(bo);
    await vi.advanceTimersByTimeAsync(2 * BOT_SEAT_MS);
    expect(started[0]!.map((s) => [s.nickname, s.bot])).toEqual([['Ari', false], ['Bo', false], ['Mochi', true], ['Pip', true]]);
    expect(ari.last()).toMatchObject({ type: 'found', me: 'p0' });
  });
});

describe('LobbyCore leaving (spec #4 §4 step 7)', () => {
  it('frees a cancelled seat and shifts the later players up', () => {
    const { lobby, join } = setup();
    const ari = join('Ari');
    const bo = join('Bo');
    const cy = join('Cy');
    lobby.receive(bo, { type: 'cancel' });
    expect(ari.table().names).toEqual(['Ari', 'Cy', null, null]);
    expect(cy.table().you).toBe(1);
  });

  it('treats a dropped socket as cancel', () => {
    const { lobby, join } = setup();
    const ari = join('Ari');
    const bo = join('Bo');
    lobby.drop(bo);
    expect(ari.table().names).toEqual(['Ari', null, null, null]);
  });

  it('closes an empty table: its ticks stop, and the next player opens a new one', () => {
    const { lobby, join } = setup();
    const ari = join('Ari');
    lobby.receive(ari, { type: 'cancel' });
    const count = ari.sent.length;
    vi.advanceTimersByTime(5 * LOBBY_TICK_MS);
    expect(ari.sent).toHaveLength(count);
    expect(join('Bo').table()).toMatchObject({ names: ['Bo', null, null, null], you: 0 });
  });
});

describe('LobbyCore protocol (spec #4 §6)', () => {
  it('closes a socket whose first message is not hello', () => {
    const { lobby } = setup();
    const conn = new FakeConn();
    lobby.receive(conn, { type: 'find' });
    expect(conn.closed).toBe(true);
  });

  it('refuses another protocol version with a reload message', () => {
    const { lobby } = setup();
    const conn = new FakeConn();
    lobby.receive(conn, { type: 'hello', version: PROTOCOL_VERSION + 1, profile: { nickname: 'Ari', piece: 'pawn' } });
    expect(conn.sent).toEqual([{ type: 'failed', reason: 'version', message: 'Please reload, the game was updated.' }]);
    expect(conn.closed).toBe(true);
  });

  it('answers ping with the server time', () => {
    const { lobby, join } = setup();
    vi.setSystemTime(5000);
    const ari = join('Ari');
    lobby.receive(ari, { type: 'ping', t: 4990 });
    expect(ari.last()).toEqual({ type: 'pong', t: 4990, serverTime: 5000 });
  });

  it('tells everyone at the table when the match cannot start', async () => {
    const { join } = setup(true);
    const conns = ['Ari', 'Bo', 'Cy', 'Di'].map((n) => join(n));
    await vi.advanceTimersByTimeAsync(0);
    for (const conn of conns) expect(conn.last()).toEqual({ type: 'failed', reason: 'server-error', message: 'no match objects left' });
  });
});
```

Run: `pnpm vitest run apps/server/test/lobby.test.ts`
Expected: FAIL, `../src/lobby` doesn't exist.

- [ ] **Step 2: Implement.** Create `apps/server/src/lobby.ts`:

```ts
import type { PlayerId } from '@laddorious/core';
import { BOT_NAMES, buildSeats, PROTOCOL_VERSION, TABLE_SIZE, type LobbyIn, type LobbyOut, type Profile, type Seat } from '@laddorious/host';

/** How often a forming table hears the time (spec #4 §4 step 3). */
export const LOBBY_TICK_MS = 1000;
/** A player may start with bots once they have waited this long themselves (spec #2 C7). */
export const BOTS_OFFER_MS = 15_000;
/** The pause between bots taking seats (spec #2 §4.4). */
export const BOT_SEAT_MS = 420;
export const VERSION_MESSAGE = 'Please reload, the game was updated.';

/** One game's lobby socket, as the lobby sees it. */
export interface LobbyConn {
  send(msg: LobbyOut): void;
  close(): void;
}

/** A started match: its id, and one rejoin token per human seat. */
export interface StartedMatch {
  matchId: string;
  tokens: Record<PlayerId, string>;
}

interface Member {
  conn: LobbyConn;
  profile: Profile;
  table: Table | null;
  /** When this player sat down: their own waiting time counts from here. */
  joinedAt: number;
}

interface Table {
  /** Humans in join order: seat 0 sat down first. */
  members: Member[];
  /** Bots are taking seats or the match is starting: nobody joins or leaves any more. */
  locked: boolean;
  ticker: ReturnType<typeof setInterval> | null;
}

/**
 * Quick-match matchmaking for every game (spec #4 §4): one table forms at a time, each player
 * may call in bots after their own 15 s, bots fill the empty seats, and the match starts.
 * Plain TypeScript: the lobby's Durable Object feeds it sockets and checked messages.
 */
export class LobbyCore {
  private readonly members = new Map<LobbyConn, Member>();
  /** Tables still taking players, oldest first. */
  private readonly forming: Table[] = [];

  constructor(private readonly startMatch: (seats: Seat[]) => Promise<StartedMatch>) {}

  receive(conn: LobbyConn, msg: LobbyIn): void {
    const member = this.members.get(conn);
    if (!member) {
      this.hello(conn, msg);
      return;
    }
    switch (msg.type) {
      case 'find':
        this.find(member);
        return;
      case 'cancel':
        this.leaveTable(member);
        return;
      case 'playWithBots':
        this.playWithBots(member);
        return;
      case 'ping':
        conn.send({ type: 'pong', t: msg.t, serverTime: Date.now() });
        return;
      case 'hello':
        return; // only the first one counts
    }
  }

  /** The socket closed. A seat at a forming table is freed, as if cancelled (spec #4 §4 step 7). */
  drop(conn: LobbyConn): void {
    const member = this.members.get(conn);
    if (!member) return;
    this.leaveTable(member);
    this.members.delete(conn);
  }

  /** The first message must be hello with this build's protocol version. */
  private hello(conn: LobbyConn, msg: LobbyIn): void {
    if (msg.type !== 'hello') {
      conn.close();
      return;
    }
    if (msg.version !== PROTOCOL_VERSION) {
      conn.send({ type: 'failed', reason: 'version', message: VERSION_MESSAGE });
      conn.close();
      return;
    }
    this.members.set(conn, { conn, profile: msg.profile, table: null, joinedAt: 0 });
  }

  /** Sits the player at the oldest forming table, or opens one; four humans start at once. */
  private find(member: Member): void {
    if (member.table) return;
    const table = this.forming[0] ?? this.openTable();
    member.table = table;
    member.joinedAt = Date.now();
    table.members.push(member);
    if (table.members.length === TABLE_SIZE) this.start(table, this.seatsOf(table));
    else this.tell(table, 'searching');
  }

  private openTable(): Table {
    const table: Table = { members: [], locked: false, ticker: null };
    table.ticker = setInterval(() => this.tell(table, 'searching'), LOBBY_TICK_MS);
    this.forming.push(table);
    return table;
  }

  private leaveTable(member: Member): void {
    const table = member.table;
    if (!table || table.locked) return; // ignored once bots are taking seats
    table.members.splice(table.members.indexOf(member), 1);
    member.table = null;
    if (table.members.length === 0) this.lock(table);
    else this.tell(table, 'searching');
  }

  /** The first press from a player who has waited 15 s fills the table for everyone. */
  private playWithBots(member: Member): void {
    const table = member.table;
    if (!table || table.locked || Date.now() - member.joinedAt < BOTS_OFFER_MS) return;
    this.lock(table);
    const seats = this.seatsOf(table);
    const seat = (shown: number): void => {
      this.tell(table, 'filling', seats.slice(0, shown));
      if (shown < TABLE_SIZE) setTimeout(() => seat(shown + 1), BOT_SEAT_MS);
      else this.start(table, seats);
    };
    seat(table.members.length);
  }

  /** No more joining or leaving: the table stops ticking and is no longer forming. */
  private lock(table: Table): void {
    table.locked = true;
    if (table.ticker !== null) clearInterval(table.ticker);
    table.ticker = null;
    const i = this.forming.indexOf(table);
    if (i >= 0) this.forming.splice(i, 1);
  }

  /** Asks for a match with these seats and sends each human `found` with their seat and token. */
  private start(table: Table, seats: Seat[]): void {
    this.lock(table);
    const members = [...table.members];
    for (const m of members) m.table = null;
    this.startMatch(seats).then(
      ({ matchId, tokens }) => {
        members.forEach((m, i) => {
          const me = seats[i]!.playerId;
          m.conn.send({ type: 'found', matchId, me, seats, token: tokens[me]! });
        });
      },
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        for (const m of members) m.conn.send({ type: 'failed', reason: 'server-error', message });
      },
    );
  }

  /** The table's final seats: its humans, then bots (spec #4 §4 step 6). */
  private seatsOf(table: Table): Seat[] {
    return buildSeats(
      table.members.map((m) => m.profile),
      BOT_NAMES,
    );
  }

  /**
   * Each member hears the table in seat order (`shown` seats, the rest open), which seat is
   * theirs, and their own waiting time.
   */
  private tell(table: Table, state: 'searching' | 'filling', shown: Seat[] = this.seatsOf(table).slice(0, table.members.length)): void {
    const seats = [...shown, ...Array<null>(TABLE_SIZE - shown.length).fill(null)];
    const now = Date.now();
    table.members.forEach((m, you) => m.conn.send({ type: 'matchmaking', state, seats, you, elapsedMs: now - m.joinedAt }));
  }
}
```

Run: `pnpm vitest run apps/server/test/lobby.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 3: Run the gate.** `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

- [ ] **Step 4: Commit.** `git add apps/server && git commit -m "feat(server): quick-match lobby with the bot offer"` (with the trailer).

### Task 6: The match room (`MatchRoom`)

**Files:**
- Create: `apps/server/src/room.ts`, `apps/server/test/room.test.ts`

**Interfaces:**
- **Consumes:** `MatchHost` with `setAway`, `resync`, `onEnd` (Task 2); `randomHex`, `MatchIn`, `MatchOut`, `Seat`, `FromHost` (Tasks 1, 3).
- **Produces:**
  - `interface RoomConn { send(msg: MatchOut): void; close(): void }`;
  - `class MatchRoom`:
    - `new MatchRoom({ fast? })`;
    - `start(seats, seed, rngSeed): Record<PlayerId, string>` (the tokens);
    - `open(conn)`, `receive(conn, msg: MatchIn)`, `drop(conn)`;
  - `JOIN_DEADLINE_MS`, `SILENCE_MS`, `REJOIN_MS`, `END_LINGER_MS`, `EMPTY_MS`, `SEAT_LOST_MESSAGE`.

- [ ] **Step 1: Write the failing tests.** Create `apps/server/test/room.test.ts`:

```ts
import { HeuristicBot } from '@laddorious/bots';
import { DEFAULT_WINDOWS, InvariantError } from '@laddorious/core';
import { BOT_DELAY_MAX_MS, type MatchOut, type MatchUpdate, type Seat } from '@laddorious/host';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_MS, END_LINGER_MS, JOIN_DEADLINE_MS, MatchRoom, REJOIN_MS, SILENCE_MS, type RoomConn } from '../src/room';

/** Two humans and two bots. */
const SEATS: Seat[] = [
  { playerId: 'p0', nickname: 'Ari', piece: 'knight', bot: false },
  { playerId: 'p1', nickname: 'Bo', piece: 'pawn', bot: false },
  { playerId: 'p2', nickname: 'Mochi', piece: 'meeple', bot: true },
  { playerId: 'p3', nickname: 'Pip', piece: 'dragon', bot: true },
];

/** A game's match socket: what it was sent, and whether it was closed. */
class FakeConn implements RoomConn {
  sent: MatchOut[] = [];
  closed = false;

  send(msg: MatchOut): void {
    this.sent.push(structuredClone(msg));
  }

  close(): void {
    this.closed = true;
  }

  of<T extends MatchOut['type']>(type: T): Array<Extract<MatchOut, { type: T }>> {
    return this.sent.filter((m): m is Extract<MatchOut, { type: T }> => m.type === type);
  }

  updates(): MatchUpdate[] {
    return this.of('update').map((m) => m.update);
  }

  lastPresence(): string[] | undefined {
    return this.of('presence').at(-1)?.away;
  }
}

function setup(opts: { fast?: boolean } = {}) {
  const room = new MatchRoom(opts);
  const tokens = room.start(SEATS, 'board-seed', 'rng-secret');
  /** A socket that opens and, given a token, joins with it. */
  const connect = (token?: string) => {
    const conn = new FakeConn();
    room.open(conn);
    if (token !== undefined) room.receive(conn, { type: 'join', token });
    return conn;
  };
  return { room, tokens, connect };
}

/** Lets time pass in 5 s steps, with these sockets pinging as the game does (spec #4 §5.3). */
function pass(room: MatchRoom, ms: number, ...alive: FakeConn[]) {
  for (let t = 0; t < ms; t += 5000) {
    for (const conn of alive) room.receive(conn, { type: 'ping', t: Date.now() });
    vi.advanceTimersByTime(Math.min(5000, ms - t));
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MatchRoom joining (spec #4 §5.1)', () => {
  it('gives each human seat its own 128-bit token', () => {
    const { tokens } = setup();
    expect(Object.keys(tokens)).toEqual(['p0', 'p1']);
    for (const token of Object.values(tokens)) expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(tokens.p0).not.toBe(tokens.p1);
  });

  it('welcomes a player with their seat, then their own current view and who is away', () => {
    const { tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    expect(ari.sent[0]).toEqual({ type: 'welcome', me: 'p0', seats: SEATS, serverTime: 0 });
    expect(ari.updates()).toHaveLength(1);
    expect(ari.updates()[0]).toMatchObject({ events: [], timer: null });
    expect(ari.updates()[0]!.view.me).toBe('p0');
    expect(ari.lastPresence()).toEqual([]);
  });

  it('closes a socket whose first message is not join, and refuses an unknown token', () => {
    const { room, connect } = setup();
    const early = connect();
    room.receive(early, { type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(early.closed).toBe(true);
    const stranger = connect('f'.repeat(32));
    expect(stranger.sent).toEqual([{ type: 'failed', reason: 'bad-token', message: 'That seat is not at this match' }]);
    expect(stranger.closed).toBe(true);
  });

  it("stamps a player's actions with their own seat", () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.receive(ari, { type: 'action', action: { type: 'roll' }, windowId: 1 });
    expect(bo.updates().flatMap((u) => u.events)).toContainEqual(expect.objectContaining({ type: 'DieRolled', player: 'p0', auto: false }));
  });

  it('starts the countdown once both players have watched the opening', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.receive(ari, { type: 'playbackDone', windowId: 1 });
    expect(bo.updates().at(-1)!.timer).toBeNull();
    room.receive(bo, { type: 'playbackDone', windowId: 1 });
    expect(bo.updates().at(-1)!.timer).toEqual({ windowId: 1, endsAt: DEFAULT_WINDOWS.diceMs });
  });

  it('answers ping with pong and the server time', () => {
    const { room, tokens, connect } = setup();
    vi.setSystemTime(7000);
    const ari = connect(tokens.p0!);
    room.receive(ari, { type: 'ping', t: 6990 });
    expect(ari.sent.at(-1)).toEqual({ type: 'pong', t: 6990, serverTime: 7000 });
  });
});

describe('MatchRoom away and rejoin (spec #4 §5.2)', () => {
  it('marks a dropped seat away for everyone, and lets it rejoin within 60 s', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.drop(bo);
    expect(ari.lastPresence()).toEqual(['p1']);
    pass(room, REJOIN_MS - 1000, ari);
    const back = connect(tokens.p1!);
    expect(back.sent[0]).toMatchObject({ type: 'welcome', me: 'p1' });
    expect(back.updates()).toHaveLength(1);
    expect(ari.lastPresence()).toEqual([]);
  });

  it('cancels the token after 60 s away: a late join hears the match carried on without it', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.drop(bo);
    pass(room, REJOIN_MS, ari);
    const late = connect(tokens.p1!);
    expect(late.sent).toEqual([{ type: 'failed', reason: 'seat-lost', message: 'The match carried on without you' }]);
    expect(late.closed).toBe(true);
  });

  it('counts 10 s of silence as gone', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    pass(room, SILENCE_MS, ari);
    expect(bo.closed).toBe(true);
    expect(ari.closed).toBe(false);
    expect(ari.lastPresence()).toEqual(['p1']);
  });

  it('counts a player who never joins within 15 s as away', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    pass(room, JOIN_DEADLINE_MS, ari);
    expect(ari.lastPresence()).toEqual(['p1']);
  });

  it('makes a seat away for good on leave', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.receive(bo, { type: 'leave' });
    expect(bo.closed).toBe(true);
    expect(ari.lastPresence()).toEqual(['p1']);
    expect(connect(tokens.p1!).sent).toEqual([{ type: 'failed', reason: 'seat-lost', message: 'The match carried on without you' }]);
  });

  it('lets a newer socket with the same token take the seat over without going away', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    const reloaded = connect(tokens.p1!);
    expect(bo.closed).toBe(true);
    room.drop(bo); // the old socket's close arrives late
    expect(reloaded.sent[0]).toMatchObject({ type: 'welcome', me: 'p1' });
    expect(ari.of('presence').every((p) => p.away.length === 0)).toBe(true);
  });

  it('pauses while nobody is connected and picks up where it was', () => {
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.drop(ari);
    room.drop(bo);
    vi.advanceTimersByTime(EMPTY_MS - 10_000);
    const back = connect(tokens.p0!);
    expect(back.updates().at(-1)!.view.awaiting.windowId).toBe(1);
    expect(back.updates().at(-1)!.timer).toEqual({ windowId: 1, endsAt: EMPTY_MS - 10_000 + DEFAULT_WINDOWS.diceMs });
  });

  it('ends the match after 60 s with nobody connected; a later socket hears it is no longer running', () => {
    const { room, tokens, connect } = setup();
    room.drop(connect(tokens.p0!));
    room.drop(connect(tokens.p1!));
    vi.advanceTimersByTime(EMPTY_MS);
    const late = connect(tokens.p0!);
    expect(late.sent).toEqual([{ type: 'failed', reason: 'server-error', message: 'This match is no longer running' }]);
    expect(late.closed).toBe(true);
  });
});

describe('MatchRoom end (spec #4 §5.2)', () => {
  it('closes every socket 10 s after the win, and tells nobody who left after it', () => {
    const { room, tokens, connect } = setup({ fast: true });
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    const won = () => ari.updates().some((u) => u.view.phase.kind === 'finished');
    for (let t = 0; t < 600_000 && !won(); t += 1000) pass(room, 1000, ari, bo);
    expect(won()).toBe(true);
    const presences = ari.of('presence').length;
    room.drop(bo);
    expect(ari.of('presence')).toHaveLength(presences);
    vi.advanceTimersByTime(END_LINGER_MS);
    expect(ari.closed).toBe(true);
    expect(connect().sent[0]).toMatchObject({ type: 'failed', reason: 'server-error' });
  });

  it('tells every player and closes when the host fails', () => {
    vi.spyOn(HeuristicBot.prototype, 'decide').mockImplementation(() => {
      throw new InvariantError('board corrupted');
    });
    const { room, tokens, connect } = setup();
    const ari = connect(tokens.p0!);
    const bo = connect(tokens.p1!);
    room.receive(ari, { type: 'playbackDone', windowId: 1 });
    room.receive(bo, { type: 'playbackDone', windowId: 1 });
    vi.advanceTimersByTime(BOT_DELAY_MAX_MS);
    for (const conn of [ari, bo]) {
      expect(conn.sent.at(-1)).toEqual({ type: 'failed', reason: 'server-error', message: 'board corrupted' });
      expect(conn.closed).toBe(true);
    }
  });
});
```

Run: `pnpm vitest run apps/server/test/room.test.ts`
Expected: FAIL, `../src/room` doesn't exist.

- [ ] **Step 2: Implement.** Create `apps/server/src/room.ts`:

```ts
import type { PlayerId } from '@laddorious/core';
import { MatchHost, randomHex, type FromHost, type MatchIn, type MatchOut, type Seat } from '@laddorious/host';

/** A human who hasn't joined this long after the start counts as away (spec #4 §5.1). */
export const JOIN_DEADLINE_MS = 15_000;
/** A socket silent this long (not even a ping) counts as gone (spec #4 §5.2). */
export const SILENCE_MS = 10_000;
/** An away seat can come back for this long. */
export const REJOIN_MS = 60_000;
/** After the win, sockets stay open this long so the end screens can settle. */
export const END_LINGER_MS = 10_000;
/** With nobody connected, the match ends after this long. */
export const EMPTY_MS = 60_000;
/** How often the room looks for silent sockets. */
const SWEEP_MS = 1000;
export const SEAT_LOST_MESSAGE = 'The match carried on without you';

/** One game's match socket, as the room sees it. */
export interface RoomConn {
  send(msg: MatchOut): void;
  close(): void;
}

interface Human {
  seat: Seat;
  /** The socket holding this seat, or null while away. */
  conn: RoomConn | null;
  joined: boolean;
  rejoin: Timer | null;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * One online match (spec #4 §5): a MatchHost, the seats' sockets and rejoin tokens, presence,
 * the rejoin windows, and the end. Plain TypeScript: the match's Durable Object feeds it sockets
 * and checked messages. Actions name no player; each socket acts for the seat it joined (spec #4 §7).
 */
export class MatchRoom {
  private readonly host: MatchHost;
  private seats: Seat[] = [];
  private readonly humans = new Map<PlayerId, Human>();
  /** Live rejoin tokens, and the ones cancelled after 60 s away or a leave. */
  private readonly tokens = new Map<string, PlayerId>();
  private readonly lost = new Set<string>();
  private readonly away = new Set<PlayerId>();
  private readonly conns = new Map<RoomConn, { player: PlayerId | null; heardAt: number }>();
  private readonly timers = new Set<Timer>();
  private sweeper: ReturnType<typeof setInterval> | null = null;
  private empty: Timer | null = null;
  private won = false;
  private closed = false;

  constructor(opts: { fast?: boolean } = {}) {
    this.host = new MatchHost({ send: (to, msg) => this.fromHost(to, msg), fast: opts.fast, onEnd: (outcome) => this.ended(outcome) });
  }

  /** Starts the match and returns one rejoin token per human seat. */
  start(seats: Seat[], seed: string, rngSeed: string): Record<PlayerId, string> {
    this.seats = seats;
    const tokens: Record<PlayerId, string> = {};
    for (const seat of seats) {
      if (seat.bot) continue;
      const token = randomHex();
      tokens[seat.playerId] = token;
      this.tokens.set(token, seat.playerId);
      this.humans.set(seat.playerId, { seat, conn: null, joined: false, rejoin: null });
    }
    this.sweeper = setInterval(() => this.sweep(), SWEEP_MS);
    this.later(JOIN_DEADLINE_MS, () => {
      for (const [id, human] of this.humans) if (!human.joined) this.goAway(id);
    });
    this.host.create(seats, seed, rngSeed);
    this.checkEmpty(); // nobody has joined yet: the match waits for the first player
    return tokens;
  }

  /** A new socket. Its first message must be join (spec #4 §5.1). */
  open(conn: RoomConn): void {
    if (this.closed) {
      conn.send({ type: 'failed', reason: 'server-error', message: 'This match is no longer running' });
      conn.close();
      return;
    }
    this.conns.set(conn, { player: null, heardAt: Date.now() });
  }

  receive(conn: RoomConn, msg: MatchIn): void {
    const entry = this.conns.get(conn);
    if (!entry) return;
    entry.heardAt = Date.now();
    if (entry.player === null) {
      if (msg.type === 'join') this.join(conn, msg.token);
      else this.kick(conn);
      return;
    }
    switch (msg.type) {
      case 'action':
        this.host.action(entry.player, msg.action, msg.windowId);
        return;
      case 'playbackDone':
        this.host.playbackDone(entry.player, msg.windowId);
        return;
      case 'leave':
        this.goAway(entry.player, true);
        return;
      case 'ping':
        conn.send({ type: 'pong', t: msg.t, serverTime: Date.now() });
        return;
      case 'join':
        return; // already joined
    }
  }

  /** The socket closed. If it still held a seat, that seat is away (spec #4 §5.2). */
  drop(conn: RoomConn): void {
    const entry = this.conns.get(conn);
    if (!entry) return;
    this.conns.delete(conn);
    const human = entry.player === null ? undefined : this.humans.get(entry.player);
    if (human?.conn === conn) {
      human.conn = null;
      this.goAway(human.seat.playerId);
    }
  }

  private join(conn: RoomConn, token: string): void {
    const id = this.tokens.get(token);
    const human = id === undefined ? undefined : this.humans.get(id);
    if (id === undefined || !human) {
      const lost = this.lost.has(token);
      conn.send({ type: 'failed', reason: lost ? 'seat-lost' : 'bad-token', message: lost ? SEAT_LOST_MESSAGE : 'That seat is not at this match' });
      this.kick(conn);
      return;
    }
    if (human.conn) this.kick(human.conn); // a reload's new socket takes the seat over
    human.conn = conn;
    human.joined = true;
    this.conns.get(conn)!.player = id;
    this.cancel(human.rejoin);
    human.rejoin = null;
    conn.send({ type: 'welcome', me: id, seats: this.seats, serverTime: Date.now() });
    if (this.away.delete(id)) this.host.setAway(id, false);
    this.checkEmpty();
    this.host.resync(id);
    this.presence();
  }

  /** The seat is away: no bot plays it, and its windows run on timeouts (spec #4 M2, M3). */
  private goAway(id: PlayerId, forGood = false): void {
    const human = this.humans.get(id);
    if (!human) return;
    if (human.conn) {
      this.kick(human.conn);
      human.conn = null;
    }
    if (!this.away.has(id)) {
      this.away.add(id);
      this.host.setAway(id, true);
      this.presence();
    }
    if (forGood) this.loseSeat(id);
    else if (human.rejoin === null && [...this.tokens.values()].includes(id)) human.rejoin = this.later(REJOIN_MS, () => this.loseSeat(id));
    this.checkEmpty();
  }

  /** The seat's token stops working; a later join hears "seat-lost". */
  private loseSeat(id: PlayerId): void {
    const human = this.humans.get(id)!;
    this.cancel(human.rejoin);
    human.rejoin = null;
    for (const [token, owner] of this.tokens) {
      if (owner !== id) continue;
      this.tokens.delete(token);
      this.lost.add(token);
    }
  }

  /** With no human connected the match pauses, and ends if nobody comes back within 60 s (spec #4 §5.2). */
  private checkEmpty(): void {
    if (this.closed) return;
    const anyone = [...this.humans.values()].some((h) => h.conn !== null);
    if (!anyone && this.empty === null) {
      this.host.pause();
      this.empty = this.later(EMPTY_MS, () => this.close());
    } else if (anyone && this.empty !== null) {
      this.cancel(this.empty);
      this.empty = null;
      this.host.resume();
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [conn, entry] of this.conns) {
      if (now - entry.heardAt < SILENCE_MS) continue;
      conn.close();
      this.drop(conn);
    }
  }

  /** Everyone connected hears who is away. Not after the win: end screens don't need it. */
  private presence(): void {
    if (this.won) return;
    const away = [...this.away];
    for (const human of this.humans.values()) human.conn?.send({ type: 'presence', away });
  }

  private fromHost(to: PlayerId, msg: FromHost): void {
    const conn = this.humans.get(to)?.conn;
    if (!conn) return;
    conn.send(msg.type === 'failed' ? { type: 'failed', reason: 'server-error', message: msg.message } : msg);
  }

  private ended(outcome: 'won' | 'failed'): void {
    if (outcome === 'failed') {
      this.close(); // the host has told everyone
      return;
    }
    this.won = true;
    this.later(END_LINGER_MS, () => this.close());
  }

  /** The room is over: timers stop and every socket closes. Later sockets hear it is no longer running. */
  private close(): void {
    if (this.closed) return;
    this.closed = true;
    this.host.stop();
    if (this.sweeper !== null) clearInterval(this.sweeper);
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    for (const human of this.humans.values()) human.conn = null;
    for (const conn of [...this.conns.keys()]) conn.close();
    this.conns.clear();
  }

  private kick(conn: RoomConn): void {
    this.conns.delete(conn);
    conn.close();
  }

  private later(ms: number, fn: () => void): Timer {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
    return timer;
  }

  private cancel(timer: Timer | null): void {
    if (timer === null) return;
    clearTimeout(timer);
    this.timers.delete(timer);
  }
}
```

Run: `pnpm vitest run apps/server/test/room.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 3: Run the gate.** `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

- [ ] **Step 4: Commit.** `git add apps/server && git commit -m "feat(server): the match room with presence, rejoin and the end"` (with the trailer).

### Task 7: The Worker and its Durable Objects

The thin wrappers: sockets in, the plain classes behind. Their logic is in Tasks 4–6. This task's check is a real run under `wrangler dev`, with a smoke script, and Task 13's e2e covers them for good.

**Files:**
- Create:
  - `apps/server/wrangler.toml`;
  - `apps/server/src/env.ts`, `src/socket.ts`, `src/LobbyDO.ts`, `src/MatchDO.ts`, `src/index.ts`.

**Interfaces:**
- **Consumes:** `LobbyCore`, `StartedMatch` (Task 5); `MatchRoom` (Task 6); `parseLobbyMessage`, `parseMatchMessage`, `RateLimit`, `Parsed` (Task 4); `randomHex` (Task 3).
- **Produces:**
  - `GET /lobby` (WebSocket) → the one `LobbyDO` (`idFromName('global')`);
  - `GET /match/:id` (WebSocket, `:id` = 64 hex) → that `MatchDO`;
  - `MatchDO.start(seats): Record<PlayerId, string>` over RPC;
  - every other path → the built game (static assets), or 404.

- [ ] **Step 1: Write the Worker config.** Create `apps/server/wrangler.toml`:

```toml
# The game and its multiplayer server as one Cloudflare Worker (spec #4 §3.2, M4, M5).
name = "laddorious"
main = "src/index.ts"
compatibility_date = "2026-10-01"

# The built game (pnpm serve builds it with VITE_SERVER=same-origin). Requests for files are
# served from here; everything else (/lobby, /match/:id) reaches the Worker.
[assets]
directory = "../client/dist"

[[durable_objects.bindings]]
name = "LOBBY"
class_name = "LobbyDO"

[[durable_objects.bindings]]
name = "MATCH"
class_name = "MatchDO"

# SQLite-backed classes are required on the free plan. Neither object stores anything (M9).
[[migrations]]
tag = "v1"
new_sqlite_classes = ["LobbyDO", "MatchDO"]

[vars]
# "1" for e2e runs: bots play every seat, with short windows (spec #2 §9.3).
FAST = "0"
```

- [ ] **Step 2: Write the wrappers.** Create `apps/server/src/env.ts`:

```ts
import type { LobbyDO } from './LobbyDO';
import type { MatchDO } from './MatchDO';

/** The Worker's bindings (wrangler.toml). */
export interface Env {
  LOBBY: DurableObjectNamespace<LobbyDO>;
  MATCH: DurableObjectNamespace<MatchDO>;
  /** "1" in e2e runs: bots play every seat, with short windows. */
  FAST?: string;
}
```

Create `apps/server/src/socket.ts`:

```ts
import { RateLimit, type Parsed } from './validate';

/** A socket as the plain classes see it: JSON out, and close. Both do nothing once it's closed. */
export interface Conn<Out> {
  send(msg: Out): void;
  close(): void;
}

export interface SocketHandlers<In, Out> {
  parse(raw: unknown): Parsed<In>;
  open?(conn: Conn<Out>): void;
  receive(conn: Conn<Out>, msg: In): void;
  drop(conn: Conn<Out>): void;
}

/**
 * Accepts a WebSocket upgrade (standard API, spec #4 M8) and wires its frames through the
 * checks (spec #4 §7): over 30 a second or malformed closes the socket, unknown types are
 * ignored, and the rest reach the handlers. `drop` runs once, however the socket ends.
 */
export function acceptSocket<In, Out>(request: Request, handlers: SocketHandlers<In, Out>): Response {
  if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  const conn: Conn<Out> = {
    send: (msg) => {
      try {
        server.send(JSON.stringify(msg));
      } catch {
        // already closed
      }
    },
    close: () => {
      try {
        server.close(1000, 'bye');
      } catch {
        // already closed
      }
    },
  };
  const limit = new RateLimit();
  let dropped = false;
  const drop = () => {
    if (dropped) return;
    dropped = true;
    handlers.drop(conn);
  };
  handlers.open?.(conn);
  server.addEventListener('message', (event) => {
    if (dropped) return;
    const parsed: Parsed<In> = limit.hit(Date.now()) ? handlers.parse(event.data) : { kind: 'close', reason: 'too many messages' };
    if (parsed.kind === 'ok') {
      handlers.receive(conn, parsed.msg);
    } else if (parsed.kind === 'close') {
      conn.close();
      drop();
    }
  });
  server.addEventListener('close', () => {
    conn.close(); // answer the game's close
    drop();
  });
  server.addEventListener('error', drop);
  return new Response(null, { status: 101, webSocket: client });
}
```

Create `apps/server/src/LobbyDO.ts`:

```ts
import { DurableObject } from 'cloudflare:workers';
import type { LobbyIn, LobbyOut, Seat } from '@laddorious/host';
import type { Env } from './env';
import { LobbyCore, type StartedMatch } from './lobby';
import { acceptSocket } from './socket';
import { parseLobbyMessage } from './validate';

/** The one lobby (spec #4 §3.2): matchmaking for every game, around LobbyCore. */
export class LobbyDO extends DurableObject<Env> {
  private readonly lobby = new LobbyCore((seats) => this.startMatch(seats));

  override fetch(request: Request): Response {
    return acceptSocket<LobbyIn, LobbyOut>(request, {
      parse: parseLobbyMessage,
      receive: (conn, msg) => this.lobby.receive(conn, msg),
      drop: (conn) => this.lobby.drop(conn),
    });
  }

  /** Starts the seats' match in a fresh Match object. */
  private async startMatch(seats: Seat[]): Promise<StartedMatch> {
    const id = this.env.MATCH.newUniqueId();
    const tokens = await this.env.MATCH.get(id).start(seats);
    return { matchId: id.toString(), tokens };
  }
}
```

Create `apps/server/src/MatchDO.ts`:

```ts
import { DurableObject } from 'cloudflare:workers';
import type { PlayerId } from '@laddorious/core';
import { randomHex, type MatchIn, type MatchOut, type Seat } from '@laddorious/host';
import type { Env } from './env';
import { MatchRoom } from './room';
import { acceptSocket } from './socket';
import { parseMatchMessage } from './validate';

/**
 * One match (spec #4 §3.2), around MatchRoom. It lives in memory only (M9): if the object
 * restarts, the match is gone and its players see the error screen.
 */
export class MatchDO extends DurableObject<Env> {
  private room: MatchRoom | null = null;

  /** Called by the lobby over RPC: starts the match with secret random seeds; returns the rejoin tokens. */
  start(seats: Seat[]): Record<PlayerId, string> {
    this.room = new MatchRoom({ fast: this.env.FAST === '1' });
    return this.room.start(seats, randomHex(), randomHex());
  }

  override fetch(request: Request): Response {
    return acceptSocket<MatchIn, MatchOut>(request, {
      parse: parseMatchMessage,
      open: (conn) => {
        if (this.room) {
          this.room.open(conn);
          return;
        }
        conn.send({ type: 'failed', reason: 'server-error', message: 'This match is no longer running' });
        conn.close();
      },
      receive: (conn, msg) => this.room?.receive(conn, msg),
      drop: (conn) => this.room?.drop(conn),
    });
  }
}
```

Create `apps/server/src/index.ts`:

```ts
import type { Env } from './env';

export { LobbyDO } from './LobbyDO';
export { MatchDO } from './MatchDO';

/** Durable Object ids are 64 hex characters. */
const MATCH_PATH = /^\/match\/([0-9a-f]{64})$/;

/**
 * The Worker (spec #4 §3.2). Files of the built game are served before this runs; the rest
 * routes here: /lobby to the one lobby, /match/:id to that match.
 */
export default {
  fetch(request, env): Response | Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/lobby') return env.LOBBY.get(env.LOBBY.idFromName('global')).fetch(request);
    const match = MATCH_PATH.exec(pathname);
    if (match) {
      try {
        return env.MATCH.get(env.MATCH.idFromString(match[1]!)).fetch(request);
      } catch {
        return new Response('No such match', { status: 404 }); // an id from another namespace
      }
    }
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 3: Typecheck and bundle.**

Run: `pnpm typecheck`
Expected: green. If TypeScript can't see `cloudflare:workers`, check `apps/server/tsconfig.json` has `"types": ["@cloudflare/workers-types"]`. If it complains about RPC types on `this.env.MATCH.get(id).start(seats)`, keep the call and type the result: `const tokens: Record<PlayerId, string> = await ...`. Ledger it as a ruling.

Run: `pnpm build && pnpm --filter @laddorious/server exec wrangler deploy --dry-run --outdir .wrangler/dry-run`
Expected: wrangler bundles the Worker, lists the `LOBBY` and `MATCH` bindings and the `FAST` var, and ends with `--dry-run: exiting now.` Nothing is uploaded: dry runs need no account. This is the only `wrangler deploy` invocation allowed, and only with `--dry-run`.

- [ ] **Step 4: Smoke it under `wrangler dev`.** Add a `server` entry to `.claude/launch.json` (runtimeExecutable `pnpm`, runtimeArgs `["--filter", "@laddorious/server", "dev"]`, port 8787), and start it with the preview tool. Then write this throwaway script in the scratchpad (don't commit it) as `smoke.mjs`:

```js
// Smoke check for Task 7: the lobby seats us, bots fill, and the match welcomes us with a view.
const base = process.argv[2] ?? 'ws://127.0.0.1:8787';
const open = (path) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(base + path);
    ws.onopen = () => resolve(ws);
    ws.onerror = reject;
  });
const next = (ws, type) =>
  new Promise((resolve) => {
    const on = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type !== type) return;
      ws.removeEventListener('message', on);
      resolve(msg);
    };
    ws.addEventListener('message', on);
  });

const lobby = await open('/lobby');
lobby.send(JSON.stringify({ type: 'hello', version: 1, profile: { nickname: 'Smoke', piece: 'pawn' } }));
lobby.send(JSON.stringify({ type: 'find' }));
console.log('seated:', JSON.stringify(await next(lobby, 'matchmaking')));
await new Promise((r) => setTimeout(r, 15_500));
lobby.send(JSON.stringify({ type: 'playWithBots' }));
const found = await next(lobby, 'found');
console.log('found:', found.matchId.length, found.me, found.seats.map((s) => s.nickname).join(', '));
lobby.close();
const match = await open(`/match/${found.matchId}`);
match.send(JSON.stringify({ type: 'join', token: found.token }));
console.log('welcome:', JSON.stringify(await next(match, 'welcome')));
const { update } = await next(match, 'update');
console.log('update: round', update.view.round, update.view.awaiting.window, 'me', update.view.me);
match.close();
process.exit(0);
```

Run: `node <scratchpad>/smoke.mjs`
Expected, in about 17 s:
- `seated:` with `"state":"searching"`, `"you":0` and `Smoke` in seat 0;
- `found: 64 p0 Smoke, Mochi, Pip, Juno`;
- `welcome:` with `"me":"p0"`;
- `update: round 1 dice me p0`.

Also check `http://localhost:8787/` in the browser pane: the menu loads (the offline build is fine here). Stop the server afterwards.

- [ ] **Step 5: Commit.** `git add apps/server && git commit -m "feat(server): the Worker, the lobby and match Durable Objects"` (with the trailer).

### Task 8: Presence on the match screen

The screens learn about away players before any online code exists: the session interface gains `onPresence`, rows get an Away badge, toasts announce drops, my own drop shows a pill, and a lost seat goes back to the menu.

**Files:**
- Create: `apps/client/src/hud/presence.ts`, `apps/client/test/presence.test.ts`
- Modify:
  - `apps/client/src/service/matchService.ts` (`MatchFailure`, `onPresence`);
  - `apps/client/src/service/workerSession.ts` (`onPresence` that never reports);
  - `apps/client/src/hud/model.ts` (`PlayerRow.away`), `apps/client/src/hud/PlayerColumn.tsx` (the badge), `apps/client/src/hud/hud.css`;
  - `apps/client/src/app/MatchScreen.tsx` (presence, toasts, the pill, the online leave text, `onFailed` gets the failure), `apps/client/src/app/match.css`;
  - `apps/client/src/app/App.tsx` (a lost seat → toast and menu; a `ToastHost` outside matches);
  - `apps/client/test/support/scripted.ts`, `test/MatchScreen.test.tsx`, `test/hud.test.tsx`, `test/App.test.tsx`, `test/workerSession.test.ts`.

**Interfaces:**
- **Consumes:** `FailReason` (Task 3).
- **Produces:**
  - `interface MatchFailure { message: string; reason?: FailReason }`;
  - `MatchSession.onFailed(cb: (e: MatchFailure) => void)`;
  - `MatchSession.onPresence(cb: (away: PlayerId[]) => void): () => void`;
  - `PlayerRow.away: boolean`, `RowsInput.away?: readonly PlayerId[]`;
  - `presenceToast(before, after, seats, me): string | null`;
  - `MatchScreenProps.onFailed: (failure: MatchFailure) => void`.

- [ ] **Step 1: Write the failing tests.**

Create `apps/client/test/presence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { presenceToast } from '../src/hud/presence';
import { SEATS } from './support/fixtures';

// SEATS: You (p0), Mochi (p1), Pip (p2), Juno (p3).

describe('presenceToast (spec #4 §3.3)', () => {
  it('names a player who lost connection, and one who is back', () => {
    expect(presenceToast([], ['p1'], SEATS, 'p0')).toBe('Mochi lost connection');
    expect(presenceToast(['p1'], [], SEATS, 'p0')).toBe('Mochi is back');
  });

  it('names several at once', () => {
    expect(presenceToast([], ['p1', 'p2'], SEATS, 'p0')).toBe('Mochi and Pip lost connection');
    expect(presenceToast(['p1', 'p2'], [], SEATS, 'p0')).toBe('Mochi and Pip are back');
  });

  it('says I am back in the match, and leaves my own drop to the reconnecting pill', () => {
    expect(presenceToast([], ['p0'], SEATS, 'p0')).toBeNull();
    expect(presenceToast(['p0', 'p1'], ['p1'], SEATS, 'p0')).toBe('Back in the match');
  });

  it('says nothing when nothing changed', () => {
    expect(presenceToast(['p1'], ['p1'], SEATS, 'p0')).toBeNull();
  });
});
```

In `apps/client/test/hud.test.tsx`, add inside `describe('PlayerColumn (spec #2 §7.2, §9.2)', ...)`:

```tsx
  it('marks an away player with an Away badge (spec #4 §3.3)', () => {
    const v = view({ p0: 4, p1: 9 });
    const rows = playerRows({ view: v, presentation: presentationFromView(v), record: { round: 1, dice: {}, cards: {} }, seats: SEATS, me: 'p0', watch: null, away: ['p1'] });
    expect(rows.map((r) => [r.seat.playerId, r.away])).toEqual([['p1', true], ['p0', false], ['p2', false], ['p3', false]]);
    render(<PlayerColumn rows={rows} onWatch={() => {}} reducedMotion={false} />);
    const mochi = rowOf(/^Mochi, tile 9, rank 1, away\./);
    expect(within(mochi).getByText('Away')).toBeTruthy();
    expect(within(rowOf(/^You \(you\)/)).queryByText('Away')).toBeNull();
  });
```

In `apps/client/test/support/scripted.ts`:
- import `type FailReason` from `'@laddorious/host'` and `type MatchFailure` from `'../../src/service/matchService'`;
- type the `failed` field and `onFailed` with `MatchFailure`;
- add a presence channel:

```ts
  private presenceCb: ((away: string[]) => void) | null = null;

  onPresence(cb: (away: string[]) => void): () => void {
    this.presenceCb = cb;
    return () => {
      if (this.presenceCb === cb) this.presenceCb = null;
    };
  }

  presence(away: string[]): void {
    act(() => this.presenceCb?.(away));
  }
```

and change `fail` to:

```ts
  fail(message: string, reason?: FailReason): void {
    act(() => this.failed?.(reason ? { message, reason } : { message }));
  }
```

In `apps/client/test/MatchScreen.test.tsx`:
- change `start`'s `onFailed` prop type to `(f: { message: string }) => void`;
- add a `seats?: SeatInfo[]` prop, applied with `if (props.seats) session.seats = props.seats;` right after `new ScriptedSession()` (import `type SeatInfo` from `'../src/service/matchService'`, and `SEATS` from `'./support/fixtures'`);
- in "reports a failed match", expect `onFailed` to have been called with `{ message: 'board corrupted' }`.

Then add:

```tsx
describe('MatchScreen presence (spec #4 §3.3)', () => {
  it('toasts a player who lost connection and badges their row, then toasts their return', () => {
    const session = start();
    session.update(opening());
    session.presence(['p1']);
    expect(screen.getByText('Mochi lost connection')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Mochi, .*, away\./ })).toBeTruthy();
    session.presence([]);
    expect(screen.getByText('Mochi is back')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /away\./ })).toBeNull();
  });

  it('shows a reconnecting pill while my own connection is down, then says I am back', () => {
    const session = start();
    session.update(opening());
    session.presence(['p0']);
    expect(screen.getByText('Reconnecting…')).toBeTruthy();
    session.presence([]);
    expect(screen.queryByText('Reconnecting…')).toBeNull();
    expect(screen.getByText('Back in the match')).toBeTruthy();
  });

  it('says the match carries on when leaving a table with other people', () => {
    start({ seats: SEATS.map((s, i) => (i === 1 ? { ...s, nickname: 'Bo', bot: false } : s)) });
    fireEvent.click(screen.getByRole('button', { name: 'Leave match' }));
    expect(screen.getByText(/The match carries on without you/)).toBeTruthy();
  });
});
```

In `apps/client/test/App.test.tsx`, add inside `describe('App (spec #2 §4.1, §7.1)', ...)`:

```tsx
  it('goes back to the menu with a toast when my seat was lost (spec #4 §5.2)', () => {
    const { made } = setup();
    const session = startMatch(made);
    session.fail('The match carried on without you', 'seat-lost');
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
    expect(screen.getByText('The match carried on without you')).toBeTruthy();
  });
```

In `apps/client/test/workerSession.test.ts`, add inside `describe('WorkerMatchSession', ...)`:

```ts
  it('never reports anyone away', () => {
    const worker = new FakeWorker();
    const session = new WorkerMatchSession(worker, SEATS, SEEDS);
    const got: string[][] = [];
    const off = session.onPresence((away) => got.push(away));
    worker.reply({ type: 'update', update: openingUpdate() });
    off();
    expect(got).toEqual([]);
  });
```

Run: `pnpm vitest run apps/client/test/presence.test.ts apps/client/test/hud.test.tsx apps/client/test/MatchScreen.test.tsx apps/client/test/App.test.tsx apps/client/test/workerSession.test.ts`
Expected: FAIL. `presence.ts` is missing, `away` isn't a row field, `onPresence` doesn't exist, and `onFailed` still gets a string.

- [ ] **Step 2: Extend the session contract.** In `apps/client/src/service/matchService.ts`:
- import `type FailReason` from `'@laddorious/host'`;
- add:

```ts
/** Why a match ended early (spec #2 §8). Online, the server also says why (spec #4 §6). */
export interface MatchFailure {
  message: string;
  reason?: FailReason;
}
```

- in `MatchSession`, change `onFailed` to `onFailed(cb: (e: MatchFailure) => void): () => void;` and add after it:

```ts
  /** Who is away (spec #4 §3.3): the server's list, plus me while my connection is down. The local session never reports anyone. */
  onPresence(cb: (away: PlayerId[]) => void): () => void;
```

In `apps/client/src/service/workerSession.ts`, type `failures` as `Channel<MatchFailure>` and `onFailed(cb: (e: MatchFailure) => void)`, and add:

```ts
  /** Nobody is ever away in a local match. */
  onPresence(): () => void {
    return () => {};
  }
```

- [ ] **Step 3: Write `presenceToast`.** Create `apps/client/src/hud/presence.ts`:

```ts
import type { PlayerId } from '@laddorious/core';
import type { SeatInfo } from '../service/matchService';

/**
 * The toast for a change in who is away (spec #4 §3.3), or null. My own drop shows as the
 * reconnecting pill instead; my return is "Back in the match".
 */
export function presenceToast(before: readonly PlayerId[], after: readonly PlayerId[], seats: readonly SeatInfo[], me: PlayerId): string | null {
  if (before.includes(me) && !after.includes(me)) return 'Back in the match';
  const names = (ids: PlayerId[]) => ids.map((id) => seats.find((s) => s.playerId === id)?.nickname ?? id).join(' and ');
  const gone = after.filter((id) => id !== me && !before.includes(id));
  if (gone.length > 0) return `${names(gone)} lost connection`;
  const back = before.filter((id) => id !== me && !after.includes(id));
  if (back.length > 0) return `${names(back)} ${back.length > 1 ? 'are' : 'is'} back`;
  return null;
}
```

- [ ] **Step 4: The Away badge.** In `apps/client/src/hud/model.ts`:
- add to `PlayerRow`, after `watched`: `/** Their connection is down; their seat plays on by timeouts (spec #4 M2). */ away: boolean;`;
- add to `RowsInput`: `/** Away players (spec #4 §3.3). */ away?: readonly PlayerId[];`;
- in `playerRows`, destructure `away = []` and set `away: away.includes(id)` after `watched`.

In `apps/client/src/hud/PlayerColumn.tsx`:
- add `row.away ? 'away' : ''` to the row's classes;
- make the aria-label `` `${nameOf(row)}, tile ${row.tile}, rank ${row.rank}${row.away ? ', away' : ''}. ${row.statusText}` ``;
- inside `.prow-name`, after the tile, add `{row.away && <span className="prow-away">Away</span>}`.

Append to `apps/client/src/hud/hud.css`:

```css
/* A player whose connection dropped (spec #4 §3.3): their seat plays on by timeouts. */
.prow.away .portrait {
  opacity: 0.55;
}

.prow-away {
  padding: 3px 6px 2px;
  border-radius: 6px;
  background: var(--ink);
  color: var(--white);
  font-size: max(10px, 1.5cqh);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
```

- [ ] **Step 5: The match screen.** In `apps/client/src/app/MatchScreen.tsx`:
- import `type MatchFailure` from `'../service/matchService'` and `presenceToast` from `'../hud/presence'`;
- change the prop to `onFailed: (failure: MatchFailure) => void;`, and in the effect use `session.onFailed((e) => handlersRef.current.onFailed(e))`;
- add state and a ref next to the others:

```tsx
  // Who is away (spec #4 §3.3); the ref holds the last list so a change can be announced once.
  const [away, setAway] = useState<PlayerId[]>([]);
  const awayRef = useRef<PlayerId[]>([]);
```

- add to the effect's `offs` list:

```tsx
      session.onPresence((next) => {
        const text = presenceToast(awayRef.current, next, session.seats, session.me);
        awayRef.current = next;
        setAway(next);
        if (text) showToast(text);
      }),
```

- pass `away` to `playerRows({ view, presentation, record, seats, me, watch, away })`;
- after the watch pill, add:

```tsx
        {away.includes(me) && (
          <div className="reconnect-pill pill live" role="status" aria-live="polite">
            <span className="spinner" />
            Reconnecting…
          </div>
        )}
```

- in the leave dialog, replace the text with:

```tsx
            <p className="dialog-text">
              {seats.some((s) => !s.bot && s.playerId !== me)
                ? 'You go back to the menu. The match carries on without you.'
                : 'Leaving ends this match against the bots and takes you back to the menu.'}
            </p>
```

Append to `apps/client/src/app/match.css`:

```css
/* My connection is down (spec #4 §3.3): it stays up until the server has me back. */
.reconnect-pill {
  position: absolute;
  left: 50%;
  top: calc(var(--safe-t) + max(64px, 17cqh));
  z-index: 50;
  transform: translateX(-50%);
}
```

- [ ] **Step 6: The app.** In `apps/client/src/app/App.tsx`:
- import `ToastHost` and `showToast` from `'../ui/toasts'`;
- replace the match screen's `onFailed` with:

```tsx
            onFailed={(failure) => {
              current.leave();
              if (failure.reason === 'seat-lost') {
                // The match carried on without me: back to the menu, saying so (spec #4 §5.2).
                showToast(failure.message);
                setRoute({ screen: 'menu' });
              } else {
                setRoute({ screen: 'error', message: failure.message });
              }
            }}
```

- after `{settingsOpen && ...}` inside `CrashBoundary`, add `{route.screen !== 'match' && route.screen !== 'end' && <ToastHost />}`. The match screen has its own.

- [ ] **Step 7: Run the tests.**

Run: `pnpm vitest run apps/client/test/presence.test.ts apps/client/test/hud.test.tsx apps/client/test/MatchScreen.test.tsx apps/client/test/App.test.tsx apps/client/test/workerSession.test.ts`
Expected: PASS.

Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green, `tokens.test.ts` included: the new CSS uses only tokens.

- [ ] **Step 8: Commit.** `git add -A apps/client && git commit -m "feat(client): away badges, presence toasts and the reconnecting pill"` (with the trailer).

### Task 9: The matchmaking screen and the app, ready for online play

**Files:**
- Modify:
  - `apps/client/src/service/matchService.ts` (`unreachable` state, `MatchService.rejoin?`);
  - `apps/client/src/app/MatchmakingOverlay.tsx` (the unreachable view, tags for real players);
  - `apps/client/src/app/App.tsx` (`offline` and `resume` props, Try again, Play offline with bots);
  - `apps/client/test/screens.test.tsx`, `apps/client/test/App.test.tsx`.

**Interfaces:**
- **Consumes:** Task 8's `App`.
- **Produces:**
  - `MatchmakingState` gains `{ kind: 'unreachable'; message: string }`;
  - `MatchmakingOverlay` props `onRetry?: () => void`, `onOffline?: () => void`;
  - `App` props `offline?: MatchService` (offered when the server can't be reached) and `resume?: MatchSession | null` (start in that match).

- [ ] **Step 1: Write the failing tests.** In `apps/client/test/screens.test.tsx`, add inside `describe('MatchmakingOverlay (spec #2 §7.1, C7)', ...)`. First extend its `open()` helper so it also renders `onRetry` and `onOffline` spies and returns them:

```tsx
  function open() {
    const matchmaking = new ScriptedMatchmaking();
    const onCancelled = vi.fn();
    const onReady = vi.fn();
    const onRetry = vi.fn();
    const onOffline = vi.fn();
    render(<MatchmakingOverlay matchmaking={matchmaking} onCancelled={onCancelled} onReady={onReady} onRetry={onRetry} onOffline={onOffline} />);
    return { matchmaking, onCancelled, onReady, onRetry, onOffline };
  }
```

Then the tests:

```tsx
  it("says when the server can't be reached, with Try again, Play offline with bots and Cancel (spec #4 §3.3)", () => {
    const { matchmaking, onRetry, onOffline } = open();
    matchmaking.emit({ kind: 'unreachable', message: "Can't reach the game server." });
    expect(screen.getByRole('dialog', { name: "CAN'T CONNECT" })).toBeTruthy();
    expect(screen.getByText("Can't reach the game server.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play offline with bots' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(matchmaking.cancel).toHaveBeenCalledTimes(1);
  });

  it('tags bots BOT and real players nothing (spec #4 §4)', () => {
    const { matchmaking } = open();
    const bo = { ...SEATS[1]!, nickname: 'Bo', bot: false };
    matchmaking.emit({ kind: 'searching', elapsedMs: 1_000, seats: [you, bo, null, null] });
    expect(screen.queryByText('BOT')).toBeNull();
    matchmaking.emit({ kind: 'filling', seats: [you, bo, SEATS[2]!, null] });
    expect(screen.getAllByText('BOT')).toHaveLength(1);
  });
```

In `apps/client/test/App.test.tsx`, add a new block at the end of the file:

```tsx
describe('App online (spec #4 §3.3)', () => {
  function setupOnline(resume: ScriptedSession | null = null) {
    const made: ScriptedMatchmaking[] = [];
    const findMatch = vi.fn(() => {
      const matchmaking = new ScriptedMatchmaking();
      made.push(matchmaking);
      return matchmaking;
    });
    const offlineMade: ScriptedMatchmaking[] = [];
    const offline: MatchService = {
      findMatch: vi.fn(() => {
        const matchmaking = new ScriptedMatchmaking();
        offlineMade.push(matchmaking);
        return matchmaking;
      }),
    };
    const prefs = createPrefsStore(null, { prefersReducedMotion: false, random: () => 0.5 });
    render(<App service={{ findMatch }} offline={offline} resume={resume} prefs={prefs} dev={false} />);
    return { findMatch, made, offline, offlineMade };
  }

  it('tries the server again on Try again', () => {
    const { findMatch, made } = setupOnline();
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    made[0]!.emit({ kind: 'unreachable', message: "Can't reach the game server." });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(findMatch).toHaveBeenCalledTimes(2);
  });

  it('plays offline with bots straight away when asked', () => {
    const { made, offline, offlineMade } = setupOnline();
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    made[0]!.emit({ kind: 'unreachable', message: "Can't reach the game server." });
    fireEvent.click(screen.getByRole('button', { name: 'Play offline with bots' }));
    expect(offline.findMatch).toHaveBeenCalledTimes(1);
    expect(offlineMade[0]!.playWithBots).toHaveBeenCalledTimes(1);
  });

  it('starts in the match when a reload rejoined one', () => {
    setupOnline(new ScriptedSession());
    expect(screen.getByRole('button', { name: 'Leave match' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'PLAY' })).toBeNull();
  });
});
```

Run: `pnpm vitest run apps/client/test/screens.test.tsx apps/client/test/App.test.tsx`
Expected: FAIL. TypeScript-wise the `unreachable` kind and the new props don't exist yet (Vitest runs anyway): no "CAN'T CONNECT" dialog, the human seat still shows BOT, and `App` ignores `offline` and `resume`.

- [ ] **Step 2: Extend the contract.** In `apps/client/src/service/matchService.ts`:
- add to `MatchmakingState`: `| { kind: 'unreachable'; message: string } // the server can't be reached, or runs another version (spec #4 §3.3)`;
- add to `MatchService`:

```ts
  /** Online only: after a reload, the saved seat's match, or null (spec #4 §3.3). */
  rejoin?(): MatchSession | null;
```

- [ ] **Step 3: The overlay.** In `apps/client/src/app/MatchmakingOverlay.tsx`:
- add the props:

```tsx
  /** Online: ask the server again after it couldn't be reached (spec #4 §3.3). */
  onRetry?: () => void;
  /** Online: play offline with bots instead. */
  onOffline?: () => void;
```

- take them in the component's parameters;
- make the hotkey `useHotkeys({ Escape: () => matchmaking.cancel() }, state?.kind === 'searching' || state?.kind === 'unreachable');`;
- right after `if (!state || state.kind === 'cancelled') return null;`, add:

```tsx
  if (state.kind === 'unreachable') {
    return (
      <div className="popup live matchmaking" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="backdrop" />
        <div className="popup-content">
          <h2 id={titleId} className="popup-title display">
            {"CAN'T CONNECT"}
          </h2>
          <p className="popup-hint">{state.message}</p>
          <div className="mm-buttons">
            {onRetry && (
              <button type="button" className="btn accent" onClick={onRetry}>
                Try again
              </button>
            )}
            {onOffline && (
              <button type="button" className="btn" onClick={onOffline}>
                Play offline with bots
              </button>
            )}
            <button type="button" className="btn" onClick={() => matchmaking.cancel()}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
```

- in `SeatSlot`, show the tag only for me and for bots:

```tsx
      {(me || seat.bot) && <span className="mm-tag">{me ? 'YOU' : 'BOT'}</span>}
```

- [ ] **Step 4: The app.** In `apps/client/src/app/App.tsx`:
- add to `AppProps`:

```tsx
  /** Online builds: the offline bots, offered when the server can't be reached (spec #4 §3.3). */
  offline?: MatchService;
  /** Online builds: a match rejoined after a reload; the app starts in it (spec #4 §3.3). */
  resume?: MatchSession | null;
```

- take `offline` and `resume = null` in the parameters, and start with `useState<Route>(() => (resume ? { screen: 'match', session: resume } : { screen: 'menu' }))`;
- next to `play`, add:

```tsx
  const playOffline = () => {
    if (!offline) return;
    const matchmaking = offline.findMatch(prefs.getState().profile);
    matchmaking.playWithBots();
    setRoute({ screen: 'matchmaking', matchmaking });
  };
```

- pass the new handlers to the overlay: `onRetry={() => play()} onOffline={offline ? playOffline : undefined}`.

- [ ] **Step 5: Run the tests.**

Run: `pnpm vitest run apps/client/test/screens.test.tsx apps/client/test/App.test.tsx`
Expected: PASS. Then `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

- [ ] **Step 6: Commit.** `git commit -am "feat(client): unreachable-server fallback and starting in a rejoined match"` (with the trailer).

### Task 10: The online match session

**Files:**
- Create:
  - `apps/client/src/service/channel.ts` (`Channel`, moved out of `workerSession.ts`);
  - `apps/client/src/service/onlineSocket.ts`, `apps/client/src/service/savedSeat.ts`, `apps/client/src/service/onlineSession.ts`;
  - `apps/client/test/support/fakeSocket.ts`, `apps/client/test/onlineSession.test.ts`.
- Modify: `apps/client/src/service/workerSession.ts` (imports `Channel`)

**Interfaces:**
- **Consumes:** `MatchIn`, `MatchOut`, `Seat` (Task 3); `MatchSession`, `MatchFailure` (Task 8); `colorSeats` (Task 3).
- **Produces:**
  - `SocketLike`, `OpenSocket = (url) => SocketLike`, `browserSocket`, `OPEN`, `PING_MS = 5000`, `VERSION_MESSAGE`, `sendJson(ws, msg)`, `readJson<T>(data)`, `quietClose(ws)`;
  - `SavedSeat { matchId; token; me; seats: Seat[] }`, `SeatStore`, `SEAT_KEY`, `tabStorage()`, `saveSeat`, `loadSeat`, `clearSeat`;
  - `OnlineDeps { url; open: OpenSocket; store: SeatStore | null }`;
  - `class OnlineMatchSession implements MatchSession`, `new OnlineMatchSession(deps, seat: SavedSeat)`;
  - `BACKOFF_MS = [500, 1000, 2000, 4000, 8000]`, `REJOIN_MS = 60_000`, `SEAT_LOST_MESSAGE`;
  - test support: `FakeSocket`, `fakeSockets()`, `memoryStore()`.

- [ ] **Step 1: Move `Channel` out.** Create `apps/client/src/service/channel.ts` with the `Channel` class from `workerSession.ts`, exported, comment included:

```ts
/** Fans values out to listeners. Values that arrive before the first listener are held for it. */
export class Channel<T> {
  private readonly listeners = new Set<(value: T) => void>();
  private held: T[] | null = [];

  emit(value: T): void {
    if (this.held) this.held.push(value);
    else for (const cb of this.listeners) cb(value);
  }

  on(cb: (value: T) => void): () => void {
    this.listeners.add(cb);
    const held = this.held ?? [];
    this.held = null;
    for (const value of held) cb(value);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
```

Delete it from `workerSession.ts` and add `import { Channel } from './channel';`. Run `pnpm vitest run apps/client/test/workerSession.test.ts`. Expected: PASS, unchanged.

- [ ] **Step 2: Write the test support.** Create `apps/client/test/support/fakeSocket.ts`:

```ts
import type { OpenSocket, SocketLike } from '../../src/service/onlineSocket';
import type { SeatStore } from '../../src/service/savedSeat';

/** A WebSocket whose server side the test plays: what the game sent, and open, reply and drop. */
export class FakeSocket implements SocketLike {
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  closed = false;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.closed = true;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  reply(msg: unknown): void {
    this.onmessage?.({ data: JSON.stringify(msg) } as MessageEvent);
  }

  /** The connection drops, or never opens. */
  drop(): void {
    this.readyState = 3;
    this.onclose?.({} as CloseEvent);
  }
}

/** Opens FakeSockets and keeps them in order. */
export function fakeSockets() {
  const made: FakeSocket[] = [];
  const open: OpenSocket = (url) => {
    const socket = new FakeSocket(url);
    made.push(socket);
    return socket;
  };
  return { made, open, last: () => made.at(-1)! };
}

/** A sessionStorage in memory. */
export function memoryStore(): SeatStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}
```

- [ ] **Step 3: Write the failing tests.** Create `apps/client/test/onlineSession.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchFailure, MatchUpdate } from '../src/service/matchService';
import { BACKOFF_MS, OnlineMatchSession, REJOIN_MS } from '../src/service/onlineSession';
import { SEAT_KEY, saveSeat, type SavedSeat } from '../src/service/savedSeat';
import { SEATS, openingUpdate } from './support/fixtures';
import { fakeSockets, memoryStore } from './support/fakeSocket';

const TOKEN = 'ab'.repeat(16);
const SAVED: SavedSeat = { matchId: 'm1', token: TOKEN, me: 'p0', seats: SEATS.map((s) => ({ playerId: s.playerId, nickname: s.nickname, piece: s.piece, bot: s.bot })) };

/** A session on a fresh socket, with everything it reports recorded. */
function start() {
  const sockets = fakeSockets();
  const store = memoryStore();
  saveSeat(store, SAVED);
  const session = new OnlineMatchSession({ url: 'ws://test', open: sockets.open, store }, SAVED);
  const got = { updates: [] as MatchUpdate[], presence: [] as string[][], failures: [] as MatchFailure[], rejected: [] as unknown[] };
  session.onUpdate((u) => got.updates.push(u));
  session.onPresence((away) => got.presence.push(away));
  session.onFailed((f) => got.failures.push(f));
  session.onRejected((e) => got.rejected.push(e));
  return { session, sockets, store, got };
}

/** An update for this window, its countdown ending at server time `endsAt`, or none. */
function update(windowId: number, endsAt: number | null): MatchUpdate {
  const u = openingUpdate();
  return { ...u, view: { ...u.view, awaiting: { ...u.view.awaiting, windowId } }, timer: endsAt === null ? null : { windowId, endsAt } };
}

const welcome = (serverTime: number) => ({ type: 'welcome', me: 'p0', seats: SAVED.seats, serverTime });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OnlineMatchSession (spec #4 §3.3)', () => {
  it('opens /match/:id, joins with its token, then pings every 5 s', () => {
    const { session, sockets } = start();
    const ws = sockets.last();
    expect(ws.url).toBe('ws://test/match/m1');
    ws.open();
    expect(ws.sent).toEqual([{ type: 'join', token: TOKEN }, { type: 'ping', t: 0 }]);
    vi.advanceTimersByTime(5000);
    expect(ws.sent.at(-1)).toEqual({ type: 'ping', t: 5000 });
    expect(session.me).toBe('p0');
    expect(session.seats.map((s) => s.color)).toEqual(['#ff5470', '#3b82f6', '#a3e635', '#8b5cf6']);
  });

  it("converts the countdown to this device's clock, from the median of the last pings (spec #4 §5.3)", () => {
    const { sockets, got } = start();
    const ws = sockets.last();
    ws.open();
    // The server's clock runs 10 s ahead of this phone's.
    ws.reply(welcome(10_000));
    ws.reply({ type: 'update', update: update(1, 22_000) });
    expect(got.updates.at(-1)!.timer).toEqual({ windowId: 1, endsAt: 12_000 });
    // Pings measure it more closely, and one slow answer is outvoted.
    vi.setSystemTime(200);
    ws.reply({ type: 'pong', t: 100, serverTime: 10_250 }); // 10_250 - (100 + 200) / 2 = 10_100
    ws.reply({ type: 'pong', t: 100, serverTime: 10_250 });
    ws.reply({ type: 'pong', t: 100, serverTime: 13_000 });
    ws.reply({ type: 'update', update: update(1, 22_000) });
    expect(got.updates.at(-1)!.timer).toEqual({ windowId: 1, endsAt: 11_900 });
  });

  it("stamps actions with the latest update's window, and passes playback and rejections on", () => {
    const { session, sockets, got } = start();
    const ws = sockets.last();
    ws.open();
    ws.reply({ type: 'update', update: update(4, null) });
    session.send({ type: 'roll' });
    expect(ws.sent.at(-1)).toEqual({ type: 'action', action: { type: 'roll' }, windowId: 4 });
    session.playbackDone(4);
    expect(ws.sent.at(-1)).toEqual({ type: 'playbackDone', windowId: 4 });
    ws.reply({ type: 'rejected', error: { code: 'STALE_INPUT', message: 'late' } });
    expect(got.rejected).toEqual([{ code: 'STALE_INPUT', message: 'late' }]);
  });

  it('reports who is away', () => {
    const { sockets, got } = start();
    sockets.last().open();
    sockets.last().reply({ type: 'presence', away: ['p1'] });
    expect(got.presence).toEqual([['p1']]);
  });

  it('reconnects with backoff, shows me away meanwhile, and rejoins with the same token', () => {
    const { sockets, got } = start();
    sockets.last().open();
    sockets.last().reply({ type: 'presence', away: ['p2'] });
    sockets.last().drop();
    expect(got.presence.at(-1)).toEqual(['p2', 'p0']);
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      const count = sockets.made.length;
      let waited = 0;
      while (sockets.made.length === count) {
        vi.advanceTimersByTime(100);
        waited += 100;
      }
      waits.push(waited);
      if (i < 5) sockets.last().drop(); // that attempt failed too
    }
    expect(waits).toEqual([...BACKOFF_MS, 8000]);
    const ws = sockets.last();
    ws.open();
    expect(ws.sent[0]).toEqual({ type: 'join', token: TOKEN });
    ws.reply(welcome(Date.now()));
    ws.reply({ type: 'presence', away: [] });
    expect(got.presence.at(-1)).toEqual([]);
  });

  it('gives up after 60 s: the match carried on without me', () => {
    const { sockets, store, got } = start();
    sockets.last().open();
    sockets.last().drop();
    for (let t = 0; t <= REJOIN_MS + 10_000 && got.failures.length === 0; t += 100) {
      const count = sockets.made.length;
      vi.advanceTimersByTime(100);
      if (sockets.made.length > count) sockets.last().drop();
    }
    expect(got.failures).toEqual([{ message: 'The match carried on without you', reason: 'seat-lost' }]);
    expect(store.map.has(SEAT_KEY)).toBe(false);
    const count = sockets.made.length;
    vi.advanceTimersByTime(60_000);
    expect(sockets.made).toHaveLength(count);
  });

  it("passes the server's failures on: a lost seat, another version, a match that's gone", () => {
    for (const [reason, message, shown] of [
      ['seat-lost', 'The match carried on without you', 'The match carried on without you'],
      ['version', 'protocol 2', 'Please reload, the game was updated.'],
      ['server-error', 'This match is no longer running', 'This match is no longer running'],
    ] as const) {
      const { sockets, store, got } = start();
      sockets.last().open();
      sockets.last().reply({ type: 'failed', reason, message });
      expect(got.failures).toEqual([{ message: shown, reason }]);
      expect(sockets.last().closed).toBe(true);
      expect(store.map.has(SEAT_KEY)).toBe(false);
    }
  });

  it('leaves: sends leave, closes, forgets the seat and never reconnects', () => {
    const { session, sockets, store } = start();
    const ws = sockets.last();
    ws.open();
    session.leave();
    expect(ws.sent.at(-1)).toEqual({ type: 'leave' });
    expect(ws.closed).toBe(true);
    expect(store.map.has(SEAT_KEY)).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(sockets.made).toHaveLength(1);
  });

  it('stops reconnecting and forgets the seat once the match is won', () => {
    const { sockets, store } = start();
    const ws = sockets.last();
    ws.open();
    const u = openingUpdate();
    const rankings = [{ player: 'p0', rank: 1, position: 100 }];
    ws.reply({ type: 'update', update: { ...u, view: { ...u.view, phase: { kind: 'finished', winner: 'p0', rankings }, awaiting: { windowId: 9, window: 'none', players: [], durationMs: 0 } } } });
    expect(store.map.has(SEAT_KEY)).toBe(false);
    ws.drop(); // the server closes the room 10 s after the win
    vi.advanceTimersByTime(60_000);
    expect(sockets.made).toHaveLength(1);
  });
});
```

Run: `pnpm vitest run apps/client/test/onlineSession.test.ts`
Expected: FAIL, the modules don't exist.

- [ ] **Step 4: Implement.** Create `apps/client/src/service/onlineSocket.ts`:

```ts
// The browser side of the multiplayer server's sockets (spec #4 §3.3, §6).

/** The part of a WebSocket the online service uses, so tests can stand in for one. */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((e: Event) => void) | null;
  onmessage: ((e: MessageEvent) => void) | null;
  onclose: ((e: CloseEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
}

export type OpenSocket = (url: string) => SocketLike;

/** WebSocket.OPEN. */
export const OPEN = 1;
/** How often a match socket pings the server: the clock offset, and proof it's alive (spec #4 §5.3). */
export const PING_MS = 5000;
export const VERSION_MESSAGE = 'Please reload, the game was updated.';

export const browserSocket: OpenSocket = (url) => new WebSocket(url);

/** Sends one message as JSON if the socket is open; otherwise it's dropped. */
export function sendJson(ws: SocketLike | null, msg: unknown): void {
  if (ws?.readyState === OPEN) ws.send(JSON.stringify(msg));
}

/** A text frame's JSON, or null. */
export function readJson<T>(data: unknown): T | null {
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/** Closes a socket without hearing from it again. */
export function quietClose(ws: SocketLike): void {
  ws.onopen = null;
  ws.onmessage = null;
  ws.onclose = null;
  ws.onerror = null;
  try {
    ws.close();
  } catch {
    // already closed
  }
}
```

Create `apps/client/src/service/savedSeat.ts`:

```ts
import type { PlayerId } from '@laddorious/core';
import type { Seat } from '@laddorious/host';

/** A seat to come back to after a reload (spec #4 §3.3, §7). Kept only in this tab's sessionStorage. */
export interface SavedSeat {
  matchId: string;
  token: string;
  me: PlayerId;
  seats: Seat[];
}

/** The part of Storage the saved seat uses. */
export interface SeatStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SEAT_KEY = 'laddorious.seat';

/** This tab's sessionStorage, or null where it's blocked. */
export function tabStorage(): SeatStore | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function saveSeat(store: SeatStore | null, seat: SavedSeat): void {
  try {
    store?.setItem(SEAT_KEY, JSON.stringify(seat));
  } catch {
    // full or blocked: no rejoin after a reload
  }
}

/** The saved seat, or null if there is none or it doesn't read back. */
export function loadSeat(store: SeatStore | null): SavedSeat | null {
  try {
    const raw = store?.getItem(SEAT_KEY);
    if (!raw) return null;
    const seat = JSON.parse(raw) as Partial<SavedSeat>;
    const ok = typeof seat.matchId === 'string' && typeof seat.token === 'string' && typeof seat.me === 'string' && Array.isArray(seat.seats);
    return ok ? (seat as SavedSeat) : null;
  } catch {
    return null;
  }
}

export function clearSeat(store: SeatStore | null): void {
  try {
    store?.removeItem(SEAT_KEY);
  } catch {
    // blocked
  }
}
```

Create `apps/client/src/service/onlineSession.ts`:

```ts
import type { InputError, PlayerId } from '@laddorious/core';
import type { MatchIn, MatchOut } from '@laddorious/host';
import { Channel } from './channel';
import type { MatchFailure, MatchSession, MatchUpdate, PlayerAction, SeatInfo } from './matchService';
import { PING_MS, VERSION_MESSAGE, quietClose, readJson, sendJson, type OpenSocket, type SocketLike } from './onlineSocket';
import { clearSeat, type SavedSeat, type SeatStore } from './savedSeat';
import { colorSeats } from './seats';

/** Waits between reconnect attempts (spec #4 §3.3); after the last, every 8 s. */
export const BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;
/** How long the game keeps trying: the server's rejoin window. */
export const REJOIN_MS = 60_000;
/** The clock offset is the median of this many pings (spec #4 §5.3). */
const CLOCK_SAMPLES = 5;
export const SEAT_LOST_MESSAGE = 'The match carried on without you';

/** What an online session needs from its surroundings; tests pass fakes. */
export interface OnlineDeps {
  /** The server's ws:// or wss:// address, without a trailing slash. */
  url: string;
  open: OpenSocket;
  store: SeatStore | null;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * My seat in an online match (spec #4 §3.3): the /match/:id socket, the clock difference with
 * the server, who is away, and reconnecting with backoff for up to 60 s.
 */
export class OnlineMatchSession implements MatchSession {
  readonly me: PlayerId;
  readonly seats: SeatInfo[];
  private ws: SocketLike | null = null;
  private windowId = 0;
  /** Left, failed or won: no more reconnecting. */
  private over = false;
  private away: PlayerId[] = [];
  private downSince: number | null = null;
  private attempt = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;
  private samples: number[] = [];
  /** Server time minus my time. */
  private offset = 0;
  private readonly updates = new Channel<MatchUpdate>();
  private readonly rejections = new Channel<InputError>();
  private readonly failures = new Channel<MatchFailure>();
  private readonly presence = new Channel<PlayerId[]>();

  constructor(
    private readonly deps: OnlineDeps,
    private readonly seat: SavedSeat,
  ) {
    this.me = seat.me;
    this.seats = colorSeats(seat.seats);
    this.connect();
  }

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    return this.updates.on(cb);
  }

  onRejected(cb: (e: InputError) => void): () => void {
    return this.rejections.on(cb);
  }

  onFailed(cb: (e: MatchFailure) => void): () => void {
    return this.failures.on(cb);
  }

  onPresence(cb: (away: PlayerId[]) => void): () => void {
    return this.presence.on(cb);
  }

  send(action: PlayerAction): void {
    this.post({ type: 'action', action, windowId: this.windowId });
  }

  playbackDone(windowId: number): void {
    this.post({ type: 'playbackDone', windowId });
  }

  /** The server's match never pauses for one player: pausing is local only (spec #2 C14). */
  pause(): void {}

  resume(): void {}

  leave(): void {
    if (!this.over) this.post({ type: 'leave' });
    this.finish();
    this.close();
  }

  private connect(): void {
    const ws = this.deps.open(`${this.deps.url}/match/${this.seat.matchId}`);
    this.ws = ws;
    ws.onopen = () => {
      this.post({ type: 'join', token: this.seat.token });
      this.ping();
      this.pinger = setInterval(() => this.ping(), PING_MS);
    };
    ws.onmessage = (e) => this.receive(e.data);
    ws.onclose = () => this.dropped();
    ws.onerror = () => {}; // a close follows
  }

  private receive(data: unknown): void {
    const msg = readJson<MatchOut>(data);
    if (!msg || this.over) return;
    switch (msg.type) {
      case 'welcome':
        this.downSince = null;
        this.attempt = 0;
        if (this.samples.length === 0) this.offset = msg.serverTime - Date.now(); // a first guess until the pings answer
        return;
      case 'update': {
        const { update } = msg;
        this.windowId = update.view.awaiting.windowId;
        // The countdown on my own clock, so a phone with a wrong clock still counts right.
        this.updates.emit(update.timer ? { ...update, timer: { ...update.timer, endsAt: update.timer.endsAt - this.offset } } : update);
        if (update.view.phase.kind === 'finished') this.finish();
        return;
      }
      case 'rejected':
        this.rejections.emit(msg.error);
        return;
      case 'presence':
        this.away = msg.away;
        this.presence.emit(msg.away);
        return;
      case 'pong':
        this.samples = [...this.samples, msg.serverTime - (msg.t + Date.now()) / 2].slice(-CLOCK_SAMPLES);
        this.offset = median(this.samples);
        return;
      case 'failed':
        this.finish();
        this.close();
        this.failures.emit({ message: msg.reason === 'version' ? VERSION_MESSAGE : msg.message, reason: msg.reason });
        return;
    }
  }

  /** The socket closed. Unless the match is over, try again with backoff for up to 60 s. */
  private dropped(): void {
    this.stopPinging();
    this.ws = null;
    if (this.over) return;
    const now = Date.now();
    if (this.downSince === null) {
      this.downSince = now;
      this.presence.emit([...this.away.filter((id) => id !== this.me), this.me]);
    }
    if (now - this.downSince >= REJOIN_MS) {
      this.finish();
      this.failures.emit({ message: SEAT_LOST_MESSAGE, reason: 'seat-lost' });
      return;
    }
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)]!;
    this.attempt += 1;
    this.retry = setTimeout(() => {
      this.retry = null;
      if (!this.over) this.connect();
    }, delay);
  }

  private ping(): void {
    this.post({ type: 'ping', t: Date.now() });
  }

  private post(msg: MatchIn): void {
    sendJson(this.ws, msg);
  }

  /** No more reconnecting, and no rejoin after a reload. */
  private finish(): void {
    this.over = true;
    clearSeat(this.deps.store);
    if (this.retry !== null) clearTimeout(this.retry);
    this.retry = null;
  }

  private close(): void {
    this.stopPinging();
    if (this.ws) quietClose(this.ws);
    this.ws = null;
  }

  private stopPinging(): void {
    if (this.pinger !== null) clearInterval(this.pinger);
    this.pinger = null;
  }
}
```

Run: `pnpm vitest run apps/client/test/onlineSession.test.ts apps/client/test/workerSession.test.ts`
Expected: PASS (9 + the existing worker session tests).

- [ ] **Step 5: Run the gate.** `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green. If ESLint flags the empty `pause()` and `resume()` bodies, keep them and add the comment inside each body: `// local only`.

- [ ] **Step 6: Commit.** `git add -A apps/client && git commit -m "feat(client): the online match session with clock sync and reconnect"` (with the trailer).

### Task 11: Online matchmaking and reload rejoin

**Files:**
- Create: `apps/client/src/service/onlineMatchService.ts`, `apps/client/test/onlineMatchService.test.ts`

**Interfaces:**
- **Consumes:** `OnlineMatchSession`, `OnlineDeps` (Task 10); `browserSocket`, `sendJson`, `readJson`, `quietClose`, `VERSION_MESSAGE` (Task 10); `saveSeat`, `loadSeat`, `tabStorage` (Task 10); `colorSeat` (Task 3); `LobbyIn`, `LobbyOut`, `PROTOCOL_VERSION` (Task 3); the `unreachable` state and `MatchService.rejoin?` (Task 9).
- **Produces:**
  - `class OnlineMatchService implements MatchService`:
    - `new OnlineMatchService({ url, open?, store? })`;
    - `findMatch(profile)`;
    - `rejoin(): MatchSession | null`;
  - `serverUrl(setting: string | undefined, page: { protocol: string; host: string }): string | null`;
  - `CONNECT_TIMEOUT_MS = 5000`, `UNREACHABLE_MESSAGE`.

- [ ] **Step 1: Write the failing tests.** Create `apps/client/test/onlineMatchService.test.ts`:

```ts
import { PROTOCOL_VERSION, type PieceId, type Seat } from '@laddorious/host';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchmakingState, Profile } from '../src/service/matchService';
import { CONNECT_TIMEOUT_MS, OnlineMatchService, serverUrl } from '../src/service/onlineMatchService';
import { SEAT_KEY, saveSeat } from '../src/service/savedSeat';
import { fakeSockets, memoryStore } from './support/fakeSocket';

const ARI: Profile = { nickname: 'Ari', piece: 'meeple' };
const seat = (playerId: string, nickname: string, piece: PieceId = 'knight', bot = false): Seat => ({ playerId, nickname, piece, bot });

/** PLAY against a fake lobby: every matchmaking state is recorded. */
function search() {
  const sockets = fakeSockets();
  const store = memoryStore();
  const service = new OnlineMatchService({ url: 'ws://test', open: sockets.open, store });
  const matchmaking = service.findMatch(ARI);
  const states: MatchmakingState[] = [];
  matchmaking.onState((s) => states.push(s));
  return { service, matchmaking, states, last: () => states.at(-1)!, lobby: sockets.made[0]!, sockets, store };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OnlineMatchService matchmaking (spec #4 §4)', () => {
  it('shows me in seat 0 at once, then says hello and find when the lobby opens', () => {
    const { last, lobby } = search();
    expect(lobby.url).toBe('ws://test/lobby');
    expect(last()).toEqual({ kind: 'searching', elapsedMs: 0, seats: [{ playerId: 'p0', nickname: 'Ari', piece: 'meeple', bot: false, color: '#ff5470' }, null, null, null] });
    lobby.open();
    expect(lobby.sent).toEqual([{ type: 'hello', version: PROTOCOL_VERSION, profile: ARI }, { type: 'find' }]);
  });

  it('lists the table with my seat first, each seat in the colour of its place at the table (M10)', () => {
    const { last, lobby } = search();
    lobby.open();
    lobby.reply({ type: 'matchmaking', state: 'searching', seats: [seat('p0', 'Bo'), seat('p1', 'Ari', 'meeple'), null, null], you: 1, elapsedMs: 3000 });
    const s = last();
    if (s.kind !== 'searching') throw new Error(`expected searching, got ${s.kind}`);
    expect(s.elapsedMs).toBe(3000);
    expect(s.seats.map((x) => x && [x.nickname, x.color])).toEqual([['Ari', '#3b82f6'], ['Bo', '#ff5470'], null, null]);
  });

  it('asks the server for bots, and shows them taking seats', () => {
    const { matchmaking, last, lobby } = search();
    lobby.open();
    matchmaking.playWithBots();
    expect(lobby.sent.at(-1)).toEqual({ type: 'playWithBots' });
    lobby.reply({ type: 'matchmaking', state: 'filling', seats: [seat('p0', 'Ari', 'meeple'), seat('p1', 'Mochi', 'knight', true), null, null], you: 0, elapsedMs: 15_000 });
    expect(last().kind).toBe('filling');
    lobby.reply({ type: 'matchmaking', state: 'searching', seats: [seat('p0', 'Ari', 'meeple'), null, null, null], you: 0, elapsedMs: 16_000 });
    expect(last().kind).toBe('filling'); // a late tick doesn't undo it
  });

  it('opens the match with its seat and token, and saves them for a reload', () => {
    const { last, lobby, sockets, store } = search();
    lobby.open();
    const seats = [seat('p0', 'Bo'), seat('p1', 'Ari', 'meeple'), seat('p2', 'Mochi', 'pawn', true), seat('p3', 'Pip', 'dragon', true)];
    lobby.reply({ type: 'found', matchId: 'm7', me: 'p1', seats, token: 'cd'.repeat(16) });
    const s = last();
    if (s.kind !== 'found') throw new Error(`expected found, got ${s.kind}`);
    expect(s.session.me).toBe('p1');
    expect(s.session.seats.map((x) => x.color)).toEqual(['#ff5470', '#3b82f6', '#a3e635', '#8b5cf6']);
    expect(lobby.closed).toBe(true);
    expect(sockets.last().url).toBe('ws://test/match/m7');
    expect(JSON.parse(store.map.get(SEAT_KEY)!)).toEqual({ matchId: 'm7', token: 'cd'.repeat(16), me: 'p1', seats });
  });

  it('cancels while searching, and ignores cancel once bots are taking seats', () => {
    const first = search();
    first.lobby.open();
    first.matchmaking.cancel();
    expect(first.lobby.sent.at(-1)).toEqual({ type: 'cancel' });
    expect(first.last()).toEqual({ kind: 'cancelled' });
    expect(first.lobby.closed).toBe(true);

    const second = search();
    second.lobby.open();
    second.lobby.reply({ type: 'matchmaking', state: 'filling', seats: [seat('p0', 'Ari', 'meeple'), null, null, null], you: 0, elapsedMs: 15_000 });
    second.matchmaking.cancel();
    expect(second.last().kind).toBe('filling');
    expect(second.lobby.closed).toBe(false);
  });
});

describe('OnlineMatchService when the server is out of reach (spec #4 §3.3)', () => {
  it("offers offline play when the lobby doesn't open within 5 s", () => {
    const { last, lobby } = search();
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS - 1);
    expect(last().kind).toBe('searching');
    vi.advanceTimersByTime(1);
    expect(last()).toEqual({ kind: 'unreachable', message: "Can't reach the game server." });
    expect(lobby.closed).toBe(true);
  });

  it('says so at once when the lobby connection drops before a match is found', () => {
    const { last, lobby } = search();
    lobby.open();
    lobby.drop();
    expect(last()).toEqual({ kind: 'unreachable', message: "Can't reach the game server." });
  });

  it('asks for a reload when the server runs another version', () => {
    const { last, lobby } = search();
    lobby.open();
    lobby.reply({ type: 'failed', reason: 'version', message: 'Please reload, the game was updated.' });
    expect(last()).toEqual({ kind: 'unreachable', message: 'Please reload, the game was updated.' });
  });

  it('goes back to the menu on cancel from there', () => {
    const { matchmaking, last } = search();
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS);
    matchmaking.cancel();
    expect(last()).toEqual({ kind: 'cancelled' });
  });
});

describe('OnlineMatchService.rejoin (spec #4 §3.3)', () => {
  it('rejoins the saved seat after a reload, and returns null without one', () => {
    const sockets = fakeSockets();
    const store = memoryStore();
    const service = new OnlineMatchService({ url: 'ws://test', open: sockets.open, store });
    expect(service.rejoin()).toBeNull();
    saveSeat(store, { matchId: 'm7', token: 'cd'.repeat(16), me: 'p1', seats: [seat('p0', 'Bo'), seat('p1', 'Ari', 'meeple'), seat('p2', 'Mochi', 'pawn', true), seat('p3', 'Pip', 'dragon', true)] });
    const session = service.rejoin();
    expect(session?.me).toBe('p1');
    expect(sockets.last().url).toBe('ws://test/match/m7');
    store.setItem(SEAT_KEY, '{broken');
    expect(service.rejoin()).toBeNull();
  });
});

describe('serverUrl (spec #4 M11)', () => {
  it('reads VITE_SERVER: same-origin, an explicit address, or offline', () => {
    const page = { protocol: 'http:', host: '192.168.1.20:8787' };
    expect(serverUrl('same-origin', page)).toBe('ws://192.168.1.20:8787');
    expect(serverUrl('same-origin', { protocol: 'https:', host: 'laddorious.example.workers.dev' })).toBe('wss://laddorious.example.workers.dev');
    expect(serverUrl('wss://game.example.com/', page)).toBe('wss://game.example.com');
    expect(serverUrl('ws://localhost:8787', page)).toBe('ws://localhost:8787');
    expect(serverUrl(undefined, page)).toBeNull();
    expect(serverUrl('', page)).toBeNull();
    expect(serverUrl('http://not-a-socket', page)).toBeNull();
  });
});
```

Run: `pnpm vitest run apps/client/test/onlineMatchService.test.ts`
Expected: FAIL, `../src/service/onlineMatchService` doesn't exist.

- [ ] **Step 2: Implement.** Create `apps/client/src/service/onlineMatchService.ts`:

```ts
import { PROTOCOL_VERSION, type LobbyIn, type LobbyOut } from '@laddorious/host';
import type { Matchmaking, MatchmakingState, MatchService, MatchSession, Profile, SeatInfo } from './matchService';
import { OnlineMatchSession, type OnlineDeps } from './onlineSession';
import { VERSION_MESSAGE, browserSocket, quietClose, readJson, sendJson, type SocketLike } from './onlineSocket';
import { loadSeat, saveSeat, tabStorage } from './savedSeat';
import { colorSeat } from './seats';

/** The lobby has this long to open before the game offers offline play (spec #4 §3.3). */
export const CONNECT_TIMEOUT_MS = 5000;
export const UNREACHABLE_MESSAGE = "Can't reach the game server.";

/**
 * The server address from VITE_SERVER (spec #4 M11): "same-origin" (the Worker served this page),
 * a ws:// or wss:// address, or null to play offline.
 */
export function serverUrl(setting: string | undefined, page: { protocol: string; host: string }): string | null {
  if (!setting) return null;
  if (setting === 'same-origin') return `${page.protocol === 'https:' ? 'wss' : 'ws'}://${page.host}`;
  if (/^wss?:\/\//.test(setting)) return setting.replace(/\/+$/, '');
  return null;
}

/** Quick match and matches on the multiplayer server (spec #4 §3.3). */
export class OnlineMatchService implements MatchService {
  private readonly deps: OnlineDeps;

  constructor(deps: Pick<OnlineDeps, 'url'> & Partial<OnlineDeps>) {
    this.deps = { open: browserSocket, store: tabStorage(), ...deps };
  }

  findMatch(profile: Profile): Matchmaking {
    return new OnlineMatchmaking(profile, this.deps);
  }

  /** After a reload: the saved seat's match, or null (spec #4 §3.3). */
  rejoin(): MatchSession | null {
    const seat = loadSeat(this.deps.store);
    return seat ? new OnlineMatchSession(this.deps, seat) : null;
  }
}

/** My seat first, then the others in seat order (spec #4 §4 step 3). */
function ownSeatFirst(seats: Array<SeatInfo | null>, you: number): Array<SeatInfo | null> {
  return [seats[you] ?? null, ...seats.filter((_, i) => i !== you)];
}

/** One search on the /lobby socket (spec #4 §4). */
class OnlineMatchmaking implements Matchmaking {
  private readonly listeners = new Set<(s: MatchmakingState) => void>();
  private state: MatchmakingState;
  private readonly ws: SocketLike;
  private readonly timeout: ReturnType<typeof setTimeout>;
  /** Found, cancelled or unreachable: the lobby socket is done with. */
  private done = false;

  constructor(
    profile: Profile,
    private readonly deps: OnlineDeps,
  ) {
    // Until the lobby answers, I'm alone at the table.
    const me = colorSeat({ playerId: 'p0', nickname: profile.nickname, piece: profile.piece, bot: false }, 0);
    this.state = { kind: 'searching', elapsedMs: 0, seats: [me, null, null, null] };
    this.ws = deps.open(`${deps.url}/lobby`);
    this.timeout = setTimeout(() => this.unreachable(UNREACHABLE_MESSAGE), CONNECT_TIMEOUT_MS);
    this.ws.onopen = () => {
      clearTimeout(this.timeout);
      this.post({ type: 'hello', version: PROTOCOL_VERSION, profile });
      this.post({ type: 'find' });
    };
    this.ws.onmessage = (e) => this.receive(e.data);
    this.ws.onclose = () => this.unreachable(UNREACHABLE_MESSAGE);
    this.ws.onerror = () => {}; // a close follows
  }

  /** Calls cb with the current state at once, then with every change. */
  onState(cb: (s: MatchmakingState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => {
      this.listeners.delete(cb);
    };
  }

  cancel(): void {
    if (this.state.kind === 'searching') this.post({ type: 'cancel' });
    else if (this.state.kind !== 'unreachable') return; // ignored once bots are taking seats
    this.finish();
    this.emit({ kind: 'cancelled' });
  }

  playWithBots(): void {
    if (this.state.kind === 'searching') this.post({ type: 'playWithBots' });
  }

  private receive(data: unknown): void {
    const msg = readJson<LobbyOut>(data);
    if (!msg || this.done) return;
    switch (msg.type) {
      case 'matchmaking': {
        const seats = ownSeatFirst(
          msg.seats.map((s, i) => (s ? colorSeat(s, i) : null)),
          msg.you,
        );
        if (msg.state === 'filling') this.emit({ kind: 'filling', seats });
        else if (this.state.kind === 'searching') this.emit({ kind: 'searching', elapsedMs: msg.elapsedMs, seats });
        return;
      }
      case 'found': {
        this.finish();
        const seat = { matchId: msg.matchId, token: msg.token, me: msg.me, seats: msg.seats };
        saveSeat(this.deps.store, seat);
        this.emit({ kind: 'found', session: new OnlineMatchSession(this.deps, seat) });
        return;
      }
      case 'failed':
        this.unreachable(msg.reason === 'version' ? VERSION_MESSAGE : msg.message);
        return;
      case 'pong':
        return;
    }
  }

  private unreachable(message: string): void {
    if (this.done) return;
    this.finish();
    this.emit({ kind: 'unreachable', message });
  }

  private finish(): void {
    this.done = true;
    clearTimeout(this.timeout);
    quietClose(this.ws);
  }

  private post(msg: LobbyIn): void {
    sendJson(this.ws, msg);
  }

  private emit(s: MatchmakingState): void {
    this.state = s;
    for (const cb of this.listeners) cb(s);
  }
}
```

Run: `pnpm vitest run apps/client/test/onlineMatchService.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 3: Run the gate.** `pnpm typecheck`, `pnpm lint` and `pnpm test`. Expected: all green.

- [ ] **Step 4: Commit.** `git add apps/client && git commit -m "feat(client): online matchmaking and rejoining after a reload"` (with the trailer).

### Task 12: Wiring, the scripts and the deploy guide

**Files:**
- Create: `apps/client/src/env.d.ts`, `apps/server/scripts/online.mjs`, `apps/server/README.md`
- Modify: `apps/client/src/main.tsx`, `package.json` (scripts), `eslint.config.js` (Node globals for the script), `README.md`, `apps/client/README.md`

**Interfaces:**
- **Consumes:** `OnlineMatchService`, `serverUrl` (Task 11); `App`'s `offline` and `resume` props (Task 9).
- **Produces:**
  - `import.meta.env.VITE_SERVER`;
  - the root scripts `pnpm serve`, `pnpm dev:online` and `pnpm deploy:cloudflare`.

- [ ] **Step 1: Pick the service at startup.** Create `apps/client/src/env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where matches run (spec #4 M11): "same-origin", a ws:// or wss:// address, or unset for offline play. */
  readonly VITE_SERVER?: string;
}
```

In `apps/client/src/main.tsx`:
- import `OnlineMatchService` and `serverUrl` from `'./service/onlineMatchService'`;
- rename the existing `service` constant to `local`, then add after it:

```tsx
// Online builds (spec #4 M11): VITE_SERVER names the server, and the offline bots stay as the fallback.
const server = serverUrl(import.meta.env.VITE_SERVER, location);
const online = server ? new OnlineMatchService({ url: server }) : null;
// A reload during an online match goes straight back to it (spec #4 §3.3).
const resume = online?.rejoin() ?? null;
```

- render `<App service={online ?? local} offline={online ? local : undefined} resume={resume} prefs={prefs} dev={import.meta.env.DEV} test={test} />`.

- [ ] **Step 2: The scripts.** Create `apps/server/scripts/online.mjs`:

```js
// The online scripts (spec #4 §8), run from the repository root:
//   pnpm serve              build the game for this server and run it on every network interface (Wi-Fi play)
//   pnpm dev:online         the Vite dev server against a local Worker, for working on online play
//   pnpm deploy:cloudflare  build the game and deploy the Worker (needs `wrangler login` first)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));
const PORT = 8787;

/** Runs a command to the end; this script stops if it fails. */
function run(command, env = {}) {
  const result = spawnSync(command, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Starts a long-running command; this script ends when it does. */
function start(command, cwd, env = {}) {
  const child = spawn(command, { stdio: 'inherit', shell: true, cwd, env: { ...process.env, ...env } });
  child.on('exit', (code) => process.exit(code ?? 0));
}

const mode = process.argv[2];
if (mode === 'serve') {
  run('pnpm --filter @laddorious/client build', { VITE_SERVER: 'same-origin' });
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  console.log('\nLaddorious is starting. Open it on this computer or on any phone on the same Wi-Fi:');
  for (const host of ['localhost', ...lan]) console.log(`  http://${host}:${PORT}`);
  console.log('');
  start(`pnpm exec wrangler dev --ip 0.0.0.0 --port ${PORT}`, SERVER_DIR);
} else if (mode === 'dev') {
  mkdirSync(CLIENT_DIST, { recursive: true }); // wrangler wants the assets folder; Vite serves the game here
  start(`pnpm exec wrangler dev --port ${PORT}`, SERVER_DIR);
  start('pnpm --filter @laddorious/client dev', undefined, { VITE_SERVER: `ws://localhost:${PORT}` });
} else if (mode === 'deploy') {
  run('pnpm --filter @laddorious/client build', { VITE_SERVER: 'same-origin' });
  start('pnpm exec wrangler deploy', SERVER_DIR);
} else {
  console.error('usage: node apps/server/scripts/online.mjs serve|dev|deploy');
  process.exit(1);
}
```

Add to the root `package.json` scripts, after `dev`:

```json
    "serve": "node apps/server/scripts/online.mjs serve",
    "dev:online": "node apps/server/scripts/online.mjs dev",
    "deploy:cloudflare": "node apps/server/scripts/online.mjs deploy",
```

In `eslint.config.js`, add a block (the script runs in Node; ESLint doesn't know its globals):

```js
  {
    // The online scripts run in Node (spec #4 §8).
    files: ['apps/server/scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
```

- [ ] **Step 3: The docs.** Create `apps/server/README.md`:

````markdown
# @laddorious/server

The multiplayer server (Spec #4): one Cloudflare Worker that serves the built game and runs the matches. Design: [spec #4](../../docs/superpowers/specs/2026-10-09-multiplayer-server-design.md).

| File | What it does |
|---|---|
| `wrangler.toml` | The Worker, the game's files (`../client/dist`) and the two Durable Object classes |
| `src/index.ts` | Routes `/lobby` to the one lobby and `/match/:id` to that match. Files are served before it runs. |
| `src/LobbyDO.ts`, `src/MatchDO.ts` | Thin Durable Object wrappers around the classes below |
| `src/socket.ts` | Accepts a WebSocket and runs its frames through the checks |
| `src/lobby.ts` | `LobbyCore`: tables, the 15 s bot offer, bots filling seats, starting a match |
| `src/room.ts` | `MatchRoom`: one match's sockets, tokens, presence, rejoin and end, around `MatchHost` |
| `src/validate.ts` | Message parsing, the size and rate limits, nickname cleaning |

The plain classes (`lobby.ts`, `room.ts`, `validate.ts`) use no Cloudflare API and are tested in Node (`test/`). Only the wrappers would change if the server ever moved to a VPS.

## Play on your Wi-Fi

From the repository root:

```bash
pnpm serve
```

It builds the game for this server, starts it on port 8787 on every network interface, and prints the addresses to open, such as `http://192.168.1.20:8787`. Open one on phones and laptops on the same Wi-Fi. No Cloudflare account is needed: `wrangler dev` runs the Worker on this computer.

- **Firewall:** the first time, Windows may ask to let wrangler's runtime (`workerd`) through the firewall. Allow it on private networks.
- **Same network:** phones must be on the same Wi-Fi as the computer, not on mobile data.
- **Plain connections at home:** they're `ws://` at home; Cloudflare serves `wss://` and HTTPS once deployed.

**Working on online play with hot reload:** `pnpm dev:online` runs the Worker on port 8787 and the Vite dev server (`http://localhost:5173`) pointed at it. It's for this computer only, because phones would look for the server on their own `localhost`.

## Deploying to Cloudflare

You need a free Cloudflare account. The free plan includes Durable Objects of the SQLite kind, which `wrangler.toml` declares.

1. **Log in once:** `pnpm --filter @laddorious/server exec wrangler login`. A browser window asks you to allow wrangler.
2. **Deploy:** `pnpm deploy:cloudflare`. It builds the game with `VITE_SERVER=same-origin` and runs `wrangler deploy`. The first deploy prints the address, such as `https://laddorious.<your-subdomain>.workers.dev`.
3. **Check it from two phones:** open the address on both, on mobile data rather than your Wi-Fi to be sure it works from anywhere. Press PLAY on both: you should see each other at the table.

**A custom domain (optional):** in the Cloudflare dashboard, open **Workers & Pages → laddorious → Settings → Domains & Routes → Add → Custom domain**, and pick a domain on your Cloudflare account.

**Live logs:** `pnpm --filter @laddorious/server exec wrangler tail` streams the Worker's logs and errors while people play.

**Updating:** run `pnpm deploy:cloudflare` again.
- Matches in progress end when their objects restart (spec M9), and their players see the error screen. Deploy when nobody is playing.
- The game and the server share `PROTOCOL_VERSION`, so a game from an older build is asked to reload.

### Hosting the game somewhere else

The Worker can serve just the sockets while Pages or Netlify hosts the game. Build the client with the Worker's address, for example in PowerShell:

```powershell
$env:VITE_SERVER = "wss://laddorious.<your-subdomain>.workers.dev"; pnpm build
```

Then publish `apps/client/dist` as the client README describes. The Worker still deploys with `pnpm deploy:cloudflare`.

## Limits and costs

Measured over 200 simulated 4-player matches (about 21 rounds and 7 minutes each; spec §9):

- **CPU:** 10–30 ms per match.
- **Memory:** about 6 KB of match state.
- **Traffic:** about 136 updates per player, roughly 240 KB per player per match.

On Cloudflare (pricing as of October 2026):

- **Free plan:** 13,000 GB-s of Durable Object time and 100,000 requests a day. A match's object stays awake for the whole match (no hibernation, M8), about 54 GB-s, so roughly **240 matches a day**.
- **Requests:** incoming WebSocket messages bill at 20:1, so a match is about 150–200 billed requests.
- **Workers Paid ($5 a month):** covers about 7,000 matches a month, then roughly $0.70 per 1,000 matches.

If traffic grows, WebSocket hibernation with alarms (out of scope for spec #4) would cut the Durable Object time sharply.

## Tests

- **Unit tests:** `pnpm test` runs `test/validate.test.ts`, `test/lobby.test.ts` and `test/room.test.ts` in Node, with fake sockets and fake timers.
- **End to end:** `pnpm e2e` includes `apps/client/e2e/online.spec.ts`. Playwright starts `wrangler dev` on port 8788 with an online e2e build and `FAST=1`, and two browser contexts play each other.
````

In the root `README.md`:
- **Intro:**
  - add the bullet "**Spec #4:** the multiplayer server. Quick match with real players, bots on request, and rejoining within 60 s, on Cloudflare Workers and Durable Objects ([design](docs/superpowers/specs/2026-10-09-multiplayer-server-design.md)).";
  - change "The multiplayer server (Spec #4) and the art pass (Spec #5) come later." to "The art pass (Spec #5) comes later.".
- **Repository map:**
  - add `packages/host` | `@laddorious/host` | "The match host: one match's engine state, timers and bots for any mix of humans and bots, plus the wire protocol. The offline worker and the server both run it. [README](packages/host/README.md)";
  - add `apps/server` | `@laddorious/server` | "The multiplayer server: a Cloudflare Worker with a lobby and one Durable Object per match. It also serves the built game. [README](apps/server/README.md)";
  - end the `apps/client` row with: "The engine runs in a Web Worker behind the `MatchService` interface, or on the server when `VITE_SERVER` is set."
- **Scripts:** add these lines to the code block after `pnpm build`:

```bash
pnpm serve       # play on your Wi-Fi: the game and server on port 8787 (see apps/server/README.md)
pnpm dev:online  # the dev server against a local multiplayer server
pnpm deploy:cloudflare  # build and deploy to Cloudflare (needs `wrangler login`; see apps/server/README.md)
```

- **How the parts fit together:**
  - add "**`@laddorious/host`** runs one match: it feeds the engine bot moves, timeouts and players' actions, and sends each human only their own view.";
  - change the client bullet to "**The client** runs the host in a Web Worker for offline play, or talks to **the server** (a Cloudflare Worker running the same host) for online play, through the `MatchService` interface.";
  - change the visibility rule's last sentence to "That is why the Spec #4 server could replace the local worker without changing the screens."
- **CI:** add "The e2e run also starts `wrangler dev` for the two-player tests; no Cloudflare account is needed."

In `apps/client/README.md`:
- **Intro:** change the matchmaking bullet to "matchmaking with real players when online, or bots; "Play with bots" appears after 15 s;".
- **Local development:** after its section, add:

```markdown
## Playing online

`VITE_SERVER`, read at build time (spec #4 M11), picks where matches run:

| Value | What happens |
|---|---|
| unset | Offline only: the engine and bots run in a Web Worker. `pnpm dev` and `pnpm build` work this way. |
| `same-origin` | Online, against the Worker that served the page. `pnpm serve` and `pnpm deploy:cloudflare` build this way. |
| `ws://…` or `wss://…` | Online, against that server: for hosting the game on Pages or Netlify while the Worker runs elsewhere. |

Online builds keep the offline bots as a fallback. If the server can't be reached within 5 s, matchmaking offers **Try again** and **Play offline with bots**. A reload during a match rejoins it: the seat is kept in the tab's `sessionStorage`, and the server holds it for 60 s after a drop. See [apps/server/README.md](../server/README.md) for running the server.
```

- **Deploying:** at the top of the section, add: "These steps host the offline game. For online play, deploy the Worker instead, which serves the game too: see [apps/server/README.md](../server/README.md)."
- **Tests:** add a line saying `e2e/online.spec.ts` plays two browser contexts against `wrangler dev` (the `online` Playwright project).

- [ ] **Step 4: Gate and a real run.**
  - Run `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build`. Expected: all green, and `pnpm build` still makes an offline build (no `VITE_SERVER`).
  - Add an `online` entry to `.claude/launch.json` (runtimeExecutable `pnpm`, runtimeArgs `["serve"]`, port 8787), and start it with the preview tool.
  - Expected in the logs: the client build, then the address list, then wrangler's ready line.
  - Then in the browser pane, open `http://localhost:8787` in two tabs:
    1. press PLAY in both: both overlays show two filled seats;
    2. after 15 s, press **Play with bots** in one: both tabs reach the match screen;
    3. close the second tab: the first shows "*Name* lost connection" and the Away badge.

  Take a screenshot of the first tab as proof, then stop the server.

- [ ] **Step 5: Commit.** `git add -A apps package.json eslint.config.js README.md && git commit -m "feat: play online with pnpm serve, and the Cloudflare deploy guide"` (with the trailer).

### Task 13: Two-player end-to-end tests against `wrangler dev`

**Files:**
- Create: `apps/client/e2e/online.spec.ts`
- Modify: `apps/client/playwright.config.ts`

**Interfaces:**
- **Consumes:**
  - the `e2e:serve` script (Task 4);
  - the Worker (Task 7);
  - the online client (Tasks 8–12): the Away badge `.prow-away`, the seat list `.mm-seat`, reload rejoin.
- **Produces:**
  - the Playwright project `online` (Desktop Chrome, `http://127.0.0.1:8788`);
  - a second web server: an online e2e build in `apps/client/dist-online-e2e`, served by `wrangler dev` with `FAST=1`.

- [ ] **Step 1: Write the tests.** Create `apps/client/e2e/online.spec.ts`:

```ts
import { expect, test, type Browser, type Page } from '@playwright/test';

// Two players against the real Worker (spec #4 §10). The server keeps the time, so the 15 s
// bot offer is waited for in real time; FAST=1 makes the match itself take seconds.

/** One player's page in its own browser context (its own storage), on the menu. */
async function player(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  return page;
}

/** Both press PLAY, see each other at the table, and the first fills it with bots. */
async function startTogether(a: Page, b: Page) {
  await a.getByRole('button', { name: 'PLAY' }).click();
  await expect(a.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeVisible();
  await b.getByRole('button', { name: 'PLAY' }).click();
  for (const page of [a, b]) await expect(page.locator('.mm-seat:not(.empty)')).toHaveCount(2);
  await a.getByRole('button', { name: 'Play with bots' }).click({ timeout: 25_000 });
  for (const page of [a, b]) await expect(page.getByRole('button', { name: 'Leave match' })).toBeVisible({ timeout: 20_000 });
}

test('two players find each other, fill the table with bots and play to the end', async ({ browser }) => {
  const a = await player(browser);
  const b = await player(browser);
  await startTogether(a, b);
  for (const page of [a, b]) await expect(page.getByRole('heading', { name: /wins?!$/ })).toBeVisible({ timeout: 150_000 });
});

test('a player who drops shows as away, and a reload brings them back (spec #4 §5.2)', async ({ browser }) => {
  const a = await player(browser);
  const b = await player(browser);
  await startTogether(a, b);
  await b.goto('about:blank'); // the socket closes; the tab keeps its sessionStorage
  await expect(a.locator('.prow-away')).toHaveCount(1);
  await b.goto('/');
  await expect(b.getByRole('button', { name: 'Leave match' })).toBeVisible();
  await expect(b.getByRole('button', { name: 'PLAY' })).toHaveCount(0);
  await expect(a.locator('.prow-away')).toHaveCount(0);
});
```

- [ ] **Step 2: Wire Playwright.** In `apps/client/playwright.config.ts`:
- add under `PORT`:

```ts
/** The online tests' server: wrangler dev with an online e2e build and fast matches (spec #4 §10). */
const ONLINE_PORT = 8788;
```

- add `testIgnore: /online\.spec\.ts/` to the three existing projects, and a fourth project:

```ts
    { name: 'online', testMatch: /online\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${ONLINE_PORT}` } },
```

- make `webServer` a list: the existing entry, then:

```ts
    {
      command: 'pnpm exec vite build --mode e2e --outDir dist-online-e2e && pnpm --filter @laddorious/server e2e:serve',
      url: `http://127.0.0.1:${ONLINE_PORT}`,
      env: { VITE_SERVER: 'same-origin', WRANGLER_SEND_METRICS: 'false' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
```

Update the config's doc comment: "End-to-end tests (spec #2 §9.3) against the e2e build…; the `online` project plays two browser contexts against `wrangler dev` (spec #4 §10)."

- [ ] **Step 3: Run them.**

Run: `pnpm e2e`
Expected: 11 passed:
- the 9 offline tests (3 tests × 3 projects);
- 2 `online` tests.

The online tests take about 40–90 s each (the real 15 s wait, then a fast match).

If the first online test fails on "Play with bots", check that the overlay shows the button once the *server's* `elapsedMs` passes 15 s. If it fails with "Leave match" never visible for `b`, read `b`'s console with the trace (`apps/client/test-results`).

- [ ] **Step 4: Commit.** `git add apps/client && git commit -m "test(e2e): two players online against wrangler dev"` (with the trailer).

### Task 14: Docs, gate and handoff

**Files:**
- Modify: `docs/superpowers/HANDOFF.md` (a Spec #4 row with commits and suite counts; next step, Spec #5 Blender art; deferred minors; the user's Wi-Fi check and deploy as their own steps)

- [ ] **Step 1: Write the handoff** as listed above. Include:
  - how to play on the Wi-Fi (`pnpm serve`);
  - that deploying is the user's step, following `apps/server/README.md`.

- [ ] **Step 2: Gate.**
  - Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and `pnpm e2e`. Expected: all green, e2e 11 passed.
  - Bundle check: `pnpm --filter @laddorious/server exec wrangler deploy --dry-run --outdir .wrangler/dry-run`. Expected: `--dry-run: exiting now.`
- [ ] **Step 3: Commit.** `git commit -am "docs: hand off after spec #4 (multiplayer server)"` (with the trailer).

After Task 14:
1. Self-review the whole branch against this plan's Review Focus, and say it was a self-review (no subagents).
2. Fast-forward merge `server/spec-4` into `main` locally and run the suite on `main`.
3. Delete the branch, and update memory (`handoff`, `hosting-cloudflare`, `multiplayer-lan-testing`).
4. Tell the user how to try it on their Wi-Fi (`pnpm serve`, then the printed address on phones). Never deploy.
