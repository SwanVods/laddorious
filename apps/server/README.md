# @laddorious/server

The multiplayer server: one Cloudflare Worker that serves the built game and runs the matches.

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

If traffic grows, WebSocket hibernation with alarms would cut the Durable Object time sharply.

## Tests

- **Unit tests:** `pnpm test` runs `test/validate.test.ts`, `test/lobby.test.ts` and `test/room.test.ts` in Node, with fake sockets and fake timers.
- **End to end:** `pnpm e2e` includes `apps/client/e2e/online.spec.ts`. Playwright starts `wrangler dev` on port 8788 with an online e2e build and `FAST=1`, and two browser contexts play each other.
