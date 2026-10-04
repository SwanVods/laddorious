# Remove the Bonus Roll — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every player rolls exactly one die per round. The roll-again-after-a-6 rule (D13) disappears from the engine, the simulator, the board analysis and Spec #1.

**Architecture:** The dice phase keeps its shape (one `DiceSeq` per player with a `faces` list), but a roll always ends the player's sequence. The `bonusGrace` window, the `bonusChoice` input and the `BonusChosen` event are deleted. The board generator's Markov model switches to a single die. Its tail horizon scales from 60 to 70 rounds, and `generatorVersion` becomes 2 so a seed and version still map to one board.

**Tech Stack:** TypeScript (strict), pnpm workspace, Vitest, fast-check, tsx. Node ≥ 24.

**Spec:** `docs/superpowers/specs/2026-10-04-remove-bonus-roll-design.md` (amends `docs/superpowers/specs/2026-10-03-game-core-design.md`)

**Branch:** `engine/remove-bonus-roll` (already created; the spec is committed there).

## Global Constraints

- One die per player per round. A 6 opens no window and grants nothing.
- Removed: `bonusChoice` input, `bonusGrace` window kind, `bonusPending` status, the dice phase's `window` field, the `BonusChosen` event, `windows.bonusGraceMs`.
- A `bonusChoice` input is rejected by `validateInput` with `INVALID_INPUT` and message `unknown input type`.
- `validateConfig` throws `ConfigError` for any key in `windows` other than `diceMs`, `challengeMs`, `mysteryMs`.
- Keep `DiceSeq.faces: number[]`, `DiceTotaled.faces`, and the `diceFace` hook's `die: 'first' | 'each'` parameter.
- Loaded Die text is exactly `Your next die shows 6.` Its effect is unchanged.
- Markov model: totals 1–6, each p = 1/6.
- `DEFAULT_BOARD_CONFIG.generatorVersion` = 2. `analysis` = `{ median4pRounds: [15, 30], maxRounds2p: 70, maxTailProbability: 0.01 }`.
- `core` stays free of `Math.random`, `Date` and `performance` (ESLint enforces this).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run every command from the repository root `E:\AI Project\laddorious`.

## Review Focus

1. **A client or old script still sends a well-formed `bonusChoice`.** Expected: `INVALID_INPUT` with "unknown input type". It must not crash or be accepted. Pinned in Task 2 (`dice.test.ts` and `step.test.ts`).
2. **A JSON or JS config, which TypeScript doesn't check, still carries `windows.bonusGraceMs`.** Expected: a `ConfigError` that names the key. Pinned in Task 1 (unknown key) and Task 2 (`bonusGraceMs`).
3. **A player rolls a 6, natural or forced by Loaded Die.** Expected: that player stops being awaited, and the phase moves on once the others roll. Pinned in Task 2.
4. **The dice window expires and an auto-roll comes up 6.** Expected: the phase ends at once and no other window opens. Pinned in Task 2.
5. **Someone runs `sim replay` on a log recorded before this change.** Expected: a one-line `FAILED …` message and exit code 1, not a stack trace. Pinned in Task 3.

---

### Task 1: Reject unknown window keys in the match config

**Files:**
- Modify: `packages/core/src/engine/config.ts` (`validateConfig`, around lines 87–91)
- Test: `packages/core/test/cards.test.ts` (the `describe('resolveConfig', …)` block)

