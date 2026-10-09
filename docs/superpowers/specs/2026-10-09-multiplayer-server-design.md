# Multiplayer server (Spec #4) — design

**Status:** approved in conversation 2026-10-09; this file awaits the user's review.
**Comes after:** Spec #3 (sound design). **Comes before:** Spec #5 (Blender art). Spec #2's open items for "the server" (written when it was Spec #3) are answered here.
**Hosting:** Cloudflare. The game and the server are deployed together as one Cloudflare Worker with Durable Objects (memory `hosting-cloudflare`). They are tested first on the user's own Wi-Fi with `wrangler dev` (memory `multiplayer-lan-testing`).

---

## 1. What this delivers

Real people play each other online:

- Quick match: press PLAY and you're seated with whoever else is waiting. Bots fill empty seats on request, as today.
- The rules engine runs only on the server.
- Every screen works as it does offline.
- Players who drop out can come back within 60 seconds.

Success means:

- **Wi-Fi play works:** the user and a few people at home can play a full match together, from phones and laptops on their Wi-Fi, against a server on the user's computer started with one command;
- **online play works:** the same build, deployed to Cloudflare, works from anywhere;
- **no cheating by editing the page:** nobody can act for another seat or see another player's hand or picks;
- **one slow phone can't stall the table** for more than 12 s at a time;
- **offline bot matches still work** when there's no server.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| M1 | **Quick match only.** No private rooms or codes. | User's choice. It fits the existing screens with no new UI. Rooms can come later. |
| M2 | **A player who drops is "away".** No bot plays for them; their seat runs on the engine's timeout rules. They can rejoin within 60 s; after that the seat stays away until the match ends. | User's choice ("while they're AFK, they won't be played by bots"). |
| M3 | **Away seats keep moving by timeouts:** dice auto-roll, a missed face-off pick loses, a random card is taken. Windows close as soon as every connected player has acted, so nobody waits for an away seat. | User's choice. No engine change. An away piece can still finish, and even win. |
| M4 | **Cloudflare Workers + Durable Objects**, not a Node server or a VPS. | User's choice: Cloudflare costs nothing to start (about 240 matches a day on the free plan) and needs no server administration. The engine, bots and match host are browser-safe TypeScript (lint-enforced), which Workers run unchanged. |
| M5 | **One Worker serves the built game** (Workers static assets) **and the WebSocket endpoints**, on one address. | One deploy, one origin, no cross-origin setup. Pages or Netlify can still host the game separately, pointed at the Worker. |
| M6 | **The match and lobby logic live in plain classes** (`MatchRoom`, `LobbyCore`), with thin Durable Object wrappers. | They're tested in Node with fake connections, and only the wrappers would change if the server ever moves to a VPS. |
| M7 | **The match host moves to a shared package** (`packages/host`). The offline browser worker and the server both use it. | One copy of the timers, the playback waiting and the bots, for offline and online. |
| M8 | **The first version uses standard WebSockets** (each match's Durable Object stays awake for the whole match). Hibernation with alarms comes later if traffic grows. | Simpler and enough for the free plan; the cost difference only shows at scale. |
| M9 | **No persistence.** A match lives in its Durable Object's memory; if the object restarts, the match is lost and players see the error screen. | Matches are short; saving state adds storage and cost for a rare case. |
| M10 | **Seat colours follow seat order** (pink, blue, lime, purple) on every screen. Your own tag and row keep the mint outline. Names and pieces may repeat. | Everyone at the table must see the same colour for the same piece. The colours stay client theme tokens: the online service colours seats by seat index, not the server. |
| M11 | **Which server the game talks to is a build setting**, `VITE_SERVER`: `same-origin` (served by the Worker), a `wss://` address (game hosted elsewhere), or unset (offline bots only). | Explicit and easy to test, with no guessing at run time. |

## 3. Architecture

### 3.1 `packages/host` (new, shared)

The match host, moved out of `apps/client/src/worker/localHost.ts` and generalised for several humans. It's plain TypeScript and runs in a Web Worker, a Durable Object and Node.

- **`MatchHost`:**
  - `new MatchHost({ send(to: PlayerId, msg: FromHost): void; fast?: boolean; playbackCapMs?: number })`;
  - `create(seats, seed, rngSeed)`;
  - `action(player, action, windowId)`;
  - `playbackDone(player, windowId)`;
  - `setAway(player, away)`;
  - `resync(player)`: sends that player's current view as an update with no events;
  - `pause()` / `resume()`;
  - `stop()`.
- **Updates:** each human gets their own (`viewFor` / `eventsFor` for their seat only).
- **Playback:** a new window's countdown starts once every *connected* human has sent `playbackDone` for it, or after `playbackCapMs` (12 s), whichever comes first.
- **Bots** play the bot seats. Humans are never played by bots, except in fast mode (e2e), where bots play every seat as they do offline today.
- **Away seats:** after every step, if every player the window still waits for is an away human, the host applies the timeout at once (M3). It also never waits for an away human's playback.
- **Shared types:** `SeatInfo`, `PlayerAction`, `MatchUpdate`, `PieceId`, `Profile`, the message types (§6), `PROTOCOL_VERSION`, and seat building (`buildSeats(humans, botNames)`; colours are left to the client, M10). The client's `service/matchService.ts` re-exports them, so client imports don't change.
- **`PausableTimers`** moves here. `LocalHost` becomes a small adapter that turns the worker's `ToHost` messages into `MatchHost` calls for its one human, so offline play is unchanged.

### 3.2 `apps/server` (new): a Cloudflare Worker

| File | What it does |
|---|---|
| `wrangler.toml` | The Worker; static assets from `../client/dist`; Durable Object bindings `LOBBY` and `MATCH`; a migration declaring both as SQLite classes (required on the free plan; no storage is actually used); the `FAST` var for e2e. |
| `src/index.ts` | Routes `GET /lobby` (WebSocket upgrade) to the single `Lobby` object (`idFromName('global')`), and `GET /match/:id` (WebSocket upgrade) to that `Match` object. Everything else goes to the static assets. |
| `src/LobbyDO.ts`, `src/MatchDO.ts` | Thin Durable Object wrappers. They accept WebSockets (standard API, M8), parse and check messages (§6, §7), and pass them to the plain classes below. They own the real timers (`setTimeout`). |
| `src/lobby.ts` (`LobbyCore`) | Tables, seating, the 15 s offer, filling with bots, creating a match (through an injected `startMatch(seats) → { matchId, tokens }`), and sending `found`. |
| `src/room.ts` (`MatchRoom`) | One match: a `MatchHost`, the seats' connections and rejoin tokens, presence, the 60 s rejoin windows, and ending the match when everyone is gone. |
| `src/validate.ts` | Message parsing and checks (§6, §7). |

### 3.3 Client changes (`apps/client`)

- **`service/onlineMatchService.ts`:** `OnlineMatchService implements MatchService`, over two WebSockets: one to `/lobby` while matchmaking, then one to `/match/:id` during the match.
  - It colours the seats from the theme by seat order (M10).
  - It keeps the clock difference with the server from pings (§5.3).
  - It reconnects with backoff (0.5, 1, 2, 4, 8 s, then every 8 s) for up to 60 s.
  - It stores `{ matchId, token }` in `sessionStorage` for rejoining.
- **`MatchSession` gains `onPresence(cb: (away: PlayerId[]) => void): () => void`.** The local session never reports anyone away.
- **`main.tsx`** picks the service from `VITE_SERVER` (M11): online when set, offline otherwise.
- **Reload rejoin:** on startup, if a rejoin token is saved and the online service is on, the app tries to rejoin before showing the menu.
- **Player column:** an **Away** badge on away players' rows.
- **Toasts:**
  - "*Name* lost connection" and "*Name* is back";
  - for me, "Reconnecting…" while the connection is down, then "Back in the match";
  - after 60 s, "The match carried on without you", and back to the menu.
- **Matchmaking overlay:** if the lobby can't be reached within 5 s, it shows "Can't reach the game server" with **Try again** and **Play offline with bots** (the local service).

## 4. Matchmaking (the lobby)

1. **PLAY** opens `/lobby`. The game sends `hello` (version and profile), then `find`.
2. **Seating:** the lobby seats the player at the oldest table still forming (fewer than 4 humans, not filling), or opens a new table. Seat 0 is the first player to join, and so on, in join order.
3. **Seat updates:** every table member gets `matchmaking` updates whenever the seats change, and a tick every second carrying their own elapsed time. Each player's view lists the table's seats with **their own seat first** (the overlay's "index 0 = you"), and real players appear as they join.
4. **Four humans** are seated: the table fills at once (no bots) and goes to step 6.
5. **"Play with bots":** a player can press it once *they* have waited 15 s (each player's own elapsed time). The first press fills the table for everyone: bots take the empty seats one by one (420 ms apart, as today), with `filling` updates.
6. **Starting:** the lobby asks a new `Match` object to start with the final seats, a random seed and a random rng seed. It gets back the match id and one rejoin token per human, and sends each human `found { matchId, me, seats, token }`. Clients close the lobby socket, show MATCH FOUND and 3-2-1, and open `/match/:id`.
7. **Leaving the queue:**
   - **Cancel** before filling frees your seat; the others' seats shift up in join order.
   - **A dropped lobby connection** counts as cancel.
   - **Cancel after filling** has started is ignored.

## 5. A match (the room)

### 5.1 Connecting and playing

- A human's first message on `/match/:id` must be `join { token }` with their token. Anything else, or a wrong token, closes the connection.
- After `join`, the room sends `welcome { me, seats, serverTime }` and a resync (the current view).
- A human who hasn't joined within 15 s of the match starting counts as away (§5.2).
- `action` and `playbackDone` go to the `MatchHost` for the joined seat. The server always stamps the seat; messages never name a player.
- Engine rejections go back as `rejected` to that player only.
- Countdown timing follows §3.1: every connected human's playback, capped at 12 s.

### 5.2 Away, rejoin and leaving

- **Away:** a socket closes, or the room hears nothing from it (not even a `ping`) for 10 s. The seat is marked away, and everyone gets `presence { away }`. The host closes windows early for away seats (M3), and a 60 s rejoin timer starts for that seat.
- **Rejoin:** within 60 s, a new socket with `join { token }` reattaches the seat. The host resyncs that player, everyone gets the new `presence`, and the rejoin timer stops.
- **After 60 s:** the token is cancelled. A later `join` gets `failed { reason: 'seat-lost' }` ("The match carried on without you"), and the seat stays away for the rest of the match.
- **Leave match:** sends `leave`. The seat is away for good at once, and its token is cancelled.
- **End:**
  - after the win, the room keeps sockets open 10 s so end screens can settle, then closes them and frees the object;
  - when no human is connected, the room pauses its timers; if nobody returns within 60 s, it ends the match and frees the object.

### 5.3 Time

- Timers run on the server's clock, and `update.timer.endsAt` is server time.
- Every 5 s the game sends `ping { t }`, and the server answers `pong { t, serverTime }`. The game keeps `offset = serverTime − (t + now) / 2` (the median of the last 5) and converts `endsAt` to its own clock before the screens see it. A phone with a wrong clock still shows the right countdown.

## 6. Messages

JSON text frames, one object per message with a `type`.

**Game → server**

| Socket | Message |
|---|---|
| lobby | `hello { version, profile }` (first), `find`, `cancel`, `playWithBots`, `ping { t }` |
| match | `join { token }` (first), `action { action, windowId }`, `playbackDone { windowId }`, `leave`, `ping { t }` |

**Server → game**

| Socket | Message |
|---|---|
| lobby | `matchmaking { state: 'searching' \| 'filling', seats, elapsedMs }`, `found { matchId, me, seats, token }`, `pong { t, serverTime }`, `failed { reason, message }` |
| match | `welcome { me, seats, serverTime }`, `update { update }`, `rejected { error }`, `presence { away }`, `pong { t, serverTime }`, `failed { reason, message }` |

`failed.reason` is one of `version`, `bad-token`, `seat-lost`, `server-error`. A `version` failure shows "Please reload, the game was updated". `PROTOCOL_VERSION` starts at 1, and the game and the server are built from the same commit.

## 7. Safety

- **Your own seat only:** actions carry no player id; the room uses the seat bound to the socket by its token.
- **The engine checks every action,** as offline: wrong phase, stale window, rerolls you don't have.
- **You only receive your own view:** `viewFor(state, you)` and `eventsFor(events, you)`. Other players' hands, picks, card targets and the rng seed never leave the server.
- **Message checks (`validate.ts`):**
  - a message is text JSON of at most 8 KB, a known `type`, with fields of the right types and ranges;
  - an unknown type is ignored, and malformed JSON closes the socket;
  - more than 30 messages a second closes the socket.
- **Names and pieces:** the server re-checks the profile (nickname trimmed to 1–16 characters, otherwise "Guest"; the piece must be one of the four).
- **Tokens:** 128 random bits, one per human per match. They're held only in that tab's `sessionStorage`, and expire after the 60 s rejoin window, on leave, or at the end of the match. Match ids are Durable Object unique ids, not guessable.
- **Not in this spec:** accounts, abuse beyond the rate limit (Cloudflare's own protection applies when deployed), and encryption on the home Wi-Fi (`ws://`; Cloudflare serves `wss://` and HTTPS when deployed).

## 8. Running and deploying

- **`pnpm serve`** builds the game with `VITE_SERVER=same-origin` and runs `wrangler dev --ip 0.0.0.0 --port 8787` in `apps/server`. It prints `http://<this computer's address>:8787`. No Cloudflare account is needed.
- **`pnpm dev`** runs the game alone with offline bots, unchanged.
- **`pnpm dev:online`** runs `wrangler dev` and the Vite dev server with `VITE_SERVER=ws://localhost:8787`.
- **`pnpm deploy`** (the guide only; Claude doesn't run it): builds with `same-origin` and runs `wrangler deploy`. The guide in `apps/server/README.md` covers:
  - `wrangler login` and the free plan;
  - deploying, and an optional custom domain;
  - `wrangler tail` for live logs;
  - the limits and costs (§9);
  - hosting the game on Pages or Netlify instead, with `VITE_SERVER=wss://<worker>`;
  - checking the deployed site from two phones.
- **The root README:** gains the server and the new scripts.
- **The client README:** gains the `VITE_SERVER` setting.

## 9. Costs and limits (measured)

From 200 simulated 4-player matches (about 21 rounds, roughly 7 minutes each):
- **CPU:** about 10–30 ms per match.
- **State:** about 6 KB.
- **Traffic per player:** about 136 updates, roughly 240 KB per match (0.6 KB/s).

On Cloudflare (pricing as of 2026-10-09):
- **Free plan:** 13,000 GB-s of Durable Object time and 100,000 requests a day. A match's object awake for 7 minutes uses about 54 GB-s, so about **240 matches a day** (M8).
- **Requests:** incoming WebSocket messages bill at 20:1, so a match is roughly 150–200 billed requests.
- **Paid plan:** $5/month covers about 7,000 matches a month, then roughly $0.70 per 1,000 matches. Hibernation would cut that sharply.

## 10. Testing

- **`packages/host`:**
  - a single human (the offline worker's tests move here unchanged);
  - two or three humans: per-player views, and the countdown waiting for every connected human's playback or 12 s;
  - away seats closing windows early with timeout results;
  - resync;
  - fast mode.
- **`apps/server` (Node, with fake sockets and fake timers):**
  - **`LobbyCore`:** joining the oldest table, the seat order per viewer, four humans starting at once, the per-player 15 s offer, the first press filling, cancel before and after filling, a dropped lobby socket, `found` with tokens.
  - **`MatchRoom`:** join with a good or bad token, actions stamped to the joined seat, presence on drop, the 10 s silence timeout, rejoin within 60 s, seat lost after 60 s, leave, the end-of-match close, pausing when nobody is connected, freeing after 60 s.
  - **`validate`:** size, malformed JSON, unknown types, field ranges, the rate limit.
- **Client:**
  - `OnlineMatchService` against a fake WebSocket: the lobby flow into a session, backoff reconnect, rejoin with the saved token, clock-offset conversion, presence, `seat-lost` and `version` failures, the unreachable-server fallback;
  - the Away badge;
  - the reload-rejoin path.
- **End to end** (Playwright, against `wrangler dev` serving an e2e build with `FAST` on):
  - two browser contexts press PLAY, see each other while finding players, one fills with bots, and both reach the end screen;
  - one context closes mid-match, the other shows the Away badge, and reopening the page in the same context within 60 s rejoins.
  - The existing offline tests stay.
- **CI:** the e2e job also starts `wrangler dev` (no Cloudflare account needed).

## 11. Out of scope

- Private rooms and codes, friends lists, accounts and persistent profiles.
- Durable Object hibernation and alarms (M8), and saving matches across restarts (M9).
- Spectating, chat and emotes.
- Region pinning and running more than one lobby.
- Actually deploying to Cloudflare: the user does that with the guide.
