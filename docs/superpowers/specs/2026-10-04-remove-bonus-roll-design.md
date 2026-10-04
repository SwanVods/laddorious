# Laddorious — Spec #1 Amendment: Remove the Bonus Roll

- **Date:** 2026-10-04
- **Status:** Approved and implemented
- **Amends:** [Spec #1](2026-10-03-game-core-design.md), decision D13
- **Scope:** `packages/core`, `packages/sim`, and the text of Spec #1

---

## 1. Decision

Every player rolls exactly one die per round. A 6 no longer offers a roll-again choice.

Extra rolls will exist only as card effects in the card catalogue (sub-project c), for example "if your die shows *n*, roll another die". D13 changes from **"Optional bonus roll"** to **"No bonus roll. Extra rolls come only from cards."**

**Why:** extra rolls should be a card power, not a base rule. The change also simplifies the dice phase (one window, one input) and the 3D client (no bonus popup).

This amendment is done before Spec #2 (3D client), so the client is built on the final set of input windows.

## 2. Rules (replaces Spec #1 §4.3)

Dice phase (window `dice`, default 12 s):

1. Every player rolls one die, independently and at the same time.
2. FACE-stage effects (§5.6) apply to the die as it is rolled.
3. When the `dice` window expires, players who have not rolled are auto-rolled once. The phase then ends. There is no grace window.
4. Total = the die face, then TOTAL-stage effects in the order Replace → Multiply → Add, then floored at 0. "Next roll" effects are consumed here.
5. The phase ends as soon as every player has rolled.

§4.4 (movement) onwards is unchanged.

## 3. API changes

These are breaking changes to `@laddorious/core`. The simulator is the only consumer today.

**Removed**

| Item | Where |
|---|---|
| Input `bonusChoice { player, rollAgain, windowId }` | `Input` union, `validateInput`, `dispatch` |
| Window kind `bonusGrace` | `WindowKind`, `awaiting`, `windowDuration` |
| Dice status `bonusPending` | `DiceSeq.status` becomes `'ready' \| 'done'` |
| The dice phase's `window` field | `Phase` and `PublicPhase`: the dice phase only ever has the `dice` window, so the field goes |
| Event `BonusChosen` | `EventBody` |
| Config `windows.bonusGraceMs` | `MatchConfig.windows`, `DEFAULT_WINDOWS` |

A `bonusChoice` input is now rejected by `validateInput` as `INVALID_INPUT` ("unknown input type").

**New check.** `validateConfig` rejects unknown keys in `windows` with a `ConfigError`. Today any positive integer under any key is accepted, so a stale `bonusGraceMs` would slip through without anyone noticing.

**Kept on purpose**

- `DiceSeq.faces: number[]` and `DiceTotaled.faces`. Today they always hold one face. A future "roll another" card can append faces without reshaping state, events or the client.
- The `diceFace` hook's `die: 'first' | 'each'` parameter. The two are equivalent with one die, and they mean different things once a card can add dice.
- `DieRolled` is unchanged.

## 4. Cards

**Loaded Die** keeps its effect (`diceFace`, `die: 'first'`, set 6, 1 charge). Its text changes to **"Your next die shows 6."** It still exercises the FACE stage. It no longer exercises the bonus roll, because that rule is gone.

No other starter card changes.

## 5. Board analysis and generation

### 5.1 Markov model (replaces the model in §7.3)

One round of dice-only movement is a single die: totals 1–6, each with p = 1/6. Bounce and jump chains are unchanged.

### 5.2 Measured impact

Measured on 300 boards produced by today's generator, re-analysed with the one-die model:

| Measure | Bonus roll (today) | One die |
|---|---|---|
| Median 4-player first finish, p10 / median / p90 | 17 / 19 / 22 rounds | 18 / 21 / 24 rounds |
| Boards outside the median band [15, 30] | 0% | 0% |
| Boards with P(2-player first finish after 60 rounds) ≥ 1% | 0% | 21.3% |
| Same, after 70 rounds | — | 3.3% |

### 5.3 Band changes

- **Median band [15, 30]: unchanged.** Every measured board still falls inside it.
- **Tail horizon `maxRounds2p`: 60 → 70.** One die is about 11% slower (medians 19 → 21), and 60 × ~1.11 rounds up to 70. At 60, about a fifth of today's boards would fail the tail rule. The generator would then favour tamer boards, with fewer and shorter snakes in the late game. Scaling the horizon keeps today's board variety. `maxTailProbability` stays at 1%.

### 5.4 Generator version 1 → 2

The analysis decides which candidate boards are accepted, so the same seed can now produce a different board. Bumping `generatorVersion` to 2 keeps the guarantee "same seed and version → same board". The board stream label already includes the version.

## 6. Simulator

- **Bots:** remove the bonus decision from the random and heuristic policies.
- **Metrics:** remove `bonusSec` from the time model and the count of rounds with a bonus roll.
- **Expected effect:** today's baseline (400 four-player heuristic matches) is a median of 18 rounds, about 6.3 estimated minutes. With one die we expect about 20 rounds and about 6.6–7 minutes, because dropping the bonus decision time offsets part of the slower pace. A 1,000-match batch after the change confirms the real numbers.

Today's median of 6.3 minutes is already below Spec #1's 7–12 minute target. Closing that gap is separate tuning work and not part of this amendment.

## 7. Compatibility

- Match logs recorded before this change will not replay, because both the rules and the board version changed. `sim replay` reports them as `FAILED` (a removed input) or `MISMATCH` (a different hash) and exits with code 1. No logs are kept anywhere else.
- Golden snapshots are re-recorded. The changed event streams are the expected outcome.

## 8. Testing

| Area | Checks |
|---|---|
| Dice | One die per player. A 6 opens no extra window. When the dice window expires, anyone who hasn't rolled is auto-rolled and the phase ends. A `bonusChoice` input is rejected as `INVALID_INPUT`. FACE and TOTAL effects still apply in order. |
| Config | `windows.bonusGraceMs` and any other unknown window key throw `ConfigError`. |
| Analysis | Transitions use totals 1–6. The existing Markov vs. Monte-Carlo cross-check passes with one die in the Monte-Carlo too. |
| Generator | Deterministic by (seed, version 2). Over 1,000 seeds: no `GenerationError` and mean attempts below 2. |
| Engine | Property tests (invariants, determinism, replay, view privacy) pass. Golden snapshots are re-recorded and reviewed for the expected differences only: no `BonusChosen` events, one face per `DiceTotaled`. |
| Simulator | Bot tests updated. Metrics tests updated for the time model. |
| Gate | `pnpm test`, `pnpm typecheck` and `pnpm lint` all pass. |

## 9. Spec #1 text edits

Spec #1 stays the canonical rules document, so these sections are updated in place, each noting "amended 2026-10-04":

- §2 decision log: D13.
- §3.3 inputs table: remove `bonusChoice`.
- §3.4 window list: remove `bonusGrace`.
- §4.3: replace with §2 of this amendment.
- §5.6: drop "before the 6-check".
- §6: Loaded Die row text.
- §7.3: the one-die model and `maxRounds2p` = 70.
- §8.1: drop the heuristic bot's bonus rule.
- §8.4: drop "bonus decision 2 s" from the time model.
- §9: remove `bonusGraceMs`; set `generatorVersion: 2` and `maxRounds2p: 70`.
- §11: replace "optional bonus, max 2 dice, … grace window" with "one die, auto-roll on expiry".
- Appendix A: remove `BonusChosen`.

## 10. Out of scope

- The "roll another" card itself, including whether its extra roll is automatic or the player's choice. That belongs to the card catalogue (sub-project c).
- Tuning match length up to the 7–12 minute target.

## 11. Results (1,000 four-player heuristic matches, seed `amendment-check`)

| Measure | Before (400 matches, bonus roll) | After |
|---|---|---|
| Rounds p10 / median / p90 | 12 / 18 / 26 | 14 / 20 / 30 |
| Estimated minutes p10 / median / p90 | 4.0 / 6.3 / 9.3 | 4.3 / 6.8 / 9.9 |
| Board generation attempts mean / max | 1.17 / 3 | 1.23 / 5 |

No `GenerationError` over 1,000 boards. The median match is still slightly below the 7-minute floor of Spec #1's target (see §10).