**Interfaces:**
- Consumes: `DEFAULT_WINDOWS` and `ConfigError` (both already in `config.ts`'s scope).
- Produces: `validateConfig` throws `ConfigError('windows.<key> is not a known window (expected diceMs, …)')` for unknown keys. Task 2 relies on this message prefix.

- [ ] **Step 1: Write the failing test**

In `packages/core/test/cards.test.ts`, add `type MatchConfigInput,` to the import list from `'../src/index'` at the top of the file. Then add this test inside `describe('resolveConfig', () => { … })`:

```ts
  it('rejects unknown window keys instead of ignoring them', () => {
    const windows = { fooMs: 1_000 } as unknown as MatchConfigInput['windows'];
    expect(() => resolveConfig({ seed: 's', windows })).toThrow(ConfigError);
    expect(() => resolveConfig({ seed: 's', windows })).toThrow(/windows\.fooMs is not a known window/);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run packages/core/test/cards.test.ts -t "unknown window keys"`
Expected: FAIL. `resolveConfig` returns normally because `fooMs: 1000` is a positive integer.

- [ ] **Step 3: Implement**

In `packages/core/src/engine/config.ts`, replace the window loop at the start of `validateConfig`:

```ts
  for (const [k, v] of Object.entries(cfg.windows)) {
    if (!Number.isInteger(v) || v <= 0) throw new ConfigError(`windows.${k} must be a positive integer, got ${v}`);
  }
```

with:

```ts
  const knownWindows = Object.keys(DEFAULT_WINDOWS);
  for (const [k, v] of Object.entries(cfg.windows)) {
    if (!knownWindows.includes(k)) throw new ConfigError(`windows.${k} is not a known window (expected ${knownWindows.join(', ')})`);
    if (!Number.isInteger(v) || v <= 0) throw new ConfigError(`windows.${k} must be a positive integer, got ${v}`);
  }
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run packages/core/test/cards.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/engine/config.ts packages/core/test/cards.test.ts
git commit -m "fix(core): reject unknown window keys in the match config

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: One die per round in the engine and its consumers

The type removals break every consumer at compile time, so engine, test helpers and simulator change together in this task.

**Files:**
- Modify: `packages/core/src/engine/types.ts` (`WindowKind`, `DiceSeq`, `Phase`, `Input`, `EventBody`)
- Modify: `packages/core/src/engine/dice.ts` (whole file)
- Modify: `packages/core/src/engine/awaiting.ts` (dice case)
- Modify: `packages/core/src/engine/util.ts` (`windowDuration`)
- Modify: `packages/core/src/engine/create.ts` (initial phase, around line 33)
- Modify: `packages/core/src/engine/step.ts` (import, `validateInput`, `dispatch`)
- Modify: `packages/core/src/engine/config.ts` (`MatchConfig['windows']`, `DEFAULT_WINDOWS`)
- Modify: `packages/core/src/view/view.ts` (`PublicPhase` dice member, imports)
- Modify: `packages/core/src/cards/starter.ts` (Loaded Die text)
- Modify: `packages/sim/src/bots.ts`, `packages/sim/src/metrics.ts`
- Test: `packages/core/test/dice.test.ts` (whole file), `step.test.ts`, `cards.test.ts`, `mystery.test.ts`, `settle.test.ts`, `view.test.ts`, `support/fixtures.ts`, `support/randomPlay.ts`, `golden.test.ts` snapshot
- Test: `packages/sim/test/bots.test.ts`

**Interfaces:**
- Consumes: Task 1's unknown-window-key check.
- Produces (later tasks and Spec #2 rely on these):
  - `type WindowKind = 'dice' | 'challenge' | 'mystery' | 'none'`
  - `interface DiceSeq { faces: number[]; status: 'ready' | 'done' }`
  - `Phase` dice member: `{ kind: 'dice'; seqs: Record<PlayerId, DiceSeq> }`
  - `PublicPhase` dice member: `{ kind: 'dice'; seqs: Record<PlayerId, { faces: number[]; status: DiceSeq['status'] }> }`
  - `MatchConfig['windows'] = { diceMs: number; challengeMs: number; mysteryMs: number }`
  - `Input` without `bonusChoice`; `EventBody` without `BonusChosen`
  - `TimeModel` without `bonusSec`

- [ ] **Step 1: Rewrite the dice tests for the one-die rule**

Replace the whole of `packages/core/test/dice.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { awaiting, step, type EffectTemplate, type Input, type MatchState } from '../src/index';
import { addEffect } from '../src/engine/effects';
import { ofType, play, positions, roll, setup, timeout } from './support/fixtures';

function withEffect(s: MatchState, owner: string, template: EffectTemplate): MatchState {
  addEffect(s, [], owner, template, 'test', owner);
  return s;
}

describe('dice phase', () => {
  it('moves everyone simultaneously by their totals once all have rolled', () => {
    const s = setup({ dice: [[3], [4]] });
    const first = play(s, [roll('p1')]);
    expect(positions(first.state)).toEqual([0, 0]); // waits for p2
    const { state, events } = play(first.state, [roll('p2')]);
    expect(positions(state)).toEqual([3, 4]);
    expect(ofType(events, 'DiceTotaled').map((e) => [e.player, e.total])).toEqual([['p1', 3], ['p2', 4]]);
    expect(state.round).toBe(2);
  });

  it('ends a roll after one die, even when it shows 6 (no bonus roll)', () => {
    const s = play(setup({ dice: [[6], [1]] }), [roll('p1')]).state;
    expect(s.phase.kind === 'dice' && s.phase.seqs['p1']).toEqual({ faces: [6], status: 'done' });
    expect(awaiting(s)).toMatchObject({ window: 'dice', players: ['p2'] });
    const { state, events } = play(s, [roll('p2')]);
    expect(positions(state)).toEqual([6, 1]);
    expect(ofType(events, 'DiceTotaled')[0]).toMatchObject({ player: 'p1', faces: [6], total: 6 });
  });

  it('rejects a second roll from a player who already rolled', () => {
    const s = play(setup({ dice: [[2], [1]] }), [roll('p1')]).state;
    expect(step(s, roll('p1')(s))).toMatchObject({ ok: false, error: { code: 'NOT_AWAITED' } });
  });

  it('rejects the removed bonusChoice input as an unknown input type', () => {
    const s = play(setup({ dice: [[6], [1]] }), [roll('p1')]).state;
    const legacy = { type: 'bonusChoice', player: 'p1', rollAgain: true, windowId: s.windowId } as unknown as Input;
    expect(step(s, legacy)).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT', message: 'unknown input type' } });
  });

  it('auto-rolls anyone who has not rolled when the window expires, then ends the phase', () => {
    const { state, events } = play(setup({ dice: [[2], [6]] }), [roll('p1'), timeout]);
    expect(ofType(events, 'DieRolled').at(-1)).toMatchObject({ player: 'p2', face: 6, auto: true });
    expect(positions(state)).toEqual([2, 6]);
    expect(ofType(events, 'WindowOpened').map((e) => e.window)).toEqual(['dice']); // only round 2's dice window
    expect(state.round).toBe(2);
  });

  it('bounces off the final tile', () => {
    const { state, events } = play(setup({ positions: [98, 10], dice: [[5], [1]] }), [roll('p1'), roll('p2')]);
    expect(positions(state)).toEqual([97, 11]);
    expect(ofType(events, 'Moved')[0]).toMatchObject({ player: 'p1', from: 98, to: 97, bounced: true });
  });

  it('applies FACE effects to the die as it is rolled (a forced 6 also ends the roll)', () => {
    const s = withEffect(setup({ dice: [[2], [1]] }), 'p1', { params: { hook: 'diceFace', die: 'first', set: 6 }, lifetime: { charges: 1 } });
    const { state, events } = play(s, [roll('p1')]);
    expect(ofType(events, 'DieRolled')[0]).toMatchObject({ natural: 2, face: 6, forced: true });
    expect(state.phase.kind === 'dice' && state.phase.seqs['p1']!.status).toBe('done');
    expect(state.effects).toHaveLength(0); // its single charge was spent
    expect(positions(play(state, [roll('p2')]).state)).toEqual([6, 1]);
  });

  it('applies TOTAL effects in order Replace (newest) → Multiply → Add', () => {
    let s = setup({ dice: [[1], [1]] });
    for (const params of [
      { hook: 'diceTotal', op: 'replace', value: 4 },
      { hook: 'diceTotal', op: 'replace', value: 5 },
      { hook: 'diceTotal', op: 'multiply', value: 2 },
      { hook: 'diceTotal', op: 'add', value: -3 },
    ] as const) {
      s = withEffect(s, 'p1', { params, lifetime: { charges: 1 } });
    }
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(ofType(events, 'DiceTotaled')[0]).toMatchObject({ player: 'p1', faces: [1], total: 7 }); // (5 × 2) − 3
    expect(positions(state)).toEqual([7, 1]);
    expect(state.effects).toHaveLength(0);
  });

  it('floors dice movement at 0', () => {
    const s = withEffect(setup({ positions: [20, 0], dice: [[2], [1]] }), 'p1', {
      params: { hook: 'diceTotal', op: 'add', value: -10 },
      lifetime: { charges: 1 },
    });
    const { state, events } = play(s, [roll('p1'), roll('p2')]);
    expect(ofType(events, 'DiceTotaled')[0]!.total).toBe(0);
    expect(positions(state)).toEqual([20, 1]);
  });
});
```

- [ ] **Step 2: Update the other core tests that mention the bonus roll**

`packages/core/test/step.test.ts`:
- Change the import line `import { again, choose, makeBoard, pick, play, roll, setup } from './support/fixtures';` to `import { choose, makeBoard, pick, play, roll, setup } from './support/fixtures';`.
- In `'returns INVALID_INPUT for non-objects, unknown types and wrongly typed fields'`, add this line to the `bad` array, right after `{ type: 'bonusChoice', player: 'p1', rollAgain: 'no', windowId: 1 },`:

```ts
      { type: 'bonusChoice', player: 'p1', rollAgain: true, windowId: 1 }, // removed input type (bonus roll is gone)
```

- In `'continues identically after the state is persisted as JSON mid-match'`, replace

```ts
    const s = play(setup({ board: makeBoard(100, [], { 50: 'rare' }), dice: [[4, 2, 6, 3], [5, 3, 1]] }), [roll('p1'), roll('p2')]).state;
    const resumed = JSON.parse(JSON.stringify(s)) as typeof s;
    const next = [roll('p1'), roll('p2'), roll('p1'), again('p1'), roll('p2')];
```

with

```ts
    const s = play(setup({ board: makeBoard(100, [], { 50: 'rare' }), dice: [[4, 2, 6], [5, 3, 1]] }), [roll('p1'), roll('p2')]).state;
    const resumed = JSON.parse(JSON.stringify(s)) as typeof s;
    const next = [roll('p1'), roll('p2'), roll('p1'), roll('p2')];
```

`packages/core/test/cards.test.ts`, in `'fills spec §9 defaults'`:
- Change `expect(cfg.windows).toEqual({ diceMs: 12_000, bonusGraceMs: 5_000, challengeMs: 8_000, mysteryMs: 15_000 });` to `expect(cfg.windows).toEqual({ diceMs: 12_000, challengeMs: 8_000, mysteryMs: 15_000 });`.
- Add this test right after Task 1's test:

```ts
  it('rejects the removed bonusGraceMs window', () => {
    const windows = { bonusGraceMs: 5_000 } as unknown as MatchConfigInput['windows'];
    expect(() => resolveConfig({ seed: 's', windows })).toThrow(/windows\.bonusGraceMs is not a known window/);
  });
```

- [ ] **Step 3: Run the core tests and watch them fail**

Run: `pnpm vitest run packages/core/test/dice.test.ts packages/core/test/step.test.ts packages/core/test/cards.test.ts`
Expected: FAIL in several places. `'ends a roll after one die…'` fails because the status is `bonusPending`. `'rejects the removed bonusChoice input…'` fails because the input is accepted. `'auto-rolls anyone…'` sees a `bonusGrace` window. The windows default test fails on `bonusGraceMs`. The `bonusGraceMs` rejection test fails because it's still a known key.

- [ ] **Step 4: Change the engine types**

In `packages/core/src/engine/types.ts`:

```ts
export type WindowKind = 'dice' | 'challenge' | 'mystery' | 'none';

export interface DiceSeq {
  /** One face per die rolled this round: always one today, a list so a future card can add dice. */
  faces: number[];
  status: 'ready' | 'done';
}
```

In the `Phase` union, replace `| { kind: 'dice'; window: 'dice' | 'bonusGrace'; seqs: Record<PlayerId, DiceSeq> }` with:

```ts
  | { kind: 'dice'; seqs: Record<PlayerId, DiceSeq> }
```

In the `Input` union, delete the line `| { type: 'bonusChoice'; player: PlayerId; rollAgain: boolean; windowId: number }`.

In the `EventBody` union, delete the line `| { type: 'BonusChosen'; player: PlayerId; rollAgain: boolean; auto: boolean }`.

- [ ] **Step 5: Rewrite the dice module**

Replace the whole of `packages/core/src/engine/dice.ts` with:

```ts
import { rollDie } from '../rng/stream';
import { applyFaceEffects, applyTotalEffects } from './effects';
import type { DiceSeq, GameEvent, InputError, MatchState, Mover, PlayerId } from './types';
import { bounce, getPlayer, movePlayer, openWindow, pub } from './util';

type DicePhase = Extract<MatchState['phase'], { kind: 'dice' }>;

export function inputError(code: InputError['code'], message: string): InputError {
  return { code, message };
}

export function startDicePhase(s: MatchState, ev: GameEvent[]): void {
  const seqs: Record<PlayerId, DiceSeq> = {};
  for (const p of s.players) seqs[p.id] = { faces: [], status: 'ready' };
  s.phase = { kind: 'dice', seqs };
  openWindow(s, ev, 'dice', s.players.map((p) => p.id));
}

function dicePhase(s: MatchState): DicePhase | null {
  return s.phase.kind === 'dice' ? s.phase : null;
}

/** Roll the player's one die for this round (spec §4.3, amended 2026-10-04: no bonus roll). */
function rollOne(s: MatchState, ev: GameEvent[], player: PlayerId, auto: boolean): void {
  const phase = dicePhase(s)!;
  const seq = phase.seqs[player]!;
  const seat = getPlayer(s, player).seat;
  const natural = rollDie(s.rng.dice[seat]!);
  const { face, forced } = applyFaceEffects(s, ev, player, seq.faces.length, natural);
  seq.faces.push(face);
  ev.push(pub({ type: 'DieRolled', player, natural, face, forced, auto }));
  seq.status = 'done';
}

export function rollInput(s: MatchState, ev: GameEvent[], player: PlayerId): InputError | null {
  const phase = dicePhase(s);
  if (!phase) return inputError('WRONG_PHASE', 'not in the dice phase');
  const seq = phase.seqs[player];
  if (!seq) return inputError('UNKNOWN_PLAYER', `unknown player ${player}`);
  if (seq.status !== 'ready') return inputError('NOT_AWAITED', `${player} cannot roll now`);
  rollOne(s, ev, player, false);
  return null;
}

/** Dice window expiry: auto-roll everyone who has not rolled. The phase then ends; there is no grace window. */
export function diceTimeout(s: MatchState, ev: GameEvent[]): void {
  const phase = dicePhase(s)!;
  for (const p of s.players) if (phase.seqs[p.id]!.status === 'ready') rollOne(s, ev, p.id, true);
}

export function diceAwaited(phase: DicePhase): PlayerId[] {
  return Object.entries(phase.seqs)
    .filter(([, seq]) => seq.status === 'ready')
    .map(([id]) => id);
}

export function diceComplete(phase: DicePhase): boolean {
  return Object.values(phase.seqs).every((seq) => seq.status === 'done');
}

/** Totals with TOTAL-stage effects, then simultaneous movement with bounce (spec §4.3–4.4). */
export function finishDicePhase(s: MatchState, ev: GameEvent[]): void {
  const phase = dicePhase(s)!;
  const N = s.board.size;
  const movers: Mover[] = [];
  for (const p of s.players) {
    const seq = phase.seqs[p.id]!;
    const sum = seq.faces.reduce((a, b) => a + b, 0);
    const total = applyTotalEffects(s, ev, p.id, sum);
    s.lastTotals[p.id] = total;
    ev.push(pub({ type: 'DiceTotaled', player: p.id, faces: [...seq.faces], total }));
  }
  for (const p of s.players) {
    const total = s.lastTotals[p.id]!;
    if (total === 0) continue;
    const raw = p.position + total;
    movePlayer(s, ev, p.id, bounce(raw, N), 'dice', raw > N);
    movers.push({ player: p.id, cause: 'dice' });
  }
  s.phase = { kind: 'settle', ctx: { movers, wave: 0, challenges: [] }, after: 'mysteryDetect' };
}
```

- [ ] **Step 6: Update the rest of the engine**

`packages/core/src/engine/awaiting.ts`, replace the dice case with:

```ts
    case 'dice':
      return { windowId: s.windowId, window: 'dice', players: diceAwaited(phase), durationMs: windowDuration(s, 'dice') };
```

`packages/core/src/engine/util.ts`, in `windowDuration`, delete these two lines:

```ts
    case 'bonusGrace':
      return s.config.windows.bonusGraceMs;
```

`packages/core/src/engine/create.ts`, change `phase: { kind: 'dice', window: 'dice', seqs: {} },` to:

```ts
    phase: { kind: 'dice', seqs: {} },
```

`packages/core/src/engine/step.ts`:
- Change the import to `import { diceComplete, diceTimeout, finishDicePhase, inputError, rollInput } from './dice';`.
- In `validateInput`, delete:

```ts
    case 'bonusChoice':
      return ok(isString('player') && typeof i.rollAgain === 'boolean');
```

- In `dispatch`, delete:

```ts
    case 'bonusChoice':
      return bonusChoiceInput(s, ev, input.player, input.rollAgain);
```

`packages/core/src/engine/config.ts`:
- In `interface MatchConfig`, change the windows line to `windows: { diceMs: number; challengeMs: number; mysteryMs: number };`.
- Replace `DEFAULT_WINDOWS` with:

```ts
export const DEFAULT_WINDOWS: MatchConfig['windows'] = {
  diceMs: 12_000,
  challengeMs: 8_000,
  mysteryMs: 15_000,
};
```

`packages/core/src/view/view.ts`:
- Add `DiceSeq,` to the type import list from `'../engine/types'`, in alphabetical order after `Challenge,`.
- Replace the dice member of `PublicPhase` with:

```ts
  | { kind: 'dice'; seqs: Record<PlayerId, { faces: number[]; status: DiceSeq['status'] }> }
```

`packages/core/src/cards/starter.ts`, in the `loaded-die` card, change `text: 'The first die of your next roll shows 6.',` to:

```ts
    id: 'loaded-die', name: 'Loaded Die', text: 'Your next die shows 6.',
```

(That keeps the line as `id: 'loaded-die', name: 'Loaded Die', text: '…',`. Only the text changes.)

- [ ] **Step 7: Update the test helpers and the remaining core tests**

`packages/core/test/support/fixtures.ts`, delete these two lines:

```ts
export const stop = (player: string) => (cur: MatchState): Input => ({ type: 'bonusChoice', player, rollAgain: false, windowId: cur.windowId });
export const again = (player: string) => (cur: MatchState): Input => ({ type: 'bonusChoice', player, rollAgain: true, windowId: cur.windowId });
```

`packages/core/test/support/randomPlay.ts`, replace the dice case with:

```ts
    case 'dice':
      return { type: 'roll', player, windowId: aw.windowId };
```

`packages/core/test/mystery.test.ts`:
- Import line: remove `again, ` and `stop, `, so it reads `import { drawValues, makeBoard, ofType, offerValues, pick, play, positions, reroll, roll, setup, timeout } from './support/fixtures';`.
- In `'does not re-trigger a Mystery tile for a player who did not move this round (D20)'`, change `play(s, [roll('p1'), roll('p2'), stop('p2')])` to `play(s, [roll('p1'), roll('p2')])`.
- In `twoEncounters`, change `[roll('p1'), roll('p2'), stop('p2')],` to `[roll('p1'), roll('p2')],`.
- Replace the body of `'resolves an epic Ladder Warp: move to the ladder foot, then climb'` with:

```ts
    const s = play(
      setup({ board, positions: [3, 0], dice: [[6], [1]], cards: [offerValues('ladder-warp', 'ladder-warp', 'ladder-warp')] }),
      [roll('p1'), roll('p2')],
    ).state;
    expect(positions(s)).toEqual([9, 1]);
    const { state } = play(s, [pick('p1', 0)]);
    expect(positions(state)).toEqual([50, 1]);
```

`packages/core/test/settle.test.ts`:
- Import line: change `import { again, choose, makeBoard, ofType, play, positions, roll, setup, timeout } from './support/fixtures';` to `import { choose, makeBoard, ofType, play, positions, roll, setup, timeout } from './support/fixtures';`.
- In `'the safety cap steps arrivals back to the nearest free tile after maxWaves'`, replace the first two lines of the body with:

```ts
    const s = setup({ players: 3, positions: [5, 6, 1], dice: [[5], [4], [6]], config: { collision: { maxWaves: 1 } } });
    const afterDice = play(s, [roll('p1'), roll('p2'), roll('p3')]).state;
```

(The rest of the test is unchanged: positions after dice are still `[10, 10, 7]`.)

`packages/core/test/view.test.ts`:
- Import line: remove `, stop`, so it reads `import { choose, makeBoard, offerValues, pick, play, roll, setup } from './support/fixtures';`.
- Change `[roll('p1'), roll('p2'), stop('p2'), roll('p3')],` to `[roll('p1'), roll('p2'), roll('p3')],`.
- Change `[roll('p1'), roll('p2'), stop('p2'), roll('p3'), pick('p1', 0)],` to `[roll('p1'), roll('p2'), roll('p3'), pick('p1', 0)],`.

- [ ] **Step 8: Update the simulator**

`packages/sim/src/bots.ts`, in `RandomBot.decide`, replace the dice block:

```ts
    if (phase.kind === 'dice') {
      const seq = phase.seqs[me];
      if (seq?.status === 'ready') return { type: 'roll', player: me, windowId: view.awaiting.windowId };
      if (seq?.status === 'bonusPending') return { type: 'bonusChoice', player: me, rollAgain: nextInt(this.rng, 2) === 0, windowId: view.awaiting.windowId };
      return 'idle';
    }
```

with:

```ts
    if (phase.kind === 'dice') {
      return phase.seqs[me]?.status === 'ready' ? { type: 'roll', player: me, windowId: view.awaiting.windowId } : 'idle';
    }
```

In `HeuristicBot`, change the doc comment `/** Avoids overshooting with bonus rolls, rerolls weak cards, picks the best-scoring card. */` to `/** Rerolls weak cards and picks the best-scoring card. */`. Then replace its dice block:

```ts
    if (phase.kind === 'dice') {
      const seq = phase.seqs[me];
      if (seq?.status === 'ready') return { type: 'roll', player: me, windowId: view.awaiting.windowId };
      if (seq?.status === 'bonusPending') {
        const pos = view.players.find((p) => p.id === me)!.position;
        const total = seq.faces.reduce((a, b) => a + b, 0);
        return { type: 'bonusChoice', player: me, rollAgain: pos + total + 6 <= view.board.size, windowId: view.awaiting.windowId };
      }
      return 'idle';
    }
```

with:

```ts
    if (phase.kind === 'dice') {
      return phase.seqs[me]?.status === 'ready' ? { type: 'roll', player: me, windowId: view.awaiting.windowId } : 'idle';
    }
```

`packages/sim/src/metrics.ts`:
- In `interface TimeModel`, delete `bonusSec: number;`. In `DEFAULT_TIME_MODEL`, delete `bonusSec: 2,`.
- In `matchMetrics`, delete `const roundsWithBonus = new Set<number>();` and `if (e.type === 'BonusChosen' && e.rollAgain) roundsWithBonus.add(round);`.
- In the `estimatedSeconds` expression, delete the line `roundsWithBonus.size * tm.bonusSec +`.

`packages/sim/test/bots.test.ts`, replace the test `'heuristic declines a bonus roll that could overshoot'` (from `it(` through its closing `});`) with:

```ts
  it('both policies roll when awaited and idle once they have rolled', () => {
    const s: MatchState = createMatch({ seed: 'b' }, seats);
    if (s.phase.kind === 'dice') s.phase.seqs['p1'] = { faces: [6], status: 'done' };
    for (const bot of [new RandomBot(createStream('r')), new HeuristicBot(createStream('h'), STARTER_CARDS)]) {
      expect(bot.decide(viewFor(s, 'p1'))).toBe('idle');
      expect(bot.decide(viewFor(s, 'p2'))).toEqual({ type: 'roll', player: 'p2', windowId: 1 });
    }
  });
