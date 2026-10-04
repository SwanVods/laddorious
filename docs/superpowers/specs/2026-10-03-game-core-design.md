# Laddorious — Spec #1: Game Core, Board Generator & Simulator

- **Date:** 2026-10-03
- **Status:** Draft — awaiting review
- **Scope:** Sub-project 1 of 6 (see §1.2)
- **Amended:** 2026-10-04 — bonus roll removed ([amendment](2026-10-04-remove-bonus-roll-design.md))

---

## 1. Context

### 1.1 Product

Laddorious is an online multiplayer Snake & Ladders party game. It keeps the classic core (move forward, snakes go down, ladders go up, land exactly on the final tile) and adds simultaneous rounds, collisions, Mystery cards and procedurally generated, seeded boards.

- 2–4 players per match.
- 100-tile board (board size is a parameter; only 100 is tuned and supported in this spec).
- Target match length: 7–12 minutes.
- Purpose: **learning / portfolio project.** Architecture, determinism and test quality are part of the deliverable, not just the game.

### 1.2 Sub-project roadmap

| # | Sub-project | Spec |
|---|---|---|
| a | Game core — rules engine, round state machine, card/effect framework | **this spec** |
| b | Board generator + headless simulator | **this spec** |
| c | Card catalogue — the full card content | later |
| d | Multiplayer server — rooms, timers, hidden hands, authority | later |
| e | Client — board rendering, animation, input | later |
| f | Match lifecycle — lobby, start/end screens, disconnect/reconnect | later |

### 1.3 Goals of this spec

1. A pure, deterministic TypeScript rules engine that implements every rule in §4–§5.
2. A seeded board generator with structural and analytic validation (§7).
3. A headless simulator that plays bot matches and reports match-length, fairness and card metrics (§8).
4. A starter card set that exercises every framework feature (§6).

### 1.4 Non-goals

Server, networking, client, rendering, animation, lobby, accounts, reconnection, the full card catalogue, and tuning for 200/300-tile boards.

---

## 2. Decision log

Decisions made during design, recorded so later specs do not re-litigate them.

