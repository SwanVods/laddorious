# @laddorious/bots

Bots that play Laddorious from a player's view. The simulator (`apps/sim`) and the client's Web Worker host use them, and so does the multiplayer server.

## What it exports

| Export | What it does |
|---|---|
| `interface Bot` | `decide(view: PlayerView): Input \| 'idle'`: the input this seat sends now, or `'idle'` to wait |
| `RandomBot` | Uniformly random legal actions. With `afkPercent`, it sits out whole windows that often, to test timeouts |
| `HeuristicBot` | Rolls at once, makes a seeded random face-off pick, rerolls its weakest Mystery card when it scores low, and picks the best-scoring card |
| `scoreCard(card, view)` | The heuristic's card score for the current board |
| `makeBots(seats, policy, seed, afkPercent)` | One bot per seat (`'random'` or `'heuristic'`), each with its own seeded stream, so a batch of matches is reproducible |
| `type PolicyName` | `'random' \| 'heuristic'` |

## Rules this package keeps

- **Bots see only `viewFor(state, seat)`,** like a real player. They never read other players' hands or the RNG seed.
- **Deterministic:** each bot's randomness comes from a stream seeded with the batch seed and its seat id.
- **Browser-safe:** no Node built-ins (ESLint enforces it), so the client can run bots in a Web Worker.

## Tests

`pnpm test` from the root covers the bots' choices, AFK idling and reproducible seating. The simulator's tests (`apps/sim/test`) play whole bot-only matches.