```

- [ ] **Step 9: Run every test, then re-record the golden snapshots**

Run: `pnpm test`
Expected: everything passes except the three cases in `packages/core/test/golden.test.ts`, whose snapshots differ (expected, because the rules changed).

Re-record them: `pnpm vitest run packages/core/test/golden.test.ts -u`

Review the diff with `git diff packages/core/test/__snapshots__/golden.test.ts.snap`. The only acceptable kinds of change are:
- the `BonusChosen` entry disappears from `counts`;
- `DieRolled`, `DiceTotaled`, `Moved`, `rounds`, `steps`, `winner` and `hash` values change.

If any other event type appears or disappears, stop and investigate before continuing.

Then run: `pnpm test`
Expected: PASS (all core and sim tests).

- [ ] **Step 10: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. If `tsc` reports a leftover `bonusGrace`, `bonusPending`, `bonusChoice` or `BonusChosen` reference, remove it. As a final check, `git grep -n -i "bonus" -- packages/core/src packages/sim/src` should print nothing. Tests are excluded because they mention the removed input on purpose.

- [ ] **Step 11: Commit**

```bash
git add packages/core packages/sim
git commit -m "feat(core)!: one die per round; remove the bonus roll on a 6

Drops the bonusChoice input, the bonusGrace window, the bonusPending
status, the dice phase window field, the BonusChosen event and
windows.bonusGraceMs. Loaded Die now reads 'Your next die shows 6.'
Bots and the time model lose their bonus handling. Golden snapshots
re-recorded.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Old match logs fail cleanly in `sim replay`

