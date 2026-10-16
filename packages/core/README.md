# @laddorious/core

The Laddorious rules engine: a pure, deterministic state machine for a 2–4 player match, plus the seeded board generator.

## What it exports

**Matches**

| Export | What it does |
|---|---|
| `createMatch(config, seats)` | A new match state from a config (`seed`, optional `rngSeed`, windows, board and card options) and 2–4 seats |
| `step(state, input)` | Applies one input (`roll`, `challengePick`, `reroll`, `pickCard` or `timeout`). Returns `{ ok: true, state, events }` or `{ ok: false, error }`. It never mutates `state` |
| `awaiting(state)` | Which window is open (`dice`, `challenge`, `mystery` or `none`), its id, who must act and how long it lasts |
| `viewFor(state, player)` | What one player may see: public state plus only their own hand and picks |
| `eventsFor(events, player)` | The events one player may see |
| `hashState(state)` | A stable hash, for replays and golden tests |
| `validateInput`, `advance` | Lower-level pieces of `step` |

**Configuration**

| Export | What it does |
|---|---|
| `resolveConfig(input)`, `validateConfig` | The full config with defaults, checked |
| `DEFAULT_WINDOWS` | The default windows: dice 12 s, challenge 8 s, Mystery 30 s |

**Boards**

| Export | What it does |
|---|---|
| `generateBoard`, `DEFAULT_BOARD_CONFIG` | A seeded 100-tile board with snakes, ladders and "?" squares, rejected and retried until it passes the hard invariants and the Markov analysis |
| `analyzeBoard`, `landingTile` | Expected match length and fairness of a board |
| `renderBoardAscii` | A text picture of a board, used by the sim CLI |
| `tileCell`, `laneCenterline`, `laneGap`, `LANE_CLEARANCE` | The 10×10 layout and the curve a slide's lane follows. The generator keeps lanes apart with them, and the client draws lanes along them |

**Cards**

| Export | What it does |
|---|---|
| `STARTER_CARDS`, `cardById`, `drawCard` | The card set and lookups. `drawCard` takes a list of cards to leave out, which keeps a hand free of duplicates |
| `targetCandidates`, `selectTarget`, `isValidTarget` | The targeting rules, also used by the client's fizzle warnings |

**RNG**

| Export | What it does |
|---|---|
| `createStream`, `rollDie`, `pickWeighted`, … | Seeded sfc32 streams |

**Types and errors:** `MatchState`, `PlayerView`, `GameEvent`, `Input`, `Awaiting`, `PlayerId`, `ActiveEffect`, `Jump`, `Board`, and more. `ConfigError` covers a bad config; `InvariantError` means an engine bug, never bad input.

## Rules this package keeps

- **Deterministic:** the same config, seats and inputs give the same match, every time. All randomness comes from seeded RNG streams stored in the state.
- **No clock:** the host owns time and sends `timeout` inputs. ESLint bans `Date`, `performance` and `Math.random` in `src/`.
- **Plain JSON state:** a match can be saved and resumed, or sent over the network, as JSON.
- **Pure:** `step` never mutates its input. Invalid input returns an error with a code (`STALE_INPUT`, `NOT_AWAITED`, `REROLL_LIMIT`, …), and only bugs throw.
- **Browser-safe:** no Node built-ins, no runtime dependencies. `package.json` exports `./src/index.ts` directly; Vite, Vitest and tsx compile it.

## Tests

`pnpm test` from the root runs:

- rule tests;
- property tests (fast-check);
- golden matches (`test/golden.test.ts`), whose snapshot diffs show any change in behaviour. Update them only for intended changes: `pnpm vitest run packages/core/test/golden.test.ts -u`.