| # | Topic | Decision |
|---|---|---|
| D1 | Player count | 2–4 (reduced from 2–6). |
| D2 | Collision, 3+ players | **Minority knockout.** Majority side loses. All-same or even split → replay. With ≤4 players the only winning split is "exactly one differs". |
| D3 | Knockback landing | **Full chain reaction.** Loser moves back 3; snakes/ladders apply; landing on an occupied tile starts a new challenge. Safety cap in §4.6. |
| D4 | Card-induced movement | **Same rules as dice.** Snakes, ladders, bounce and collision chains all apply. Exactly landing on the final tile counts. Exception: a Mystery tile reached by card movement gives no encounter. |
| D5 | Simultaneous finishers | **Final-tile showdown.** The final tile is a normal tile for collisions. At most one player can be on it at round end, so the "lowest dice total" tiebreaker is removed. |
| D6 | Start tile | Players start on off-board **tile 0**, a safe zone: unlimited occupancy, no collisions. Any backward movement floors at 0. |
| D7 | Challenge timeouts | **Timeout = auto-lose.** All time out → random winner. Ties replay, max 3 replays, then random winner. |
| D8 | Board size | **100 tiles only** in this spec. Size remains a parameter. |
| D9 | Board edits trigger | **Only on landing.** A snake/ladder created or moved under a standing player does nothing until someone lands there. |
| D10 | Dice modifiers | **Two stages.** FACE effects modify single dice as they are rolled; TOTAL effects apply once to the sum in fixed order Replace → Multiply → Add. Dice movement floors at 0. |
| D11 | Simultaneous card conflicts | **Snapshot + clash.** Same-group cards target from one snapshot; relative moves add; conflicting absolute placements both fizzle ("Clash"). |
| D12 | Board swinginess | **Tamed classic.** Lengths 4–30; final stretch ≤1 short snake; no run of 6 snake heads. |
| D13 | Bonus roll | **None** (amended 2026-10-04). Every player rolls one die per round. Extra rolls come only from cards (sub-project c). |
| D14 | Stack | **TypeScript** monorepo. |
| D15 | Determinism scope | **Full match**, not just board: (config, seed, input log) reproduces an entire match. |
| D16 | Generated-board chains | Generated boards contain **no chains** (no jump ends on another jump's start). Card edits may create chains. |
| D17 | Modifier stacking | Add values sum. Multiply values multiply together. Multiple Replace → newest wins. |
| D18 | Disconnects | Deferred to server spec. Until then an absent player simply times out on everything. |
| D19 | Match end | First victory ends the match; other players ranked by position. |
| D20 | Encounter qualification | A player only gets a Mystery encounter if their position changed during this round's dice movement/settle. Standing still (0 total) on a Mystery tile does not re-trigger it. |
| D21 | Card reveal timing | Selections are revealed together once every qualifying player has picked, so no one sees another's pick before choosing. |

---

## 3. Architecture

### 3.1 Repository layout

pnpm workspace, TypeScript (strict), Vitest, fast-check, current Node LTS.

```
laddorious/
  packages/
    core/                 # pure rules engine — zero runtime dependencies
      src/
        rng/              # sfc32 PRNG, seed hashing, stream derivation
        board/            # board model, invariants, generator, Markov analysis, ASCII render
        engine/           # match state, phases, step(), settle loop, challenges, victory
        cards/            # card schema, effect ops, targeting, resolution, starter set
        view/             # viewFor() — per-player filtered state + events
        index.ts          # public API
    sim/                  # bots, runner, CLI, metrics — depends on core's public API only
  docs/superpowers/specs/
```

Future `server/` and `client/` packages will consume `core` the same way `sim` does.

### 3.2 Public API

```ts
createMatch(config: MatchConfig, players: PlayerSeat[]): MatchState
step(state: MatchState, input: Input): StepResult
awaiting(state: MatchState): Awaiting
viewFor(state: MatchState, playerId: PlayerId): PlayerView
generateBoard(seed: string, cfg: BoardConfig): { board: Board; report: GenerationReport }
analyzeBoard(board: Board, cfg: AnalysisConfig): BoardAnalysis
assertInvariants(state: MatchState): void
hashState(state: MatchState): string

type StepResult =
  | { ok: true; state: MatchState; events: GameEvent[] }
  | { ok: false; error: { code: InputErrorCode; message: string } }
```

`MatchState` is plain, JSON-serializable data. `step` never mutates its input.

### 3.3 Inputs

| Input | Sent by | Meaning |
|---|---|---|
| `roll { player }` | player | Roll your one die for this round |
| `challengePick { player, challengeId, choice }` | player | RPS (`rock`/`paper`/`scissors`) or Minority (`A`/`B`) |
| `reroll { player, slot }` | player | Reroll one Mystery slot |
| `pickCard { player, slot }` | player | Select final Mystery card |
| `timeout { windowId }` | host | The current action window expired |

### 3.4 The core owns no clock

`awaiting(state)` returns `{ windowId, window, players, durationMs }` where `window ∈ dice | challenge | mystery | none`. `windowId` increments every time a new window opens. The host (simulator now, server later) runs the timer and sends `timeout { windowId }` on expiry; a timeout with a stale `windowId` is rejected (`STALE_TIMEOUT`). Timeout rules are applied inside the core.

### 3.5 Randomness and determinism

- PRNG: **sfc32**, 32-bit integer arithmetic only. Seeds are strings hashed with cyrb128.
- Streams are derived from the master seed by label and stored in state as plain data:
  - `board` — derived from `(seed, generatorVersion)` only, so **same seed → same board** regardless of players.
  - `dice:<seat>` — one per seat; a player's rolls never depend on other players' timing.
  - `cards:<seat>` — one per seat; offers, rerolls, and timeout card picks.
  - `misc` — random challenge winners, target tie-breaks, gamble outcomes, Minority theme choice.
- All probabilities are integer weights (e.g. 40/60), never floats.
- `Math.random`, `Date`, and `performance` are banned in `core` via ESLint `no-restricted-globals`/`no-restricted-properties`.
- A test-only `scripted` stream kind (`{ kind: 'scripted', values, index }`) lets tests dictate exact dice/draws.
- **Replay:** `(MatchConfig, seats, Input[])` → identical states and events. `hashState` uses stable key-ordered serialization.

### 3.6 Visibility

Every event carries `visibility: 'public' | { private: PlayerId }`. `viewFor(state, playerId)` returns the public state plus only that player's private data (their Mystery hand, rerolls, their own pending challenge pick). Locked card targets are visible to **no one** until resolution. Bots in the simulator only ever receive `viewFor` output.

---

## 4. Game rules (canonical)

### 4.1 Match setup

- 2–4 seats. All players start on **tile 0** (off-board safe zone).
- Board: `generateBoard(config.seed, config.board)`; or a supplied board.
- Round 1 starts immediately in the dice phase.

### 4.2 Round lifecycle

```
dice → settle(dice movers) → mysterySelect → mysteryResolve (groups, each followed by settle) → roundEnd → dice | finished
```

`mysterySelect`/`mysteryResolve` are skipped if no player qualifies for an encounter.

### 4.3 Dice phase (window: `dice`, default 12 s) — amended 2026-10-04

1. Every player rolls one die, independently and simultaneously.
2. FACE-stage effects (§5.6) apply to the die as it is rolled.
3. On `dice` window expiry, players who have not rolled are auto-rolled once. The phase then ends; there is no grace window.
4. Total = the die face, then TOTAL-stage effects in order **Replace → Multiply → Add**, then floored at 0. "Next roll" effects are consumed here.
5. The phase ends when every player has rolled.

### 4.4 Movement

- All players move simultaneously by their totals.
- Bounce: if `p + t > N`, the destination is `N − (p + t − N)`; floored at 0.
- Players whose position changed are the **movers** for the settle loop.

### 4.5 Settle loop

Run after dice movement and after every Mystery resolution group:

1. **Jumps.** Each mover follows the snake/ladder chain from their tile. `beforeSnake` effects may cancel a snake (consuming a charge). `afterMove` conditionals (e.g. "if you land on a snake head") are evaluated here; any movement they cause makes the player a mover again.
2. **Collisions.** Every tile in `1..N` occupied by 2+ players becomes a challenge (§4.7). All challenges detected together form a **wave** and share the `challenge` window (default 8 s).
3. **Knockback.** Each loser moves back 3 (floored at 0) and becomes a mover. Winners stay.
4. Repeat from 1 until no tile in `1..N` is shared.

### 4.6 Settle safety cap

After **3 waves** within a single settle, any further shared tile is resolved without a challenge: each player who arrived on it in the current step steps back one tile at a time to the nearest free tile (tile 0 is always free), triggering nothing. If every occupant arrived in the current step, `misc` picks one to stay and the rest step back. Players stepping back are processed in seat order. This guarantees termination; the simulator reports how often it fires.

### 4.7 Challenges

- **2 players → RPS.** Standard rules. Same pick → replay.
- **3–4 players → Minority.** Each secretly picks `A` or `B` (a cosmetic theme such as Sun/Moon is drawn from `misc`). If exactly one player differs, they win and all others lose. All-same or 2–2 → replay. (General rule — majority side loses; minority of 2+ continues — is implemented, but with ≤4 players it only arises via timeouts.)
- **Timeouts (D7).** Players who did not pick lose immediately. Among the remaining pickers: 1 → wins; 2 → continue as RPS; 3 → continue as Minority; 0 (everyone timed out) → `misc` picks one winner among the original participants.
- **Replay cap.** A challenge has at most 4 picking rounds (the initial one plus 3 replays/continuations). If it is still unresolved after the 4th, `misc` picks the winner among the still-contesting players.
- Each picking round opens a fresh `challenge` window.
- Picks are private until the challenge (or replay) resolves; `ChallengeResolved` reveals all picks.

### 4.8 Mystery detection

After the dice-phase settle completes, a player qualifies for an encounter if they are on a Mystery tile **and their position changed at some point during this round's dice movement or settle**. A player who did not move this round (only possible with a 0 total) does not re-trigger the tile they were already standing on. Mystery tiles exist only in `1..N−1`. Because the settle loop leaves every tile in `1..N` with at most one player, each Mystery tile has at most one participant.

Movement during `mysteryResolve` (cards, knockbacks from card-caused collisions) never grants an encounter (D4).

### 4.9 Mystery selection (window: `mystery`, default 15 s)

Simultaneous for all qualifying players; detailed in §5.2.

### 4.10 Mystery resolution

Detailed in §5.4.

### 4.11 Round end

1. Lifetimes tick: effects and board edits with `rounds` lifetimes decrement; expired ones are removed (`EffectExpired`, `BoardEditExpired`). Expired temporary board edits restore what they replaced.
2. **Victory check.** If a player is on tile N, they win (at most one can be — D5). `MatchWon` lists the winner and ranks all others by position descending; equal positions (only possible on tile 0) share a rank.
3. Otherwise the next round begins.

---

## 5. Card & effect framework

### 5.1 Card definition

Cards are typed data interpreted by the engine — no per-card code.

```ts
type CardType = 'movement' | 'defense' | 'attack' | 'risky' | 'misc';
type Rarity = 'common' | 'rare' | 'epic';

interface CardDef {
  id: string;
  name: string;
  text: string;          // player-facing rules text, including the targeting condition
  type: CardType;
  rarity: Rarity;
  weight: number;        // draw weight within its (type, rarity) bucket
  target: TargetRule;
  effects: EffectOp[];   // applied in order to the single target
}

interface TargetRule {
  condition: 'self' | 'other' | 'ahead-of-caster' | 'behind-of-caster' | 'section';
  section?: [from: number, to: number];
  pick: 'self' | 'nearest' | 'furthest' | 'leader' | 'last';
  tieBreak: 'random' | 'lowest-seat';
}
```

Effect ops:

| Op | Meaning |
|---|---|
| `moveRelative { amount }` | Move target ±amount (relative placement) |
| `moveTo { rule }` | Move target to a tile chosen by a rule, e.g. `nearest-ladder-foot-ahead` (absolute placement) |
| `swap` | Swap positions of caster and target (absolute placement on both) |
| `addEffect { template }` | Attach an ActiveEffect (§5.5) to the target |
| `removeEffects { filter, count }` | Remove matching active effects from the target (`count: 'all'` allowed) |
| `boardEdit { action, placement, length, lifetime }` | Create/remove/move/modify a snake or ladder (§5.7) |
| `gamble { outcomes: [{ weight, ops }] }` | Pick one outcome by integer weight from `misc` |
| `conditional { trigger, ops, lifetime }` | Shorthand for `addEffect` with an `afterMove` hook |

Every card has exactly one target. The target's condition is part of the card text and visible before selection; the concrete target is hidden until resolution.

### 5.2 Offer, reroll, select

1. Each qualifying player receives 3 cards, all of the Mystery tile's rarity. For each slot: draw a **type** by `typeWeights` (default equal), then a card from that `(type, rarity)` bucket by card `weight`, using the player's `cards` stream. Duplicates across slots are allowed.
2. **Reroll:** max 2 per encounter, max 1 per slot. A reroll redraws that slot (type, then card), excluding the exact card being replaced.
3. Offers and rerolls are emitted only as private events.
4. `pickCard` selects one card. The engine immediately **locks a hidden target** using the card's `TargetRule` against the current state.
5. On `mystery` window expiry, a player who has not picked gets a random card from their currently displayed hand (from their `cards` stream).
6. When every qualifying player has picked (or timed out), all selections are revealed together with public `CardSelected` events, and resolution begins.

### 5.3 Targeting at resolution

When a card's group resolves, its locked target is re-checked against the card's `condition` on the group snapshot:

- Still valid → keep it.
- Invalid → re-select using the same `TargetRule`.
- No valid target → the card **fizzles** (public `CardResolved { result: 'fizzled' }`).

### 5.4 Resolution groups

Cards resolve in groups ordered by **type** (Movement → Defense → Attack → Risky → Misc), then by **rarity** (Epic → Rare → Common). Cards sharing type and rarity form one simultaneous group. For each non-empty group:

1. **Snapshot** the current state.
2. **Re-check / re-select targets** against the snapshot (§5.3).
3. **Compute** all ops against the snapshot:
   - `moveRelative` amounts on the same player are summed.
   - If two or more absolute placements (`moveTo`, `swap`) in the group touch the same player, **all** of those placements fizzle with a public `Clash` event. Relative moves still apply.
   - `removeEffects` only sees effects that existed in the snapshot; it cannot remove effects created in the same group.
   - `gamble` outcomes are drawn from `misc` in seat order of casters.
4. **Apply.** `beforeAttack` effects on an Attack card's target block it (consuming a charge) → `CardResolved { result: 'blocked' }`. Otherwise `result: 'hit'`. The caster and all players see the result.
5. **Settle** (§4.5) for every player whose position changed.

### 5.5 Active effects

```ts
interface ActiveEffect {
  id: string;
  owner: PlayerId;               // the player the effect is attached to
  sourceCard: string;
  sourcePlayer: PlayerId;
  hook: 'diceFace' | 'diceTotal' | 'beforeSnake' | 'beforeAttack' | 'afterMove';
  params: HookParams;            // per hook, e.g. { op: 'add', value: -3 }
  lifetime: { rounds?: number; charges?: number; untilTriggered?: boolean } | 'permanent';
  createdRound: number;
  seq: number;                   // global creation order
}
```

- Effects stack without limit and are public.
- `rounds: n` → active through the next `n` full rounds; removed at the end of round `createdRound + n`.
- `charges: n` → decremented each time the hook fires; removed at 0.
- An effect may combine `rounds` and `charges`; whichever runs out first removes it.

Hook points (closed set):

| Hook | Fires | Used by |
|---|---|---|
| `diceFace` | Each die, as it is rolled | "Next die shows 6" |
| `diceTotal` | Once on the sequence total | +N, ×N, "becomes N" |
| `beforeSnake` | When a mover is about to slide down a snake | Snake shields |
| `beforeAttack` | When an Attack card is about to apply to the owner | Attack shields |
| `afterMove` | After a move completes, with its cause and landing info | Risky conditionals |

### 5.6 Dice modifier stacking (D10, D17)

1. **FACE stage:** per die, as it is rolled. Multiple FACE effects apply in `seq` order.
2. **TOTAL stage** on the summed dice:
   1. Replace — if several, the newest (`seq`) wins.
   2. Multiply — all multipliers multiply together.
   3. Add — all addends sum.
3. Floor at 0.

### 5.7 Board edits

- Actions: `create`, `remove`, `move`, `modify` (change length or endpoint) of a snake or ladder.
- Lifetime per card: `{ rounds: n }` or `'permanent'`. Expiry restores the prior state (a temporarily removed generated snake returns).
- Edits fire only when someone **lands** on the affected tile (D9).
- Placement rules are part of the op (e.g. "first valid tile 2–6 ahead of the target"). If no candidate satisfies the invariants, the card fizzles.
- **Invariants enforced on every edit:**
  - No jump starts or ends on tile 0 or tile N.
  - At most one jump starts on any tile.
  - The jump graph is acyclic (chains allowed for edits, cycles never).
  - No jump starts on a Mystery tile.

---

## 6. Starter card set

Placeholder content to exercise every framework feature and give the simulator realistic matches. Values are tuned via the simulator; the full catalogue is sub-project (c).

| # | Name | Type | Rarity | Target | Effect | Exercises |
|---|---|---|---|---|---|---|
| 1 | Sprint | Movement | Common | self | Move +3 | `moveRelative` |
| 2 | Loaded Die | Movement | Rare | self | Your next die shows 6 (1 charge) | FACE stage |
| 3 | Overdrive | Movement | Epic | self | Next dice total ×2 (1 charge) | TOTAL multiply |
| 4 | Ladder Warp | Movement | Epic | self | Move to the nearest ladder foot ahead (fizzles if none) | `moveTo`, landing triggers |
| 5 | Snake Charm | Defense | Common | self | Ignore the next snake (1 charge, 3 rounds) | `beforeSnake` |
| 6 | Shield | Defense | Rare | self | Block the next attack (1 charge, 3 rounds) | `beforeAttack` |
| 7 | Aegis | Defense | Epic | self | Block all attacks and snakes for 2 rounds | Two effects, unlimited charges |
| 8 | Shove | Attack | Common | nearest player ahead | Move them −3 | Conditional targeting, fizzle |
| 9 | Heavy Boots | Attack | Rare | leader (other player furthest ahead) | Their next dice total −3 | Dice mod on another player |
| 10 | Switcheroo | Attack | Epic | furthest player ahead of you | Swap positions | `swap`, Clash |
| 11 | Coin Flip | Risky | Common | self | 50%: +4 · 50%: −4 | `gamble` |
| 12 | Snake Bait | Risky | Rare | self | Checked once, on your next dice movement: if it lands on a snake head, +8 after sliding | `conditional` / `afterMove` |
| 13 | Jackpot | Risky | Epic | self | 40%: +15 · 60%: −8 | `gamble` |
| 14 | Steady Hand | Misc | Common | self | Your next dice total becomes 4 | TOTAL replace |
| 15 | Cleanse | Misc | Common | self | Remove all effects on you created by other players | `removeEffects` |
| 16 | Snake Pit | Misc | Rare | leader (other player furthest ahead) | Create a snake, head on the first valid tile 2–6 ahead of them, length 8, 3 rounds | `boardEdit` create snake |
| 17 | Ladder Drop | Misc | Epic | self | Create a ladder, foot on the first valid tile 2–6 ahead of you, length 15, 2 rounds | `boardEdit` create ladder |

Every `(type, rarity)` bucket contains at least one card. `createMatch` throws `ConfigError` if a supplied card list leaves any bucket empty.

---

## 7. Board generation & validation

### 7.1 Board model

```ts
interface Board {
  size: number;                         // N (100)
  jumps: Jump[];                        // { id, from, to, origin: 'generated' | { editId } }
  mystery: Record<number, Rarity>;      // tile → rarity, tiles in 1..N−1
  seed: string;
  generatorVersion: number;
}
```

A jump with `to < from` is a snake; `to > from` is a ladder.

### 7.2 Generation

`generateBoard(seed, cfg)` uses only the `board` stream (derived from `seed` and `generatorVersion`).

1. **Draw candidate:**
   - Ladders: count in `[8, 10]`, length in `[4, 30]`.
   - Snakes: count in `[8, 10]`, length in `[4, 30]`.
   - Mystery tiles: `round(N × density)` with density default 0.18 (config range 0.15–0.20); rarity by weights **Common 70 / Rare 25 / Epic 5**.
2. **Structural validation** (reject on any failure):
   - Hard invariants from §5.7.
   - No chains: no jump ends on another jump's start (D16).
   - Final stretch (tiles `N−9 .. N−1`): at most 1 snake head, with length ≤ 10.
   - No 6 consecutive tiles that are all snake heads.
   - Mystery spacing: at most 4 Mystery tiles in any 10-tile window; no gap of more than 12 tiles without one.
3. **Analytic validation** (§7.3).
4. **Accept**, or draw the next candidate from the same stream.
5. After `maxAttempts` (default 500) → throw `GenerationError { seed, config, rejectionCounts }`.

`GenerationReport` records attempts, rejection reasons by rule, and the accepted board's analysis.

### 7.3 Analytic validation (Markov chain)

- States: positions `0..N` for one player, dice only: one die per round (totals 1–6, p = 1/6 each), bounce, jumps. No cards, no collisions.
- Compute `F(r)` = P(single player has finished by round `r`) exactly, by iterating the transition matrix.
- First-finisher distribution for `n` independent players: `P(first ≤ r) = 1 − (1 − F(r))ⁿ`.
- **Accept if:**
  - median first-finish round for 4 players ∈ `[15, 30]` (initial band), and
  - P(first-finish > 70 rounds) for 2 players < 1% (60 before the 2026-10-04 amendment).
- These bands are provisional and are calibrated with the simulator (§8) against the 7–12 minute target, since cards and collisions shift real match length.

### 7.4 Debug rendering

`renderBoardAscii(board)` prints the serpentine 10×10 grid with snakes, ladders and Mystery rarities, used by `sim board`.

---

## 8. Simulator (`packages/sim`)

### 8.1 Bots

```ts
interface Policy {
  decide(view: PlayerView, awaiting: Awaiting): Input | 'idle';
}
```

`'idle'` means "do nothing this window" (to exercise timeouts).

- **`random`** — uniform over legal actions; configurable AFK probability per window.
- **`heuristic`** — scores cards by approximate expected tile gain; rerolls the weakest card if its score is below a threshold; RPS/Minority picks are random.

### 8.2 Runner

Loop: `awaiting(state)` → collect inputs from the awaited bots (or send `timeout { windowId }` if any bot idles) → `step`. No real time elapses. Match seeds are derived from the batch base seed, so whole batches are reproducible.

### 8.3 CLI

| Command | Purpose |
|---|---|
| `sim run --matches 1000 --players 4 --policy heuristic --seed base [--out file.json]` | Batch run and report |
| `sim board --seed X` | ASCII board + generation report + analysis |
| `sim replay log.json` | Replay an input log and verify the final `hashState` |

### 8.4 Metrics

- **Length:** rounds per match (median, p10, p90); **estimated minutes** via a time model (config, labeled as estimates): dice phase 6 s, movement 2 s, 6 s per challenge wave, 10 s Mystery select when any encounter, 1 s reveal + 1.5 s per resolved card, 1 s round overhead.
- **Collisions:** challenges and waves per match; safety-cap triggers.
- **Mystery:** encounters per round; picks by type/rarity; reroll usage; fizzle, clash and blocked rates.
- **Fairness:** win rate by seat; lead changes per match; comeback rate (winner not leading at round 10).
- **Generator:** attempts per board; rejection reasons.

Output: table to stdout plus JSON.

### 8.5 Performance target

1,000 four-player matches in under 10 s on a typical laptop (invariant checks disabled).

---

## 9. Configuration

```ts
interface MatchConfig {
  seed: string;
  board: BoardConfig;           // or a pre-built Board
  windows: { diceMs: 12000; challengeMs: 8000; mysteryMs: 15000 };
  mystery: {
    rarityWeights: { common: 70; rare: 25; epic: 5 };
    typeWeights: { movement: 1; defense: 1; attack: 1; risky: 1; misc: 1 };
    maxRerolls: 2;
  };
  collision: { knockback: 3; maxReplays: 3; maxWaves: 3 };
  cards: CardDef[];             // defaults to the starter set
  checkInvariants: boolean;     // default true; sim may disable
}

interface BoardConfig {
  size: 100;
  generatorVersion: 2;
  ladders: { count: [8, 10]; length: [4, 30] };
  snakes: { count: [8, 10]; length: [4, 30] };
  mysteryDensity: 0.18;
  finishZone: { tiles: 9; maxSnakes: 1; maxSnakeLength: 10 };
  maxConsecutiveSnakeHeads: 5;
  mysterySpacing: { maxPerWindow: 4; window: 10; maxGap: 12 };
  analysis: { median4pRounds: [15, 30]; maxRounds2p: 70; maxTailProbability: 0.01 };
  maxAttempts: 500;
}
```

Values shown are defaults. A lobby UI for these is out of scope.

---

## 10. Error handling

| Situation | Behaviour |
|---|---|
| Invalid input (wrong phase, player not awaited, reroll limit, bad slot, unknown challenge, stale timeout) | `step` returns `{ ok: false, error }`; state unchanged; never throws |
| Invalid config (not 2–4 players, bad windows, malformed cards) | `createMatch` throws `ConfigError` |
| Generator exhausts attempts | `GenerationError { seed, config, rejectionCounts }` |
| Broken invariant | `InvariantError` (a bug) |

`assertInvariants` checks:
- Positions are integers in `[0, N]`.
- Outside an in-progress settle, no tile in `1..N` holds more than one player.
- Board invariants (§5.7) hold.
- Reroll counts ≤ 2 and ≤ 1 per slot.
- At most one winner.

---

## 11. Testing

Test-first, module by module (Vitest).

**Unit tests** (hand-built boards, scripted RNG):
- PRNG known-value vectors; stream derivation stability.
- Bounce arithmetic, including floor at 0.
- Dice: one die per player, auto-roll on expiry, two-stage modifier order.
- Settle loop: jump chains (edit-created), knockback chain reactions, safety cap, tile-0 safe zone.
- Challenges: RPS, Minority, replays, replay cap, timeout auto-lose, continuation as RPS, all-timeout random winner.
- Mystery: offers, reroll limits, privacy, timeout pick, encounter qualification (§4.8).
- Resolution: priority order, snapshot targeting, retarget, fizzle, relative sum, Clash, shields, `removeEffects` snapshot rule.
- Effects: lifetimes (rounds/charges), expiry, stacking rules.
- Board edits: invariants, placement fallback, fizzle, expiry restore, landing-only trigger.
- Victory: final-tile showdown, knocked off by attack, rankings.
- Generator: every structural rule; determinism by seed; `GenerationError`.

**Property tests** (fast-check, random seeds + random legal inputs):
- Invariants hold after every step.
- Determinism: same config, seats and inputs → identical `hashState` and events.
- Replay round-trip.
- Settle always terminates.
- `viewFor(p)` never contains another player's private data or any locked target.

**Cross-check:** Markov `F(r)` vs a dice-only Monte-Carlo run, within tolerance.

**Golden tests:** a few recorded matches with snapshotted event streams.

**Tooling:** `pnpm lint`, `pnpm typecheck`, `pnpm test`; GitHub Actions workflow running all three.

---

## 12. Open items for later specs

- **Card catalogue (c):** exact Epic board-manipulation limits, durations, full card list, balance.
- **Server (d):** disconnect/reconnect behaviour, room lifecycle, anti-cheat, timer authority.
- **Lifecycle (f):** lobby settings UI, rematch, post-match screens.
- **Larger boards:** tuning for 200/300 tiles.

---

## Appendix A — Events

| Event | Visibility | Payload (summary) |
|---|---|---|
| `RoundStarted` | public | round |
| `WindowOpened` | public | windowId, window, players, durationMs |
| `DieRolled` | public | player, face, natural, forced |
| `DiceTotaled` | public | player, faces, modifiers applied, total |
| `Moved` | public | player, from, to, cause: `dice` \| `bounce` \| `snake` \| `ladder` \| `knockback` \| `card` \| `stepBack` |
| `SnakeBlocked` | public | player, effectId |
| `ChallengeStarted` | public | challengeId, tile, players, kind, theme |
| `ChallengePickLocked` | public | challengeId, player (pick hidden) |
| `ChallengePickEcho` | private | challengeId, choice |
| `ChallengeResolved` | public | challengeId, picks, winners, losers, outcome: `win` \| `replay` \| `random` |
| `MysteryOffered` | private | player, tile rarity, cards |
| `CardRerolled` | private | slot, old, new |
| `CardSelected` | public | player, card |
| `CardResolved` | public | card, caster, target, result: `hit` \| `blocked` \| `fizzled`, details |
| `Clash` | public | cards, affected players |
| `EffectAdded` / `EffectRemoved` / `EffectExpired` | public | effect |
| `BoardEdited` / `BoardEditExpired` | public | edit |
| `RoundEnded` | public | round |
| `MatchWon` | public | winner, rankings |