**Files:**
- Modify: `packages/sim/src/cli.ts` (the `case 'replay':` block)
- Test: `packages/sim/test/cli.test.ts`

**Interfaces:**
- Consumes: `replayLog(log: MatchLog): { ok: boolean; hash: string; state: MatchState }` from `packages/sim/src/runner.ts`. It throws `Error('replay failed at <input JSON>: <code>')` when the engine rejects an input.
- Produces: `main(['replay', file])` prints `FAILED <reason>` and returns `1` when the replay throws.

- [ ] **Step 1: Write the failing test**

Add this test inside `describe(…)` in `packages/sim/test/cli.test.ts`:

```ts
  it('replay reports a log that no longer replays instead of crashing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sim-'));
    const legacy = {
      config: { seed: 'old' },
      seats: [{ id: 'p1' }, { id: 'p2' }],
      inputs: [
        { type: 'roll', player: 'p1', windowId: 1 },
        { type: 'bonusChoice', player: 'p1', rollAgain: true, windowId: 1 },
      ],
      finalHash: 'x',
    };
    writeFileSync(join(dir, 'legacy.json'), JSON.stringify(legacy));
    expect(main(['replay', join(dir, 'legacy.json')])).toBe(1);
    expect(output()).toMatch(/FAILED replay failed at .*bonusChoice.*INVALID_INPUT/);
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run packages/sim/test/cli.test.ts -t "no longer replays"`
Expected: FAIL. `main` throws `Error: replay failed at {"type":"bonusChoice",…}: INVALID_INPUT` instead of returning 1.

