# Phase 3 — Director and Presentation State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For this project: executing-plans, inline, no subagents.

**Goal:** The dev page plays each match update as a timeline of beats on a flat 2D board, calls `playbackDone` when the timeline ends instead of at once, and the host's window timers wait for it.

**Architecture:** A new `src/director/` folder of plain TypeScript (spec §4.1). `presentation.ts` defines the state the board shows (positions, stack order, face-offs, effects, board edits, jumps) and derives it from a `PlayerView`. `beats.ts` turns one update's events into beats (§5.1), each carrying its duration and the presentation it leaves behind. `director.ts` plays updates through those beats one at a time on a Zustand vanilla store. At the end of each timeline the view wins (§5.2), with a dev warning if they differ, and `playbackDone` goes out for the window that update opened. More than 3 waiting updates fast-forward. The dev page renders the store as a flat SVG board; Phase 4 replaces that with the 3D scene.

**Tech Stack:** TypeScript 6 (strict), React 19, Zustand 5 (`zustand/vanilla` in the director, `useStore` in React), Vitest 5 with fake timers and jsdom, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-3d-client-design.md` (§5.1 beats, §5.2 presentation state; §4.1 for the folder; §9.1 for the director tests). Phase index: `docs/superpowers/plans/2026-10-04-3d-client-phases.md`.

**How this plan was run:** on 2026-10-04 the user asked to continue through Phase 6 without stopping (memory `continue-through-phase-6`), so this plan is executed straight after it is written and merged locally when done.

## Global Constraints

- The director is plain TypeScript in `src/director/`, with no React (§4.1). React reads its Zustand store with `useStore`. UI and presentation state use Zustand stores (§4.1).
- Beat durations are the §5.1 starting values, kept in one exported table (`BEAT_MS`): die 0.9 s; dice hops 0.23 s per tile + 0.07 s landing; slide 2.0 s; launch 1.3 s; knockback 0.85 s; card move 0.8 s; step back 0.3 s per tile; snake blocked 0.6 s; face-off 0.5 s; face-off result 1.1 s; card reveal 1.7 s; card resolution 0.9–2 s; board edit 0.6 s; victory 3 s. Zero for events that only change the HUD.
- Simultaneous moves share a beat (§5.1). Card resolutions get one beat per card, in resolution order.
- §5.2: when a timeline ends, the presentation state is replaced by the one derived from `view`; if they differ, the view wins and a dev warning is logged. When the last beat of an update finishes, `playbackDone(windowId)` goes out for the window that update opened. An update that arrives mid-timeline queues; more than 3 queued updates fast-forward to the latest view.
- Only the human seat's events are ever played. Another player's private event is dropped even if one arrived (§4.2).
- Colours come only from tokens: board colours in `src/app/theme.ts` (§6.1, §7.4), page colours as CSS custom properties.
- No three.js, React Three Fiber or drei yet (Phase 4).
- pnpm 11 refuses releases younger than a day: `pnpm add` uses caret ranges with an old-enough floor. CI runs `pnpm install --frozen-lockfile`, so lockfile changes are committed with their task.
- Commit messages end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run every command from the repository root `E:\AI Project\laddorious`, on branch `client/phase-3`. Work inline with no subagents; every review is a self-review.
- Carried over from Phase 2: read test counts with `pnpm test 2>&1 | grep -E "Test Files|Tests "` (Vitest 5 prints a hint after the summary), and accept `Cannot find module` as the failing-import message.

## Review Focus

1. **An update arrives while a long timeline plays** (a bot rolls during a 2 s slide). Expected: it waits its turn and plays after; nothing is lost. Pinned in Task 3 ("queues an update that arrives mid-timeline").
2. **The page falls far behind** (a slow phone, a backgrounded tab). Expected: more than 3 waiting updates jump straight to the latest view, and the current window still gets its `playbackDone`, so the match never stalls. Pinned in Task 3 ("fast-forwards to the latest view").
3. **An event the director doesn't model changes the board.** Expected: the board is never left wrong. The view wins at the end of every timeline, with a dev warning. Pinned in Task 3: the drift test, plus a whole real match through the director with no warning at all.
4. **Leaving mid-timeline.** Expected: no beat and no `playbackDone` fire after Leave. Pinned in Task 3 ("stops playing when disposed") and Task 4 (Leave disposes the director).
5. **Another player's private event reaches the director** (a future server bug). Expected: it is never shown. Pinned in Task 2 ("keeps a private event for its owner").

## Interpretation notes

- **Moves caused by `'effect'`** (an after-move card effect; `MoveCause` has it, the §5.1 table doesn't) play like card moves.
- **Card moves come after the stamps.** The engine emits all of a card group's `CardResolved` events before its `Moved(card)` events. So each card gets its stamp beat, and the group's moves then hop together in one card-move beat.
- **Dice faces, lock badges and card chips are not presentation state.** The view no longer holds this round's dice once the dice phase ends, so the board-facing presentation stays to what the view can confirm. Phase 5's HUD reads those facts from the beats.
- **Effects are compared by id.** The engine spends shield charges in place without an event, so comparing whole effect objects would warn falsely. The view's copy wins at every snap anyway.

---

## Before Task 1: commit the plan

The plan, the Phase 3 row of the phase index and the handoff note were written with the plan.

- [ ] **Commit them**

```bash
git add docs/superpowers/plans/2026-10-04-client-phase-3-director.md docs/superpowers/plans/2026-10-04-3d-client-phases.md docs/superpowers/HANDOFF.md
git commit -m "docs: add the phase 3 plan (director and presentation state)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: The presentation state

**Files:**
- Create: `apps/client/src/director/presentation.ts`, `apps/client/test/presentation.test.ts`

**Interfaces:**
- Consumes: `PlayerView`, `GameEvent`, `ActiveEffect`, `BoardEdit`, `Jump`, `PlayerId` from `@laddorious/core`; `openingUpdate()` from `test/support/fixtures.ts` (Phase 2).
- Produces:
  - `interface FaceOff { challengeId: string; tile: number; players: PlayerId[] }`.
  - `interface PresentationState { round: number; positions: Record<PlayerId, number>; arrivals: PlayerId[]; effects: ActiveEffect[]; boardEdits: BoardEdit[]; jumps: Jump[]; faceOffs: FaceOff[] }`.
  - `presentationFromView(view: PlayerView, arrivals?: PlayerId[]): PresentationState`.
  - `applyEvent(state: PresentationState, event: GameEvent): PresentationState`, which never mutates its input.
  - `samePresentation(a: PresentationState, b: PresentationState): boolean`.
  - `stackOn(state: PresentationState, tile: number): PlayerId[]`, bottom of the stack first.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/presentation.test.ts`:

```ts
import type { ActiveEffect, PlayerView } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { presentationFromView, samePresentation, stackOn } from '../src/director/presentation';
import { openingUpdate } from './support/fixtures';

/** The fixture's opening view with some pieces moved. */
function viewWith(positions: Record<string, number>): PlayerView {
  const { view } = openingUpdate();
  return { ...view, players: view.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })) };
}

const shield = (charges: number): ActiveEffect => ({
  id: 'e1',
  owner: 'p0',
  sourceCard: 'snake-charm',
  sourcePlayer: 'p0',
  params: { hook: 'beforeSnake' },
  lifetime: { rounds: 3, charges },
  createdRound: 1,
  seq: 1,
});