- [ ] **Step 3: Implement**

In `packages/sim/src/cli.ts`, replace the `case 'replay':` block with:

```ts
    case 'replay': {
      const file = rest[0];
      if (!file) throw new Error('replay needs a log file');
      const log = JSON.parse(readFileSync(file, 'utf8')) as MatchLog;
      let result: ReturnType<typeof replayLog>;
      try {
        result = replayLog(log);
      } catch (e) {
        // Logs recorded under older rules (e.g. with a removed input type) cannot replay at all.
        console.log(`FAILED ${e instanceof Error ? e.message : String(e)}`);
        return 1;
      }
      console.log(result.ok ? `OK ${result.hash}` : `MISMATCH expected ${log.finalHash}, got ${result.hash}`);
      return result.ok ? 0 : 1;
    }
```

- [ ] **Step 4: Run the CLI tests**

Run: `pnpm vitest run packages/sim/test/cli.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add packages/sim/src/cli.ts packages/sim/test/cli.test.ts
git commit -m "fix(sim): report logs that no longer replay instead of crashing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: One-die board analysis, tail horizon 70, generator version 2

**Files:**
- Modify: `packages/core/src/board/analysis.ts` (`ROUND_TOTALS` and its doc comment, lines 12–19)
- Modify: `packages/core/src/board/config.ts` (`DEFAULT_BOARD_CONFIG`)
- Modify: `packages/sim/src/cli.ts` (the `board` command's tail line)
- Test: `packages/core/test/analysis.test.ts`, `packages/core/test/generate.test.ts`, `packages/core/test/cards.test.ts`, `golden.test.ts` snapshot

**Interfaces:**
- Consumes: `analyzeBoard(board: Board, maxRounds?: number): BoardAnalysis`, `generateBoard(seed, cfg): { board; report }` with `report.attempts: number`.
- Produces: `DEFAULT_BOARD_CONFIG.generatorVersion === 2` and `DEFAULT_BOARD_CONFIG.analysis.maxRounds2p === 70`.

- [ ] **Step 1: Write the failing tests**

`packages/core/test/analysis.test.ts`, add inside `describe('analyzeBoard', …)`:

```ts
  it('models one die per round: a 6-tile board is finished in round 1 only by rolling a 6', () => {
    // Under the old bonus-roll model no round-1 total could land exactly on 6, so cdf[1] was 0.
    expect(analyzeBoard(makeBoard(6)).cdf[1]).toBeCloseTo(1 / 6, 12);
  });
```

In the same file's Monte-Carlo test, replace

```ts
        const d1 = rollDie(rng);
        const t = d1 === 6 ? 6 + rollDie(rng) : d1;
        pos = landingTile(board, pos, t);
```

with

```ts
        pos = landingTile(board, pos, rollDie(rng));
```

`packages/core/test/generate.test.ts`:
- In `'gives different boards for different seeds and generator versions'`, change `generatorVersion: 2` to `generatorVersion: 3`.
- Add inside `describe('generateBoard', …)`:

```ts
  it('accepts boards in under 2 attempts on average under the one-die model', () => {
    let attempts = 0;
    for (let i = 0; i < 200; i++) attempts += generateBoard(`calib-${i}`, cfg).report.attempts;
    expect(attempts / 200).toBeLessThan(2);
  });
```

`packages/core/test/cards.test.ts`, in `'fills spec §9 defaults'`, add after `expect(cfg.board.size).toBe(100);`:

```ts
    expect(cfg.board.generatorVersion).toBe(2);
    expect(cfg.board.analysis).toEqual({ median4pRounds: [15, 30], maxRounds2p: 70, maxTailProbability: 0.01 });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run packages/core/test/analysis.test.ts packages/core/test/generate.test.ts packages/core/test/cards.test.ts`
Expected: FAIL. `cdf[1]` is `0`. The Monte-Carlo test now disagrees with the two-dice model (the mean is about 15% off). `generatorVersion` is `1` and `maxRounds2p` is `60`.

- [ ] **Step 3: Implement**

`packages/core/src/board/analysis.ts`, replace lines 12–19 (the doc comment and `ROUND_TOTALS`) with:

```ts
/**
 * One round of dice-only movement (spec §7.3, amended 2026-10-04): a single
 * die, so totals 1..6 each have p = 1/6.
 */