describe('presentationFromView', () => {
  it('takes the round, positions, effects, board edits and jumps from the view', () => {
    const view = viewWith({ p1: 14 });
    const shown = presentationFromView(view);
    expect(shown.round).toBe(1);
    expect(shown.positions).toEqual({ p0: 0, p1: 14, p2: 0, p3: 0 });
    expect(shown.arrivals).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(shown.jumps).toEqual(view.board.jumps);
    expect(shown.effects).toEqual([]);
    expect(shown.boardEdits).toEqual([]);
    expect(shown.faceOffs).toEqual([]);
  });

  it('keeps the given stack order and shows only undecided face-offs', () => {
    const view: PlayerView = {
      ...viewWith({ p0: 6, p1: 6, p2: 9, p3: 9 }),
      phase: {
        kind: 'settle',
        challenges: [
          { id: 'c1', tile: 6, participants: ['p0', 'p1'], contesting: ['p0', 'p1'], kind: 'rps', theme: null, pickRound: 1, picked: [], winner: null },
          { id: 'c2', tile: 9, participants: ['p2', 'p3'], contesting: ['p2', 'p3'], kind: 'rps', theme: null, pickRound: 1, picked: [], winner: 'p3' },
        ],
      },
    };
    const shown = presentationFromView(view, ['p3', 'p1', 'p0']);
    expect(shown.arrivals).toEqual(['p3', 'p1', 'p0', 'p2']);
    expect(shown.faceOffs).toEqual([{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'] }]);
    expect(stackOn(shown, 6)).toEqual(['p1', 'p0']);
  });
});

describe('samePresentation', () => {
  it('ignores stack order and spent shield charges, but not positions', () => {
    const view = viewWith({ p1: 14 });
    const a = presentationFromView({ ...view, effects: [shield(2)] }, ['p0', 'p1', 'p2', 'p3']);
    const b = presentationFromView({ ...view, effects: [shield(1)] }, ['p3', 'p2', 'p1', 'p0']);
    expect(samePresentation(a, b)).toBe(true);
    expect(samePresentation(a, presentationFromView({ ...viewWith({ p1: 15 }), effects: [shield(2)] }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/presentation.test.ts`
Expected: FAIL with `Cannot find module '../src/director/presentation'`.

- [ ] **Step 3: Implement the presentation state**

Create `apps/client/src/director/presentation.ts`:

```ts
import type { ActiveEffect, BoardEdit, GameEvent, Jump, PlayerId, PlayerView } from '@laddorious/core';

/** A face-off in progress: its pieces stand side by side instead of stacked (spec #2 §5.1). */
export interface FaceOff {
  challengeId: string;
  tile: number;
  players: PlayerId[];
}

/**
 * What the board shows (spec #2 §5.2). Beats animate it, and it is reset to the
 * engine's view at the end of every timeline.
 */
export interface PresentationState {
  round: number;
  /** Tile per player; 0 is the off-board start. */
  positions: Record<PlayerId, number>;
  /** Players in order of their latest move: on a shared tile, later arrivals stand on top. */
  arrivals: PlayerId[];
  effects: ActiveEffect[];
  boardEdits: BoardEdit[];
  jumps: Jump[];
  faceOffs: FaceOff[];
}

/** The presentation a view implies. Stack order isn't in the view, so `arrivals` keeps it where it can. */
export function presentationFromView(view: PlayerView, arrivals: PlayerId[] = []): PresentationState {
  const ids = view.players.map((p) => p.id);
  return {
    round: view.round,
    positions: Object.fromEntries(view.players.map((p) => [p.id, p.position])),
    arrivals: [...arrivals.filter((id) => ids.includes(id)), ...ids.filter((id) => !arrivals.includes(id))],
    effects: view.effects,
    boardEdits: view.boardEdits,
    jumps: view.board.jumps,
    faceOffs:
      view.phase.kind === 'settle'
        ? view.phase.challenges
            .filter((c) => c.winner === null)
            .map((c) => ({ challengeId: c.id, tile: c.tile, players: [...c.participants] }))
        : [],
  };
}

/** The presentation after one event. Never mutates its input. */
export function applyEvent(state: PresentationState, event: GameEvent): PresentationState {
  switch (event.type) {
    case 'RoundStarted':
      return { ...state, round: event.round };
    case 'Moved':
      return {
        ...state,
        positions: { ...state.positions, [event.player]: event.to },
        arrivals: [...state.arrivals.filter((id) => id !== event.player), event.player],
      };
    case 'ChallengeStarted':
      return { ...state, faceOffs: [...state.faceOffs, { challengeId: event.challengeId, tile: event.tile, players: [...event.players] }] };
    case 'ChallengeResolved':
      return event.winner === null ? state : { ...state, faceOffs: state.faceOffs.filter((f) => f.challengeId !== event.challengeId) };
    case 'EffectAdded':
      return { ...state, effects: [...state.effects, event.effect] };
    case 'EffectRemoved':
    case 'EffectExpired':
      return { ...state, effects: state.effects.filter((e) => e.id !== event.effectId) };
    case 'BoardEdited': {
      const removed = new Set(event.edit.removed.map((j) => j.id));
      return {
        ...state,
        boardEdits: [...state.boardEdits, event.edit],
        jumps: [...state.jumps.filter((j) => !removed.has(j.id)), ...event.edit.added],
      };
    }
    case 'BoardEditExpired': {
      const edit = state.boardEdits.find((e) => e.id === event.editId);
      if (!edit) return state;
      const added = new Set(edit.added.map((j) => j.id));
      return {
        ...state,
        boardEdits: state.boardEdits.filter((e) => e.id !== event.editId),
        jumps: [...state.jumps.filter((j) => !added.has(j.id)), ...edit.removed.filter((j) => event.restored.includes(j.id))],
      };
    }
    default:
      return state;
  }
}

/**
 * Do two presentations show the same board? Stack order is the director's own, and the
 * engine spends effect charges in place without an event, so effects compare by id.
 */
export function samePresentation(a: PresentationState, b: PresentationState): boolean {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}

function comparable(s: PresentationState) {
  return {
    round: s.round,
    positions: Object.entries(s.positions).sort(([x], [y]) => x.localeCompare(y)),
    effects: s.effects.map((e) => e.id).sort(),
    boardEdits: s.boardEdits.map((e) => e.id).sort(),
    jumps: s.jumps.map((j) => `${j.id}:${j.from}>${j.to}`).sort(),
    faceOffs: s.faceOffs.map((f) => `${f.challengeId}@${f.tile}:${f.players.join(',')}`).sort(),
  };
}

/** The players standing on a tile, bottom of the stack first. */
export function stackOn(state: PresentationState, tile: number): PlayerId[] {
  return state.arrivals.filter((id) => state.positions[id] === tile);
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/presentation.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  31 passed (31)` and `Tests  227 passed (227)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): derive the presentation state from a player view

Positions, stack order, face-offs, effects, board edits and jumps: the
state the board shows (spec #2 §5.2), with the event rules that move it
and a comparison that ignores what the view cannot confirm.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Beat timelines

**Files:**
- Create: `apps/client/src/director/beats.ts`, `apps/client/test/beats.test.ts`

**Interfaces:**
- Consumes: `applyEvent`, `presentationFromView`, `stackOn` and `PresentationState` (Task 1); `GameEvent`, `MoveCause`, `CardResult`, `PlayerId` from `@laddorious/core`.
- Produces:
  - `type BeatKind = 'roll' | 'move' | 'slide' | 'launch' | 'knockback' | 'cardMove' | 'stepBack' | 'snakeBlocked' | 'faceOff' | 'faceOffResult' | 'cardReveal' | 'cardResolved' | 'clash' | 'boardEdit' | 'victory' | 'info'`.
  - `interface Beat { kind: BeatKind; durationMs: number; events: GameEvent[]; after: PresentationState }`.
  - `BEAT_MS`, the duration table, with fields `roll`, `hopPerTile`, `landing`, `slide`, `launch`, `knockback`, `cardMove`, `stepBackPerTile`, `snakeBlocked`, `faceOff`, `faceOffResult`, `cardReveal`, `card: Record<CardResult, number>`, `clash`, `boardEdit` and `victory`.
  - `buildTimeline(events: GameEvent[], start: PresentationState, me: PlayerId, boardSize: number): Beat[]`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/beats.test.ts`:

```ts
import type { BoardEdit, GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BEAT_MS, buildTimeline } from '../src/director/beats';
import { presentationFromView, stackOn, type PresentationState } from '../src/director/presentation';
import { openingUpdate } from './support/fixtures';

const SIZE = 100;

/** Round 1 of the fixture's board, with some pieces moved. */
function start(positions: Record<PlayerId, number> = {}): PresentationState {
  const shown = presentationFromView(openingUpdate().view);
  return { ...shown, positions: { ...shown.positions, ...positions } };
}

function moved(player: PlayerId, from: number, to: number, cause: MoveCause = 'dice', bounced = false): GameEvent {
  return { type: 'Moved', player, from, to, cause, bounced, visibility: 'public' };
}

const hops = (tiles: number) => tiles * BEAT_MS.hopPerTile + BEAT_MS.landing;

describe('buildTimeline', () => {
  it('rolls the dice of one update together', () => {
    const roll = (player: PlayerId, face: number): GameEvent => ({ type: 'DieRolled', player, natural: face, face, forced: false, auto: true, visibility: 'public' });
    const beats = buildTimeline([roll('p0', 3), roll('p1', 6)], start(), 'p0', SIZE);
    expect(beats.map((b) => [b.kind, b.durationMs, b.events.length])).toEqual([['roll', BEAT_MS.roll, 2]]);
  });

  it('lets every dice move hop together, timed by the longest', () => {
    const beats = buildTimeline([moved('p0', 0, 3), moved('p1', 0, 5)], start(), 'p0', SIZE);
    expect(beats).toHaveLength(1);
    expect(beats[0]!.kind).toBe('move');
    expect(beats[0]!.durationMs).toBe(hops(5));
    expect(beats[0]!.after.positions).toMatchObject({ p0: 3, p1: 5 });
  });

  it('times a bounce as the way up to the last tile and back', () => {
    const beats = buildTimeline([moved('p0', 97, 98, 'dice', true)], start({ p0: 97 }), 'p0', SIZE);
    expect(beats[0]!.durationMs).toBe(hops(3 + 2));
  });

  it('plays the chain dice move, slide, face-off, knockback and second slide as separate beats', () => {
    const chain: GameEvent[] = [
      moved('p0', 10, 16),
      moved('p0', 16, 6, 'snake'),
      { type: 'ChallengeStarted', challengeId: 'c1', tile: 6, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' },
      { type: 'ChallengeResolved', challengeId: 'c1', pickRound: 1, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win', visibility: 'public' },
      moved('p0', 6, 3, 'knockback'),
      moved('p0', 3, 1, 'snake'),
    ];
    const beats = buildTimeline(chain, start({ p0: 10, p1: 6 }), 'p0', SIZE);
    expect(beats.map((b) => b.kind)).toEqual(['move', 'slide', 'faceOff', 'faceOffResult', 'knockback', 'slide']);
    expect(beats.map((b) => b.durationMs)).toEqual([hops(6), BEAT_MS.slide, BEAT_MS.faceOff, BEAT_MS.faceOffResult, BEAT_MS.knockback, BEAT_MS.slide]);
    expect(beats[2]!.after.faceOffs).toEqual([{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'] }]);
    expect(beats[3]!.after.faceOffs).toEqual([]);
    expect(beats[5]!.after.positions.p0).toBe(1);
  });

  it('starts a new beat when a piece moves twice, and lets different pieces slide together', () => {
    const beats = buildTimeline(
      [moved('p0', 4, 14, 'ladder'), moved('p0', 14, 31, 'ladder'), moved('p1', 20, 2, 'snake'), moved('p2', 40, 22, 'snake')],
      start({ p0: 4, p1: 20, p2: 40 }),
      'p0',
      SIZE,
    );
    expect(beats.map((b) => [b.kind, b.events.length])).toEqual([
      ['launch', 1],
      ['launch', 1],
      ['slide', 2],
    ]);
  });

  it('stacks a piece that lands on an occupied tile on top', () => {
    const [beat] = buildTimeline([moved('p0', 1, 4)], start({ p0: 1, p1: 4 }), 'p0', SIZE);
    expect(stackOn(beat!.after, 4)).toEqual(['p1', 'p0']);
  });

  it('shows a blocked snake as its own beat and leaves the piece on the snake head', () => {
    const beats = buildTimeline(
      [
        moved('p0', 10, 16),
        { type: 'SnakeBlocked', player: 'p0', tile: 16, effectId: 'e5', visibility: 'public' },
        { type: 'EffectRemoved', effectId: 'e5', owner: 'p0', reason: 'charges', visibility: 'public' },
      ],
      start({ p0: 10 }),
      'p0',
      SIZE,
    );
    expect(beats.map((b) => [b.kind, b.durationMs])).toEqual([
      ['move', hops(6)],
      ['snakeBlocked', BEAT_MS.snakeBlocked],
      ['info', 0],
    ]);
    expect(beats[2]!.after.positions.p0).toBe(16);
  });

  it("keeps a private event for its owner and drops another player's", () => {
    const offer = (player: PlayerId): GameEvent => ({ type: 'MysteryOffered', player, tile: 23, rarity: 'common', cards: ['sprint', 'shove', 'cleanse'], visibility: { private: player } });
    const beats = buildTimeline([offer('p0'), offer('p1')], start(), 'p0', SIZE);
    expect(beats).toHaveLength(1);
    expect(beats[0]!.events).toEqual([offer('p0')]);
  });

  it('reveals the picked cards together, gives each card its own beat in order, then moves the targets', () => {
    const events: GameEvent[] = [
      { type: 'CardSelected', player: 'p0', cardId: 'sprint', cardType: 'movement', rarity: 'common', auto: false, visibility: 'public' },
      { type: 'CardSelected', player: 'p1', cardId: 'shove', cardType: 'attack', rarity: 'common', auto: true, visibility: 'public' },
      { type: 'CardResolved', caster: 'p0', cardId: 'sprint', target: 'p0', result: 'hit', visibility: 'public' },
      { type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p2', result: 'blocked', visibility: 'public' },
      moved('p0', 20, 23, 'card'),
    ];
    const beats = buildTimeline(events, start({ p0: 20 }), 'p0', SIZE);
    expect(beats.map((b) => [b.kind, b.durationMs])).toEqual([
      ['cardReveal', BEAT_MS.cardReveal],
      ['cardResolved', BEAT_MS.card.hit],
      ['cardResolved', BEAT_MS.card.blocked],
      ['cardMove', BEAT_MS.cardMove],
    ]);
    expect(beats[1]!.events[0]).toMatchObject({ caster: 'p0' });
    expect(beats[2]!.events[0]).toMatchObject({ caster: 'p1' });
  });

  it('ends a won match with the victory beat', () => {
    const rankings = [{ player: 'p0', rank: 1, position: 100 }];
    const beats = buildTimeline(
      [moved('p0', 96, 100), { type: 'RoundEnded', round: 9, visibility: 'public' }, { type: 'MatchWon', winner: 'p0', rankings, visibility: 'public' }],
      start({ p0: 96 }),
      'p0',
      SIZE,
    );
    expect(beats.map((b) => b.kind)).toEqual(['move', 'info', 'victory']);
    expect(beats.at(-1)!.durationMs).toBe(BEAT_MS.victory);
  });

  it('adds a board edit, then reverts it when it expires', () => {
    const base = start();
    const removed = base.jumps[0]!;
    const added = { id: 'x9a', from: 50, to: 71 };
    const edit: BoardEdit = { id: 'x9', added: [added], removed: [removed], lifetime: { rounds: 2 }, createdRound: 1, sourceCard: 'ladder-warp', sourcePlayer: 'p0' };
    const [made] = buildTimeline([{ type: 'BoardEdited', edit, visibility: 'public' }], base, 'p0', SIZE);
    expect(made!.kind).toBe('boardEdit');
    expect(made!.durationMs).toBe(BEAT_MS.boardEdit);
    expect(made!.after.jumps).toContainEqual(added);
    expect(made!.after.jumps).not.toContainEqual(removed);
    const [expired] = buildTimeline([{ type: 'BoardEditExpired', editId: 'x9', restored: [removed.id], dropped: [], visibility: 'public' }], made!.after, 'p0', SIZE);
    expect(expired!.after.jumps).toContainEqual(removed);
    expect(expired!.after.jumps).not.toContainEqual(added);
    expect(expired!.after.boardEdits).toEqual([]);
  });

  it('gives HUD-only events no time but still applies them', () => {
    const beats = buildTimeline(
      [
        { type: 'RoundStarted', round: 2, visibility: 'public' },
        { type: 'WindowOpened', windowId: 5, window: 'dice', players: ['p0', 'p1'], durationMs: 12_000, visibility: 'public' },
      ],
      start(),
      'p0',
      SIZE,
    );
    expect(beats).toHaveLength(1);
    expect(beats[0]).toMatchObject({ kind: 'info', durationMs: 0 });
    expect(beats[0]!.after.round).toBe(2);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/beats.test.ts`
Expected: FAIL with `Cannot find module '../src/director/beats'`.

- [ ] **Step 3: Implement the timeline builder**

Create `apps/client/src/director/beats.ts`:

```ts
import type { CardResult, GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { applyEvent, type PresentationState } from './presentation';

export type BeatKind =
  | 'roll'
  | 'move'
  | 'slide'
  | 'launch'
  | 'knockback'
  | 'cardMove'
  | 'stepBack'
  | 'snakeBlocked'
  | 'faceOff'
  | 'faceOffResult'
  | 'cardReveal'
  | 'cardResolved'
  | 'clash'
  | 'boardEdit'
  | 'victory'
  | 'info';

/** One step of an update's playback (spec #2 §5.1). */
export interface Beat {
  kind: BeatKind;
  durationMs: number;
  /** The events this beat shows, in engine order. */
  events: GameEvent[];
  /** The presentation once the beat has played. */
  after: PresentationState;
}

/** Starting durations from spec #2 §5.1, to be tuned against the 3D scene. */
export const BEAT_MS = {
  roll: 900,
  hopPerTile: 230,
  landing: 70,
  slide: 2000,
  launch: 1300,
  knockback: 850,
  cardMove: 800,
  stepBackPerTile: 300,
  snakeBlocked: 600,
  faceOff: 500,
  faceOffResult: 1100,
  cardReveal: 1700,
  card: { hit: 1400, blocked: 1200, fizzled: 900 } satisfies Record<CardResult, number>,
  clash: 900,
  boardEdit: 600,
  victory: 3000,
} as const;

/** 'effect' moves come from after-move card effects; they play like card moves. */
const MOVE_KIND: Record<MoveCause, BeatKind> = {
  dice: 'move',
  snake: 'slide',
  ladder: 'launch',
  knockback: 'knockback',
  card: 'cardMove',
  effect: 'cardMove',
  stepBack: 'stepBack',
};

function kindOf(event: GameEvent): BeatKind {
  switch (event.type) {
    case 'DieRolled':
      return 'roll';
    case 'Moved':
      return MOVE_KIND[event.cause];
    case 'SnakeBlocked':
      return 'snakeBlocked';
    case 'ChallengeStarted':
      return 'faceOff';
    case 'ChallengeResolved':
      return 'faceOffResult';
    case 'CardSelected':
      return 'cardReveal';
    case 'CardResolved':
      return 'cardResolved';
    case 'Clash':
      return 'clash';
    case 'BoardEdited':
    case 'BoardEditExpired':
      return 'boardEdit';
    case 'MatchWon':
      return 'victory';
    default:
      return 'info';
  }
}

/** The piece an event moves or rolls for: a piece appears at most once in a beat. */
function actorOf(event: GameEvent): PlayerId | null {
  return event.type === 'DieRolled' || event.type === 'Moved' || event.type === 'SnakeBlocked' ? event.player : null;
}

function joins(beat: Beat, kind: BeatKind, event: GameEvent): boolean {
  if (beat.kind !== kind || kind === 'cardResolved') return false;
  const actor = actorOf(event);
  return actor === null || !beat.events.some((e) => actorOf(e) === actor);
}

/**
 * Turn one update's events into beats (spec #2 §5.1). Simultaneous events of a kind share
 * a beat, so all dice moves hop together; each card resolution gets a beat of its own.
 * Another player's private events never reach a timeline.
 */
export function buildTimeline(events: GameEvent[], start: PresentationState, me: PlayerId, boardSize: number): Beat[] {
  const beats: Beat[] = [];
  let state = start;
  for (const event of events) {
    if (event.visibility !== 'public' && event.visibility.private !== me) continue;
    const kind = kindOf(event);
    const last = beats.at(-1);
    state = applyEvent(state, event);
    if (last && joins(last, kind, event)) {
      last.events.push(event);
      last.after = state;
    } else {
      beats.push({ kind, durationMs: 0, events: [event], after: state });
    }
  }
  for (const beat of beats) beat.durationMs = durationOf(beat, boardSize);
  return beats;
}

/** Tiles a move covers: a bounce runs up to the last tile and back. */
function tilesTravelled(event: GameEvent, boardSize: number): number {
  if (event.type !== 'Moved') return 0;
  return event.bounced ? boardSize - event.from + (boardSize - event.to) : Math.abs(event.to - event.from);
}

function durationOf(beat: Beat, boardSize: number): number {
  const longest = () => Math.max(...beat.events.map((e) => tilesTravelled(e, boardSize)));
  switch (beat.kind) {
    case 'roll':
      return BEAT_MS.roll;
    case 'move':
      return longest() * BEAT_MS.hopPerTile + BEAT_MS.landing;
    case 'stepBack':
      return longest() * BEAT_MS.stepBackPerTile;
    case 'slide':
      return BEAT_MS.slide;
    case 'launch':
      return BEAT_MS.launch;
    case 'knockback':
      return BEAT_MS.knockback;
    case 'cardMove':
      return BEAT_MS.cardMove;
    case 'snakeBlocked':
      return BEAT_MS.snakeBlocked;
    case 'faceOff':
      return BEAT_MS.faceOff;
    case 'faceOffResult':
      return BEAT_MS.faceOffResult;
    case 'cardReveal':
      return BEAT_MS.cardReveal;
    case 'cardResolved': {
      const resolved = beat.events[0];
      return resolved?.type === 'CardResolved' ? BEAT_MS.card[resolved.result] : 0;
    }
    case 'clash':
      return BEAT_MS.clash;
    case 'boardEdit':
      return BEAT_MS.boardEdit;
    case 'victory':
      return BEAT_MS.victory;
    case 'info':
      return 0;
  }
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/beats.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  32 passed (32)` and `Tests  239 passed (239)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): turn engine events into beat timelines

Each update's events become beats with the spec #2 §5.1 starting
durations: simultaneous moves hop together, each card resolution gets
its own beat, HUD-only events take no time, and another player's
private events are dropped.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The director

**Files:**
- Create: `apps/client/src/director/director.ts`, `apps/client/test/director.test.ts`
- Modify: `apps/client/package.json` (zustand, through `pnpm add`), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `buildTimeline`, `Beat` and `BEAT_MS` (Task 2); `presentationFromView`, `samePresentation` and `PresentationState` (Task 1); `MatchUpdate` (Phase 2); in tests, `WorkerMatchSession`, `loopbackWorker`, `SEATS` and `openingUpdate` (Phase 2).
- Produces:
  - `MAX_QUEUED_UPDATES = 3`.
  - `interface PlayingBeat extends Beat { startedAt: number }`.
  - `interface DirectorState { presentation: PresentationState | null; beat: PlayingBeat | null; settled: MatchUpdate | null }`.
  - `class Director`, constructed as `new Director(me: PlayerId, playbackDone: (windowId: number) => void, warn?: (message: string) => void)`. It has `readonly store: StoreApi<DirectorState>`, `push(update: MatchUpdate): void` and `dispose(): void`.

- [ ] **Step 1: Add Zustand**

Run: `pnpm --filter @laddorious/client add zustand@^5.0.15`
Expected: completes without errors or peer warnings.

- [ ] **Step 2: Write the failing test**

Create `apps/client/test/director.test.ts`:

```ts
import type { GameEvent, MoveCause, PlayerId, PlayerView, WindowKind } from '@laddorious/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEAT_MS } from '../src/director/beats';
import { Director, MAX_QUEUED_UPDATES } from '../src/director/director';
import type { MatchUpdate } from '../src/service/matchService';
import { WorkerMatchSession } from '../src/service/workerSession';
import { SEATS, loopbackWorker, openingUpdate } from './support/fixtures';

function moved(player: PlayerId, from: number, to: number, cause: MoveCause = 'dice'): GameEvent {
  return { type: 'Moved', player, from, to, cause, bounced: false, visibility: 'public' };
}

const hops = (tiles: number) => tiles * BEAT_MS.hopPerTile + BEAT_MS.landing;

/** An update on the fixture's board whose view has the given positions and window. */
function update(
  events: GameEvent[],
  positions: Record<PlayerId, number>,
  windowId: number,
  opts: { timer?: MatchUpdate['timer']; window?: WindowKind } = {},
): MatchUpdate {
  const { view } = openingUpdate();
  const next: PlayerView = {
    ...view,
    players: view.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })),
    awaiting: { ...view.awaiting, windowId, window: opts.window ?? 'dice' },
  };
  return { view: next, events, timer: opts.timer ?? null };
}

/** A director that has already played the opening update. */
function startDirector() {
  const done: number[] = [];
  const warn = vi.fn();
  const director = new Director('p0', (windowId) => done.push(windowId), warn);
  director.push(openingUpdate());
  return { director, done, warn, state: () => director.store.getState() };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Director', () => {
  it('reports playback done at once for an update with nothing to play', () => {
    const { done, state } = startDirector();
    expect(done).toEqual([1]);
    expect(state().settled?.view.awaiting.windowId).toBe(1);
    expect(state().presentation?.positions).toEqual({ p0: 0, p1: 0, p2: 0, p3: 0 });
  });

  it('plays the beats in order, moving the board at the end of each, then reports playback done', () => {
    const { director, done, state } = startDirector();
    director.push(update([moved('p1', 0, 3), moved('p1', 3, 14, 'ladder')], { p1: 14 }, 2));
    expect(state().beat).toMatchObject({ kind: 'move', durationMs: hops(3), startedAt: 0 });
    expect(state().presentation?.positions.p1).toBe(0);
    vi.advanceTimersByTime(hops(3));
    expect(state().presentation?.positions.p1).toBe(3);
    expect(state().beat).toMatchObject({ kind: 'launch', startedAt: hops(3) });
    expect(done).toEqual([1]);
    vi.advanceTimersByTime(BEAT_MS.launch);
    expect(state().presentation?.positions.p1).toBe(14);
    expect(state().beat).toBeNull();
    expect(state().settled?.view.awaiting.windowId).toBe(2);
    expect(done).toEqual([1, 2]);
  });

  it('reports playback done only for an update that opened a window', () => {
    const { director, done } = startDirector();
    director.push(update([], {}, 1, { timer: { windowId: 1, endsAt: 12_000 } }));
    director.push(update([], {}, 9, { window: 'none' }));
    expect(done).toEqual([1]);
  });

  it('queues an update that arrives mid-timeline and plays it after', () => {
    const { director, done, state } = startDirector();
    director.push(update([moved('p1', 0, 3)], { p1: 3 }, 2));
    director.push(update([moved('p2', 0, 2)], { p1: 3, p2: 2 }, 3));
    vi.advanceTimersByTime(hops(3));
    expect(done).toEqual([1, 2]);
    expect(state().beat).toMatchObject({ kind: 'move', events: [moved('p2', 0, 2)] });
    vi.advanceTimersByTime(hops(2));
    expect(done).toEqual([1, 2, 3]);
    expect(state().presentation?.positions).toMatchObject({ p1: 3, p2: 2 });
  });

  it(`fast-forwards to the latest view when more than ${MAX_QUEUED_UPDATES} updates wait`, () => {
    const { director, done, state, warn } = startDirector();
    director.push(update([moved('p1', 0, 20)], { p1: 20 }, 2));
    for (let n = 3; n <= 6; n++) director.push(update([moved('p2', n - 3, n - 2)], { p1: 20, p2: n - 2 }, n));
    expect(state().beat).toBeNull();
    expect(state().settled?.view.awaiting.windowId).toBe(6);
    expect(state().presentation?.positions).toMatchObject({ p1: 20, p2: 4 });
    expect(done).toEqual([1, 6]);
    vi.runAllTimers();
    expect(done).toEqual([1, 6]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('resets the board to the view after a timeline, warning when they differ', () => {
    const { director, state, warn } = startDirector();
    director.push(update([moved('p1', 0, 3)], { p1: 5 }, 2));
    vi.advanceTimersByTime(hops(3));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('drifted');
    expect(state().presentation?.positions.p1).toBe(5);
  });

  it('stops playing when disposed', () => {
    const { director, done } = startDirector();
    director.push(update([moved('p1', 0, 3)], { p1: 3 }, 2));
    director.dispose();
    vi.runAllTimers();
    expect(done).toEqual([1]);
  });
});

describe('Director with a real host', () => {
  it('plays a whole match without drifting from the engine', () => {
    const worker = loopbackWorker();
    const session = new WorkerMatchSession(worker, SEATS, { seed: 'director', rngSeed: 'director-secret' });
    const warn = vi.fn();
    const director = new Director(session.me, (windowId) => session.playbackDone(windowId), warn);
    session.onUpdate((u) => director.push(u));
    vi.runAllTimers();
    const { presentation, settled } = director.store.getState();
    expect(settled?.view.phase.kind).toBe('finished');
    expect(warn).not.toHaveBeenCalled();
    expect(presentation?.positions).toEqual(Object.fromEntries(settled!.view.players.map((p) => [p.id, p.position])));
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/director.test.ts`
Expected: FAIL with `Cannot find module '../src/director/director'`.

- [ ] **Step 4: Implement the director**

Create `apps/client/src/director/director.ts`:

```ts
import type { PlayerId } from '@laddorious/core';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { MatchUpdate } from '../service/matchService';
import { buildTimeline, type Beat } from './beats';
import { presentationFromView, samePresentation, type PresentationState } from './presentation';

/** More updates than this waiting behind a timeline fast-forward to the latest view (spec #2 §5.2). */
export const MAX_QUEUED_UPDATES = 3;

export interface PlayingBeat extends Beat {
  /** Epoch ms when the beat started; renderers animate towards `after` over `durationMs`. */
  startedAt: number;
}

export interface DirectorState {
  /** What the board shows. Null until the first update. */
  presentation: PresentationState | null;
  /** The beat on stage, or null between timelines. */
  beat: PlayingBeat | null;
  /** The latest update whose timeline has finished: what the HUD shows. */
  settled: MatchUpdate | null;
}

/**
 * Plays each MatchUpdate as a timeline of beats (spec #2 §5.2). Then it resets the board
 * to the update's view, and reports playback done for the window the update opened.
 * Plain TypeScript; React reads `store` with zustand's useStore.
 */
export class Director {
  readonly store: StoreApi<DirectorState> = createStore<DirectorState>()(() => ({ presentation: null, beat: null, settled: null }));
  private readonly queue: MatchUpdate[] = [];
  private current: { update: MatchUpdate; beats: Beat[]; next: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly me: PlayerId,
    private readonly playbackDone: (windowId: number) => void,
    private readonly warn: (message: string) => void = (message) => console.warn(message),
  ) {}

  push(update: MatchUpdate): void {
    this.queue.push(update);
    if (this.queue.length > MAX_QUEUED_UPDATES) this.fastForward();
    else if (!this.current) this.startNext();
  }

  /** Stop playing: no more beats and no more playbackDone. */
  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.queue.length = 0;
    this.current = null;
  }

  private startNext(): void {
    const update = this.queue.shift();
    if (!update) return;
    let start = this.store.getState().presentation;
    if (!start) {
      start = presentationFromView(update.view);
      this.store.setState({ presentation: start });
    }
    this.current = { update, beats: buildTimeline(update.events, start, this.me, update.view.board.size), next: 0 };
    this.playNext();
  }

  private playNext(): void {
    const current = this.current!;
    // Beats that only change the HUD take no time.
    while (current.beats[current.next]?.durationMs === 0) {
      this.store.setState({ presentation: current.beats[current.next]!.after });
      current.next += 1;
    }
    const beat = current.beats[current.next];
    if (!beat) {
      this.finish(current.update, true);
      return;
    }
    this.store.setState({ beat: { ...beat, startedAt: Date.now() } });
    this.timer = setTimeout(() => {
      this.timer = null;
      this.store.setState({ presentation: beat.after });
      current.next += 1;
      this.playNext();
    }, beat.durationMs);
  }

  /** The timeline is over: the view wins, and the window the update opened may start counting down. */
  private finish(update: MatchUpdate, checkDrift: boolean): void {
    const shown = this.store.getState().presentation;
    const truth = presentationFromView(update.view, shown?.arrivals);
    if (checkDrift && shown && !samePresentation(shown, truth)) {
      this.warn(`presentation drifted from the view in round ${update.view.round}; the view wins`);
    }
    this.store.setState({ presentation: truth, beat: null, settled: update });
    this.current = null;
    const aw = update.view.awaiting;
    if (update.timer === null && aw.window !== 'none') this.playbackDone(aw.windowId);
    this.startNext();
  }

  /** Too far behind: skip straight to the latest update's view. */
  private fastForward(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const latest = this.queue[this.queue.length - 1]!;
    this.queue.length = 0;
    this.current = null;
    this.finish(latest, false);
  }
}
```

- [ ] **Step 5: Run the test again**

Run: `pnpm vitest run apps/client/test/director.test.ts`
Expected: PASS, 8 tests. The whole-match test is the real check on Tasks 1–2: if any event changes the board in a way the presentation rules miss, `warn` fires.

- [ ] **Step 6: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  33 passed (33)` and `Tests  247 passed (247)`.

Run: `pnpm install --frozen-lockfile`
Expected: completes without errors.

- [ ] **Step 7: Commit**

```bash
git add apps/client pnpm-lock.yaml
git commit -m "feat(client): add the director that plays updates as beats

Each update plays beat by beat on a Zustand store; at the end the view
wins (with a dev warning on drift) and playbackDone goes out for the
window the update opened. Updates queue behind a playing timeline, and
more than 3 waiting fast-forward to the latest view (spec #2 §5.2).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The dev page plays beats on a flat board

**Files:**
- Create: `apps/client/src/app/DevBoard.tsx`
- Modify: `apps/client/src/app/DevMatchPage.tsx` (replaced whole), `apps/client/test/DevMatchPage.test.tsx` (replaced whole), `apps/client/src/app/theme.ts`, `apps/client/src/app/dev.css`, `README.md`

**Interfaces:**
- Consumes: `Director`, `DirectorState` (Task 3); `stackOn`, `PresentationState` (Task 1); `BEAT_MS` (Task 2, tests); the Phase 2 page, fixtures and session types.
- Produces: `BOARD_COLORS` in `src/app/theme.ts` (`squares`, `mystery`, `rarity`, `goal`, `slide`); `function DevBoard({ director, seats }: { director: Director; seats: SeatInfo[] })`; the page creates a `Director` per match and disposes it on Leave.

- [ ] **Step 1: Write the failing tests**

Replace `apps/client/test/DevMatchPage.test.tsx` with:

```tsx
// @vitest-environment jsdom
import type { GameEvent } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DevMatchPage, PLAY_WITH_BOTS_AFTER_MS } from '../src/app/DevMatchPage';
import { BEAT_MS } from '../src/director/beats';
import type { Matchmaking, MatchmakingState, MatchSession, MatchUpdate } from '../src/service/matchService';
import { SEATS, openingUpdate } from './support/fixtures';

/** Matchmaking the test drives by hand. */
class ScriptedMatchmaking implements Matchmaking {
  private listener: ((s: MatchmakingState) => void) | null = null;
  cancel = vi.fn();
  playWithBots = vi.fn();

  onState(cb: (s: MatchmakingState) => void): () => void {
    this.listener = cb;
    return () => {
      this.listener = null;
    };
  }

  emit(s: MatchmakingState): void {
    act(() => this.listener?.(s));
  }
}

/** A session the test drives by hand. */
class ScriptedSession implements MatchSession {
  me = 'p0';
  seats = SEATS;
  send = vi.fn();
  playbackDone = vi.fn();
  pause = vi.fn();
  resume = vi.fn();
  leave = vi.fn();
  private updated: ((u: MatchUpdate) => void) | null = null;
  private failed: ((e: { message: string }) => void) | null = null;

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    this.updated = cb;
    return () => {};
  }

  onRejected(): () => void {
    return () => {};
  }

  onFailed(cb: (e: { message: string }) => void): () => void {
    this.failed = cb;
    return () => {};
  }

  update(u: MatchUpdate): void {
    act(() => this.updated?.(u));
  }

  fail(message: string): void {
    act(() => this.failed?.({ message }));
  }
}

function startSearch() {
  const matchmaking = new ScriptedMatchmaking();
  const findMatch = vi.fn(() => matchmaking);
  render(<DevMatchPage service={{ findMatch }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Find match' }));
  return { matchmaking, findMatch };
}

function startMatch() {
  const { matchmaking } = startSearch();
  const session = new ScriptedSession();
  matchmaking.emit({ kind: 'found', session });
  return session;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('DevMatchPage', () => {
  it('searches with the dev profile and offers Play with bots only after 15 s', () => {
    const { matchmaking, findMatch } = startSearch();
    expect(findMatch).toHaveBeenCalledWith({ nickname: 'You', piece: 'knight' });
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS - 250, seats: [SEATS[0]!, null, null, null] });
    expect(screen.getByText('Finding players… 14 s')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play with bots' })).toBeNull();
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS, seats: [SEATS[0]!, null, null, null] });
    fireEvent.click(screen.getByRole('button', { name: 'Play with bots' }));
    expect(matchmaking.playWithBots).toHaveBeenCalledTimes(1);
  });

  it('plays each update as beats, then reports playback done and counts the window down', () => {
    const session = startMatch();
    const opening = openingUpdate();
    session.update(opening);
    expect(session.playbackDone).toHaveBeenCalledWith(1);
    expect(screen.getByText('Round 1 · dice window · waiting for You, Mochi, Pip, Juno · waiting for playback')).toBeTruthy();

    const roll: GameEvent = { type: 'DieRolled', player: 'p1', natural: 5, face: 5, forced: false, auto: false, visibility: 'public' };
    session.update({ ...opening, events: [roll], timer: { windowId: 1, endsAt: 12_000 } });
    expect(screen.getByText(/DieRolled player=Mochi natural=5/)).toBeTruthy();
    expect(screen.getByText('▶ roll · 0.9 s')).toBeTruthy();
    act(() => vi.advanceTimersByTime(BEAT_MS.roll));
    expect(screen.queryByText('▶ roll · 0.9 s')).toBeNull();
    expect(screen.getByText(/waiting for You, Mochi, Pip, Juno · 12 s$/)).toBeTruthy();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText(/waiting for You, Mochi, Pip, Juno · 7 s$/)).toBeTruthy();
    expect(session.playbackDone).toHaveBeenCalledTimes(1);
  });

  it('moves a piece on the board when its beat ends', () => {
    const session = startMatch();
    const opening = openingUpdate();
    session.update(opening);
    expect(screen.getByRole('img', { name: 'Mochi on tile 0' })).toBeTruthy();
    const view = { ...opening.view, players: opening.view.players.map((p) => (p.id === 'p1' ? { ...p, position: 4 } : p)) };
    const move: GameEvent = { type: 'Moved', player: 'p1', from: 0, to: 4, cause: 'dice', bounced: false, visibility: 'public' };
    session.update({ view, events: [move], timer: null });
    expect(screen.getByRole('img', { name: 'Mochi on tile 0' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(4 * BEAT_MS.hopPerTile + BEAT_MS.landing));
    expect(screen.getByRole('img', { name: 'Mochi on tile 4' })).toBeTruthy();
  });

  it('shows the final rankings once the victory beat has played', () => {
    const session = startMatch();
    const { view } = openingUpdate();
    const rankings = [
      { player: 'p2', rank: 1, position: 100 },
      { player: 'p0', rank: 2, position: 87 },
      { player: 'p3', rank: 3, position: 60 },
      { player: 'p1', rank: 4, position: 41 },
    ];
    session.update({
      view: { ...view, round: 21, phase: { kind: 'finished', winner: 'p2', rankings }, awaiting: { windowId: 60, window: 'none', players: [], durationMs: 0 } },
      events: [{ type: 'MatchWon', winner: 'p2', rankings, visibility: 'public' }],
      timer: null,
    });
    expect(screen.queryByText('1. Pip — tile 100')).toBeNull();
    act(() => vi.advanceTimersByTime(BEAT_MS.victory));
    expect(screen.getByText('Round 21 · match over')).toBeTruthy();
    expect(screen.getByText('1. Pip — tile 100')).toBeTruthy();
    expect(screen.getByText('4. Mochi — tile 41')).toBeTruthy();
    expect(session.playbackDone).not.toHaveBeenCalled();
  });

  it('pauses the match while the page is hidden', () => {
    const session = startMatch();
    let hidden = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.pause).toHaveBeenCalledTimes(1);
    hidden = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.resume).toHaveBeenCalledTimes(1);
  });

  it('logs a failed match, and Leave ends the session and returns to the start', () => {
    const session = startMatch();
    session.fail('board corrupted');
    expect(screen.getByText(/FAILED board corrupted/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Find match' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them and watch the new ones fail**

Run: `pnpm vitest run apps/client/test/DevMatchPage.test.tsx`
Expected: FAIL. The beat line (`▶ roll · 0.9 s`), the board pieces (`Mochi on tile 0`) and the delayed rankings don't exist yet. The Phase 2 page calls `playbackDone` and shows the rankings at once.

- [ ] **Step 3: Add the board colours**

`apps/client/src/app/theme.ts`, replace the whole file with:

```ts
// Tangerine Dusk colours used from TypeScript (spec #2 §7.4). HUD colours are CSS custom
// properties in theme.css; the rest of the 3D world's tokens join this file in Phase 4.

/** Seat colours: coral for you, then the three bots in seat order. */
export const SEAT_COLORS = {
  you: '#ff5470',
  bots: ['#3b82f6', '#a3e635', '#8b5cf6'],
} as const;

/** The board (spec #2 §6.1): classic squares repeating diagonally, purple "?" squares with a rarity glyph, a gold last tile, dark slides. */
export const BOARD_COLORS = {
  squares: ['#ff5a5f', '#ffa22e', '#ffd83b', '#4fd16a', '#4a9dff'],
  mystery: '#8f4dff',
  rarity: { common: '#ffffff', rare: '#6ff3ff', epic: '#ffcc33' },
  goal: '#ffcc33',
  slide: '#2a2140',
} as const;
```

- [ ] **Step 4: Write the flat board**

Create `apps/client/src/app/DevBoard.tsx`:

```tsx
import { useStore } from 'zustand';
import type { Director } from '../director/director';
import { stackOn, type PresentationState } from '../director/presentation';
import type { SeatInfo } from '../service/matchService';
import { BOARD_COLORS } from './theme';

/** SVG units per tile: a serpentine 10×10 board with a start row under it. */
const TILE = 100;
const COLUMNS = 10;

/** Centre of a tile: tile 1 bottom left, rows alternating direction. Tile 0 is the start row, one spot per seat. */
function tileCenter(tile: number, seat: number): { x: number; y: number } {
  if (tile === 0) return { x: TILE * (seat + 0.5), y: TILE * 10.5 };
  const row = Math.floor((tile - 1) / COLUMNS);
  const along = (tile - 1) % COLUMNS;
  const col = row % 2 === 0 ? along : COLUMNS - 1 - along;
  return { x: TILE * (col + 0.5), y: TILE * (COLUMNS - 1 - row + 0.5) };
}

/** A piece's offset on its tile: stacked with later arrivals on top, or side by side in a face-off. */
function pieceOffset(state: PresentationState, playerId: string): { dx: number; dy: number } {
  const tile = state.positions[playerId] ?? 0;
  if (tile === 0) return { dx: 0, dy: 0 };
  const faceOff = state.faceOffs.find((f) => f.tile === tile && f.players.includes(playerId));
  if (faceOff) return { dx: (faceOff.players.indexOf(playerId) - (faceOff.players.length - 1) / 2) * 44, dy: 0 };
  const level = stackOn(state, tile).indexOf(playerId);
  return { dx: level * 14, dy: -level * 14 };
}

/**
 * The dev page's flat board (Phase 3): tiles, slides, ladders, and the pieces gliding
 * through each beat. The 3D scene replaces it in Phase 4.
 */
export function DevBoard({ director, seats }: { director: Director; seats: SeatInfo[] }) {
  const presentation = useStore(director.store, (s) => s.presentation);
  const beat = useStore(director.store, (s) => s.beat);
  const board = useStore(director.store, (s) => s.settled?.view.board);
  if (!presentation || !board) return null;
  // During a beat, pieces glide to where it leaves them, over its length.
  const target = beat?.after ?? presentation;
  const glide = `transform ${beat?.durationMs ?? 0}ms ease-in-out`;
  return (
    <svg className="board" viewBox="0 0 1000 1100" role="img" aria-label={`Board, round ${presentation.round}`}>
      {Array.from({ length: board.size }, (_, i) => i + 1).map((tile) => {
        const { x, y } = tileCenter(tile, 0);
        const rarity = board.mystery[tile];
        const diagonal = (Math.floor(x / TILE) + Math.floor(y / TILE)) % BOARD_COLORS.squares.length;
        const fill = tile === board.size ? BOARD_COLORS.goal : rarity ? BOARD_COLORS.mystery : BOARD_COLORS.squares[diagonal];
        return (
          <g key={tile}>
            <rect x={x - TILE / 2} y={y - TILE / 2} width={TILE} height={TILE} fill={fill} />
            <text x={x - 42} y={y - 22} className="tile-number">
              {tile}
            </text>
            {rarity && (
              <text x={x} y={y + 22} className="tile-mystery" fill={BOARD_COLORS.rarity[rarity]}>
                ?
              </text>
            )}
          </g>
        );
      })}
      {target.jumps.map((jump) => {
        const a = tileCenter(jump.from, 0);
        const b = tileCenter(jump.to, 0);
        return jump.to < jump.from ? (
          <line key={jump.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="snake" stroke={BOARD_COLORS.slide} />
        ) : (
          <line key={jump.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="ladder" />
        );
      })}
      {seats.map((seat, i) => {
        const { x, y } = tileCenter(target.positions[seat.playerId] ?? 0, i);
        const { dx, dy } = pieceOffset(target, seat.playerId);
        return (
          <g
            key={seat.playerId}
            role="img"
            aria-label={`${seat.nickname} on tile ${presentation.positions[seat.playerId] ?? 0}`}
            style={{ transform: `translate(${x + dx}px, ${y + dy}px)`, transition: glide }}
          >
            <circle r={26} fill={seat.color} className="piece" />
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 5: Play matches through the director**

Replace `apps/client/src/app/DevMatchPage.tsx` with:

```tsx
import type { PlayerId } from '@laddorious/core';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Director } from '../director/director';
import type { Matchmaking, MatchmakingState, MatchService, MatchSession, MatchUpdate, Profile, SeatInfo } from '../service/matchService';
import { DevBoard } from './DevBoard';
import { formatEvent } from './devLog';

/** "Play with bots" appears once a search has run this long (spec #2 C7). */
export const PLAY_WITH_BOTS_AFTER_MS = 15_000;

const PROFILE: Profile = { nickname: 'You', piece: 'knight' };
const LOG_TAIL = 40;

/**
 * The dev page: matchmaking, then a bot match played beat by beat on a flat board, with the
 * event log, the window timer and the final rankings. Later phases replace it with the 3D
 * board and the real screens.
 */
export function DevMatchPage({ service }: { service: MatchService }) {
  const [matchmaking, setMatchmaking] = useState<Matchmaking | null>(null);
  const [mm, setMm] = useState<MatchmakingState | null>(null);
  const [director, setDirector] = useState<Director | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const session = mm?.kind === 'found' ? mm.session : null;

  // A hidden page pauses the local match (C14).
  useEffect(() => {
    if (!session) return;
    const onVisibility = () => (document.hidden ? session.pause() : session.resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  function findMatch() {
    setLog([]);
    const next = service.findMatch(PROFILE);
    setMatchmaking(next);
    next.onState((s) => {
      setMm(s);
      if (s.kind === 'found') watch(s.session);
    });
  }

  function watch(match: MatchSession) {
    const names = new Map(match.seats.map((seat) => [seat.playerId, seat.nickname]));
    const append = (lines: string[]) => setLog((prev) => [...prev, ...lines]);
    // The director plays each update as beats, then reports playback done (spec #2 §5.2).
    const played = new Director(match.me, (windowId) => match.playbackDone(windowId));
    setDirector(played);
    match.onUpdate((u) => {
      append(u.events.map((e) => formatEvent(e, names)));
      played.push(u);
    });
    match.onRejected((e) => append([`REJECTED ${e.code}: ${e.message}`]));
    match.onFailed((e) => append([`FAILED ${e.message}`]));
  }

  function leave() {
    director?.dispose();
    session?.leave();
    setDirector(null);
    setMatchmaking(null);
    setMm(null);
  }

  return (
    <main className="dev">
      <h1>LADDORIOUS · dev match</h1>
      {(mm === null || mm.kind === 'cancelled') && (
        <button type="button" className="primary" onClick={findMatch}>
          Find match
        </button>
      )}
      {(mm?.kind === 'searching' || mm?.kind === 'filling') && (
        <section className="plate">
          <p>{mm.kind === 'searching' ? `Finding players… ${Math.floor(mm.elapsedMs / 1000)} s` : 'Bots are taking the open seats…'}</p>
          <Seats seats={mm.seats} />
          {mm.kind === 'searching' && (
            <div className="row">
              <button type="button" onClick={() => matchmaking?.cancel()}>
                Cancel
              </button>
              {mm.elapsedMs >= PLAY_WITH_BOTS_AFTER_MS && (
                <button type="button" className="accent" onClick={() => matchmaking?.playWithBots()}>
                  Play with bots
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {session && director && (
        <section className="plate">
          <Seats seats={session.seats} />
          <MatchStatus director={director} seats={session.seats} />
          <button type="button" onClick={leave}>
            Leave
          </button>
        </section>
      )}
      {session && director && <DevBoard director={director} seats={session.seats} />}
      {log.length > 0 && <pre className="log">{log.slice(-LOG_TAIL).join('\n')}</pre>}
    </main>
  );
}

/** The settled match (round, window, who is awaited, the countdown), the beat on stage, and the rankings at the end. */
function MatchStatus({ director, seats }: { director: Director; seats: SeatInfo[] }) {
  const settled = useStore(director.store, (s) => s.settled);
  const beat = useStore(director.store, (s) => s.beat);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const phase = settled?.view.phase;
  return (
    <>
      {settled && <p className="status">{statusLine(settled, seats, now)}</p>}
      {beat && <p className="beat">{`▶ ${beat.kind} · ${(beat.durationMs / 1000).toFixed(1)} s`}</p>}
      {phase?.kind === 'finished' && (
        <ol className="rankings">
          {phase.rankings.map((r) => (
            <li key={r.player}>{`${r.rank}. ${nickname(seats, r.player)} — tile ${r.position}`}</li>
          ))}
        </ol>
      )}
    </>
  );
}

function Seats({ seats }: { seats: Array<SeatInfo | null> }) {
  return (
    <ul className="seats">
      {seats.map((seat, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- a seat's position is its identity
        <li key={i} className={seat ? undefined : 'open'} style={seat ? { borderColor: seat.color } : undefined}>
          {seat ? `${seat.nickname} · ${seat.piece}${seat.bot ? ' · bot' : ''}` : 'open seat'}
        </li>
      ))}
    </ul>
  );
}

function statusLine(u: MatchUpdate, seats: SeatInfo[], now: number): string {
  const { round, awaiting: aw } = u.view;
  if (aw.window === 'none') return `Round ${round} · match over`;
  const who = aw.players.map((id) => nickname(seats, id)).join(', ');
  // Capped at the window's length: the 250 ms tick can lag behind a countdown that just started.
  const left = u.timer ? Math.min(Math.ceil((u.timer.endsAt - now) / 1000), Math.ceil(aw.durationMs / 1000)) : null;
  const time = left === null ? 'waiting for playback' : `${Math.max(0, left)} s`;
  return `Round ${round} · ${aw.window} window · waiting for ${who} · ${time}`;
}

function nickname(seats: SeatInfo[], id: PlayerId): string {
  return seats.find((s) => s.playerId === id)?.nickname ?? id;
}
```

- [ ] **Step 6: Style the board**

Append to `apps/client/src/app/dev.css`:

```css
.beat {
  color: var(--paper);
  font-weight: 700;
}

.board {
  display: block;
  width: 100%;
  max-width: 560px;
  margin: 12px 0;
  border-radius: 14px;
  background: var(--plate);
}

.board .tile-number {
  fill: var(--ink);
  font-size: 22px;
  font-weight: 700;
}

.board .tile-mystery {
  font-size: 56px;
  font-weight: 900;
  text-anchor: middle;
}

.board .snake {
  stroke-width: 16;
  stroke-linecap: round;
  opacity: 0.85;
}

.board .ladder {
  stroke: var(--highlight);
  stroke-width: 12;
  stroke-linecap: round;
  stroke-dasharray: 2 22;
}

.board .piece {
  stroke: var(--ink);
  stroke-width: 6;
}
```

- [ ] **Step 7: Run the tests again**

Run: `pnpm vitest run apps/client/test/DevMatchPage.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 8: Watch it play in the browser**

`README.md`, in the package table, replace the `apps/client` row with:

```markdown
| `apps/client` | `@laddorious/client` | The web client (Vite + React). For now a dev page that plays a bot match beat by beat on a flat board, through the local match service and the Web Worker host. |
```

Start the `client` preview entry (`.claude/launch.json`, local) and open http://localhost:5173. Find match, wait 15 s, then Play with bots. Expected:

- the flat board appears with all four pieces on the start row;
- each update plays as beats: the `▶ kind · n s` line changes, and pieces glide from tile to tile, stack on shared tiles and stand side by side in face-offs;
- while beats play, the status line still shows the previous window; the countdown only starts after the beats end (the host waits for `playbackDone`);
- after a few rounds, the console shows no "presentation drifted" warning and no errors.

- [ ] **Step 9: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  33 passed (33)` and `Tests  248 passed (248)`.

Run: `pnpm build 2>&1 | grep -E "built|error"`
Expected: `✓ built`.

- [ ] **Step 10: Commit**

```bash
git add apps/client README.md
git commit -m "feat(client): play matches beat by beat on a flat dev board

The dev page runs each match through the director: pieces glide through
every beat on an SVG board in the Tangerine Dusk board colours, the
countdown starts only after the beats end, and Leave stops playback.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Phase gate and handoff

**Files:**
- Modify: `docs/superpowers/HANDOFF.md`
- Local only: the project memory `handoff.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a handoff that points the next session at Phase 4.

- [ ] **Step 1: Run the whole gate from a clean install**

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test 2>&1 | grep -E "Test Files|Tests "
pnpm build 2>&1 | grep -E "built|error"
git status --short
```

Expected: no errors; `Test Files  33 passed (33)` and `Tests  248 passed (248)`; `✓ built`; only `.claude/` untracked.

- [ ] **Step 2: Update the handoff note**

In `docs/superpowers/HANDOFF.md`:

1. Replace the title line with `# Handoff — 3D client, after Phase 3`.
2. Replace the `**Keep it current:**` line with: `**Keep it current:** when Phase 4 starts, update the "Where things stand" and "Next step" sections or delete this file.`
3. Replace the Phase 3 row of the "Where things stand" table with the line below. `HASHES` stands for this phase's commits from `git log --oneline main..client/phase-3`, oldest first, each in backticks and comma-separated:

   ```markdown
   | **Phase 3** (director and presentation state): **done on `client/phase-3`**, merged locally at the end of the phase | `docs/superpowers/plans/2026-10-04-client-phase-3-director.md`; commits HASHES |
   ```

4. Replace the paragraph that starts "After Phase 2 the full suite" with:

   ```markdown
   After Phase 3 the full suite is 33 test files, 248 tests, all passing. `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean. There is no git remote.
   ```

5. Replace everything from the `## Next step: Phase 3` heading down to (not including) `## How this user works (follow these)` with:

   ```markdown
   ## Next step: Phase 4

   **Phase 4: the 3D scene.** Spec sections: §5.3 (camera), §6 (scene, assets, performance).

   **It ends with:** a full bot match animated in 3D (board, pieces, slides, pads, dice, camera rules, asset slots, quality levels, dev overlay) with a minimal ROLL button.

   How to run it: the user asked on 2026-10-04 to continue through Phase 6 without stopping (memory `continue-through-phase-6`). Branch `client/phase-4` from `main`, write the plan with `superpowers:writing-plans`, execute it inline with `superpowers:executing-plans` (TDD, commit per task), self-review the branch, merge it locally, then go on to Phase 5.

   What Phase 3 left for Phase 4:

   - The director's store (`src/director/director.ts`) is what the scene renders. `presentation` is the board between beats. `beat` is the step on stage, with `startedAt`, `durationMs` and `after`; animate from `presentation` towards `beat.after`. `settled` is the latest finished update, for the HUD.
   - `src/app/DevBoard.tsx` shows the mapping the scene needs: the serpentine tile layout, stack offsets (`stackOn`), side-by-side face-offs and the start row.
   - Beat kinds and durations are in `src/director/beats.ts` (`BEAT_MS`, the §5.1 starting values). Tune them against the 3D animations.
   - Board colours are in `src/app/theme.ts` (`BOARD_COLORS`); the sky, fog and podium tokens of §7.4 join it.
   - The user okayed making the 3D objects with the Blender MCP (memory `blender-for-3d-objects`), but asked to keep the plan unchanged. Spec §6.3 has code-built defaults behind asset slots, with `.glb` overrides for the Spec #4 art pass.
   ```

6. In "Repository facts", add this bullet after the `**Client tests and lint:**` bullet:

   ```markdown
   - **Director:** `src/director/` is plain TypeScript (presentation state, beat timelines, the `Director` on a `zustand/vanilla` store). Its whole-match test plays a real match through the director and fails on any presentation drift, so run it after changing beat or presentation rules.
   ```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/HANDOFF.md
git commit -m "docs: hand off after phase 3

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Update the project memory**

In `C:\Users\ariefg\.claude\projects\E--AI-Project-laddorious\memory\handoff.md`, replace the paragraph that starts "State after Phase 2" with the text below; keep the rest. In `MEMORY.md`, change the handoff line's "(3D client Phase 3)" to "(3D client Phase 4)".

```markdown
State after Phase 3 (2026-10-04): Phases 1-3 are done and merged to `main` locally. The next step is Phase 4 (the 3D scene). Per the user's standing order (memory continue-through-phase-6): plan it, execute inline, merge locally, continue.
```

After Task 5: self-review the whole branch against §5.1, §5.2 and this plan's Review Focus (say that it was a self-review). Then merge `client/phase-3` into `main` locally (fast-forward), confirm the suite on `main`, delete the branch, and start Phase 4.