const ROUND_TOTALS: ReadonlyArray<readonly [total: number, p: number]> = [
  [1, 1 / 6], [2, 1 / 6], [3, 1 / 6], [4, 1 / 6], [5, 1 / 6], [6, 1 / 6],
];
```

`packages/core/src/board/config.ts`, in `DEFAULT_BOARD_CONFIG`:
- Change `generatorVersion: 1,` to `generatorVersion: 2,`.
- Change `analysis: { median4pRounds: [15, 30], maxRounds2p: 60, maxTailProbability: 0.01 },` to `analysis: { median4pRounds: [15, 30], maxRounds2p: 70, maxTailProbability: 0.01 },`.

`packages/sim/src/cli.ts`, in the `board` command, replace the hard-coded `P(2p > 60 rounds)` in the template string with the configured horizon:

```ts
        `Median first finish: 4p ${report.analysis.median4p} rounds, 2p ${report.analysis.median2p} rounds; P(2p > ${DEFAULT_BOARD_CONFIG.analysis.maxRounds2p} rounds) = ${(report.analysis.tail2p * 100).toFixed(2)}%`,
```

- [ ] **Step 4: Run the tests, then re-record the golden snapshots**

Run: `pnpm test`
Expected: everything passes except `packages/core/test/golden.test.ts`. Golden matches use generated boards, and those change with the new acceptance rule and version.

Re-record: `pnpm vitest run packages/core/test/golden.test.ts -u`, then review `git diff packages/core/test/__snapshots__/golden.test.ts.snap`. Values may change, but no event type may appear or disappear (there is no `BonusChosen` since Task 2).

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS, no errors.

- [ ] **Step 5: Check the board command by hand**

Run: `pnpm sim board --seed daily-2026-10-04`
Expected: an ASCII board, then `Attempts: …`, then a line containing `P(2p > 70 rounds)` with a value below `1.00%`.

- [ ] **Step 6: Commit**

```bash
git add packages/core packages/sim
git commit -m "feat(core)!: one-die board analysis, tail horizon 70, generator v2

The Markov model now uses a single die (totals 1-6). maxRounds2p scales
from 60 to 70 with the slower pace, keeping today's board variety, and
generatorVersion becomes 2 so a seed and version still map to one board.
Golden snapshots re-recorded.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Spec #1 text, simulator check, and final gate

**Files:**
- Modify: `docs/superpowers/specs/2026-10-03-game-core-design.md`
- Modify: `docs/superpowers/specs/2026-10-04-remove-bonus-roll-design.md` (§7 wording and a new results section)

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: Spec #1 matches the code.

- [ ] **Step 1: Edit Spec #1 in place**

In `docs/superpowers/specs/2026-10-03-game-core-design.md`, make these exact replacements.

Under the title block, after the line `- **Scope:** Sub-project 1 of 6 (see §1.2)`, add:

```markdown
- **Amended:** 2026-10-04 — bonus roll removed ([amendment](2026-10-04-remove-bonus-roll-design.md))
```

§2, D10 row: replace `FACE effects modify single dice before the 6-check;` with `FACE effects modify single dice as they are rolled;`.

§2, D13 row: replace the whole row with:

```markdown
| D13 | Bonus roll | **None** (amended 2026-10-04). Every player rolls one die per round. Extra rolls come only from cards (sub-project c). |
```

§3.3 inputs table: replace the row `` | `roll { player }` | player | Roll the next die of the sequence | `` with `` | `roll { player }` | player | Roll your one die for this round | ``. Delete the row `` | `bonusChoice { player, rollAgain }` | player | After a 6: roll again or stop | ``.

§3.4: replace `` `window ∈ dice | bonusGrace | challenge | mystery | none` `` with `` `window ∈ dice | challenge | mystery | none` ``.

§4.3: replace everything from the heading `### 4.3 Dice phase (window: \`dice\`, default 12 s)` up to (not including) `### 4.4 Movement` with:

```markdown
### 4.3 Dice phase (window: `dice`, default 12 s) — amended 2026-10-04

1. Every player rolls one die, independently and simultaneously.
2. FACE-stage effects (§5.6) apply to the die as it is rolled.
3. On `dice` window expiry, players who have not rolled are auto-rolled once. The phase then ends; there is no grace window.
4. Total = the die face, then TOTAL-stage effects in order **Replace → Multiply → Add**, then floored at 0. "Next roll" effects are consumed here.
5. The phase ends when every player has rolled.

```

§5.5 hook table: replace `` | `diceFace` | Each die, before the 6-check | "Next die shows 6" | `` with `` | `diceFace` | Each die, as it is rolled | "Next die shows 6" | ``.

§5.6: replace `1. **FACE stage:** per die, before the 6-check. Multiple FACE effects apply in \`seq\` order.` with `1. **FACE stage:** per die, as it is rolled. Multiple FACE effects apply in \`seq\` order.`.

§6 table, row 2: replace it with:

```markdown
| 2 | Loaded Die | Movement | Rare | self | Your next die shows 6 (1 charge) | FACE stage |
```

§7.3: replace `- States: positions \`0..N\` for one player, dice only: bonus roll always taken (max 2 dice), bounce, jumps. No cards, no collisions.` with `- States: positions \`0..N\` for one player, dice only: one die per round (totals 1–6, p = 1/6 each), bounce, jumps. No cards, no collisions.`. Replace `  - P(first-finish > 60 rounds) for 2 players < 1%.` with `  - P(first-finish > 70 rounds) for 2 players < 1% (60 before the 2026-10-04 amendment).`.

§8.1: replace the `heuristic` bullet with:

```markdown
- **`heuristic`** — scores cards by approximate expected tile gain; rerolls the weakest card if its score is below a threshold; RPS/Minority picks are random.
```

§8.4: replace `dice phase 6 s, bonus decision 2 s, movement 2 s,` with `dice phase 6 s, movement 2 s,`.

§9 config block: replace `  windows: { diceMs: 12000; bonusGraceMs: 5000; challengeMs: 8000; mysteryMs: 15000 };` with `  windows: { diceMs: 12000; challengeMs: 8000; mysteryMs: 15000 };`. Replace `  generatorVersion: 1;` with `  generatorVersion: 2;`. Replace `  analysis: { median4pRounds: [15, 30]; maxRounds2p: 60; maxTailProbability: 0.01 };` with `  analysis: { median4pRounds: [15, 30]; maxRounds2p: 70; maxTailProbability: 0.01 };`.

§11: replace `- Dice sequences: optional bonus, max 2 dice, auto-roll, grace window, two-stage modifier order.` with `- Dice: one die per player, auto-roll on expiry, two-stage modifier order.`.

Appendix A: delete the row `` | `BonusChosen` | public | player, rollAgain | ``.

Then check: `git grep -n -i "bonus" docs/superpowers/specs/2026-10-03-game-core-design.md` should print only the D13 row and the "Amended" header line.

- [ ] **Step 2: Run the 1,000-match simulator check**

Run: `pnpm sim run --matches 1000 --players 4 --policy heuristic --seed amendment-check`
Expected:
- The `Board generation:` line shows `attempts mean` below 2 and no error.
- `Rounds (p10/med/p90)` has a median of roughly 19–22.
- `Minutes est.` has a median of roughly 6.5–7.5.

Write down the exact `Rounds`, `Minutes est.` and `Board generation` lines for the next step. If the generation line shows a `GenerationError`, or the mean attempts are 2 or more, stop and report back. That would contradict spec §8.

- [ ] **Step 3: Record the results in the amendment and fix its replay wording**

In `docs/superpowers/specs/2026-10-04-remove-bonus-roll-design.md`:
- Change the `Status` line to `- **Status:** Approved and implemented`.
- In §7, replace `` `sim replay` reports a hash mismatch for them. `` with `` `sim replay` reports them as `FAILED` (a removed input) or `MISMATCH` (a different hash) and exits with code 1. ``.
- Add a new section at the end, filling in the three lines copied in Step 2:

```markdown
## 11. Results (1,000 four-player heuristic matches, seed `amendment-check`)

| Measure | Before (400 matches, bonus roll) | After |
|---|---|---|
| Rounds p10 / median / p90 | 12 / 18 / 26 | <copied from Step 2> |
| Estimated minutes p10 / median / p90 | 4.0 / 6.3 / 9.3 | <copied from Step 2> |
| Board generation attempts mean / max | 1.17 / 3 | <copied from Step 2> |
```

Replace each `<copied from Step 2>` with the real numbers. The committed file must not contain that placeholder.

- [ ] **Step 4: Final gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && git grep -n -i "bonus" -- packages/core/src packages/sim/src`
Expected: tests, typecheck and lint pass, and the final `git grep` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-10-03-game-core-design.md docs/superpowers/specs/2026-10-04-remove-bonus-roll-design.md
git commit -m "docs: apply the bonus-roll amendment to spec #1 and record results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
