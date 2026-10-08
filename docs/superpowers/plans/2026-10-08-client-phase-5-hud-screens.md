# Phase 5 — HUD and Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For this project: executing-plans, inline, no subagents.

**Goal:** The whole game per spec #2, in Tangerine Dusk, on desktop and landscape phones: the main menu, matchmaking, the match HUD and its popups, the end screen, settings, the rotate screen, the error screen and the leave dialog.

**Architecture:** What the HUD shows is computed by pure TypeScript and unit-tested in Node:

- `hud/labels.ts`: words and icons for cards, effects and rejections;
- `hud/record.ts`: this round's dice and cards;
- `hud/feed.ts`: the event feed lines;
- `hud/model.ts`: the stage bar, player rows, dock, popups and banners.

These modules read the director's state, which gains an event log in Task 3. React components only draw that data. The screens sit under an App shell that routes menu → matchmaking → match → end, with an error screen and an error boundary. Colours live only in `app/theme.ts` and `app/theme.css`, and a test enforces this. Sizes come from the viewport height (`cqh` of the `.app` container) with pixel minimums.

**Tech Stack:** React 19, Zustand 5, React Three Fiber 9.8 (the menu's podium scene and the name-tag projector), Vitest 5 with React Testing Library and `@react-three/test-renderer`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-04-3d-client-design.md`:

- §7: screens, HUD, layout and input, palette and type.
- §8: error handling.
- §9.2: component tests.
- §4.4: the dev seed field.

Phase index: `docs/superpowers/plans/2026-10-04-3d-client-phases.md`.

**How this plan was made:** this follows the user's method for Phase 5, confirmed on 2026-10-08 (memory `phase5-prototype-method`):

1. Every task was built and tested in a scratch copy of the repo.
2. A replay script rebuilt `client/phase-5` task by task from that copy. For each task it confirmed that the task's tests fail before its files exist and that typecheck, lint and the whole suite pass after (red, then green).
3. The code in this plan is the code that was verified that way.

The prototype's notes and rulings are summarised under "Rulings" below.

## Global Constraints

- **Colours:** every colour is a token in `src/app/theme.ts` (3D) or `src/app/theme.css` (HUD). No other source file spells out a colour, and `test/tokens.test.ts` scans every file for one (spec §7.4).
- **Type:** Lilita One for display text and Fredoka for body text, from Google Fonts, with system fallbacks. Display text carries the ink outline, a multi-direction text shadow (§7.4).
- **Sizes:** HUD sizes come from the viewport height (`cqh` of the `.app` size container) with pixel minimums. Everything stays inside `env(safe-area-inset-*)` (§7.3).
- **Input:**
  - Touch targets are at least 44 px.
  - Touch first: tap, long press and the popups cover every action.
  - Desktop extras (Space to roll, 1–3 to pick in popups, Esc to close dialogs) are never required, and their key hints hide on touch screens.
  - Landscape only: portrait shows the rotate screen (§7.3).
- **Popups:** face-off and card pick are centred over a dimmed board with no panel behind them, and only the players involved see them. Everyone else sees a waiting pill (C11, §7.2).
- **Engine:** unchanged. The client sees only `viewFor` and `eventsFor` output (§4.2).
- **Spec deviations:** `findMatch(profile, opts?: { seed })` adds an optional dev seed to the §4.3 signature. It serves §4.4's hidden seed field; Spec #3's online service ignores it.
- **Process:**
  - Work on `client/phase-5`, inline, with no subagents; every review is a self-review.
  - Commit at the end of each task with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Read test counts with `grep -E "Test Files|Tests "`.

## Review Focus

1. **Double or late taps.** Expected: one roll per dice window, one face-off pick per pick round, and one card pick. Rerolls are disabled once used or when none are left. An action the engine turns down shows a toast such as "Too late, that window closed", and the state is unchanged. Pinned in Task 9 (Dock, FaceOffPopup, CardPickPopup) and Task 10 (the MatchScreen toast).
2. **Storage blocked** (a private window, an embedded frame). Expected: the profile and settings work for the session, kept in memory. Pinned in Task 2.
3. **A short phone screen in landscape (390 px tall).** Expected:
   - the your-piece panel starts collapsed (Task 8);
   - the start row isn't hidden under the ROLL dock (Task 10, the overview camera framing);
   - the feed keeps 3 lines and the menu tips hide (container queries, checked in the browser in Task 14 and by Phase 6 e2e).
4. **A phone held upright.** Expected: the rotate screen, whatever screen is showing. Pinned in Task 7 (RotateScreen) and Task 13 (the App renders it over everything).
5. **A crash while drawing a screen.** Expected: the error screen, not a blank page, and Back to menu works. Pinned in Task 13 (CrashBoundary).

## Rulings (decided while prototyping)

**Event feed and labels**
- **The feed uses nicknames, never "You",** so the grammar holds ("Mochi wins", "Pip's Sprint fizzled"). Names take their seat colour through a `--seat` CSS variable and `color-mix`.

**Player column and your-piece panel**
- **Rows:** each row is a `<button>` whose `aria-label` sums it up (name, tile, rank, status); the chips inside are visual only.
- **Details card:** shown on a long press (500 ms) or a mouse hover (`pointerType` not touch or pen). The click that ends a long press is swallowed, and the next tap closes the card; neither changes the watched piece.
- **Re-sorting:** rows slide to their new place with FLIP through the Web Animations API, skipped with reduced motion.
- **Your-piece panel:** starts collapsed under 450 px tall.

**Banners and popups**
- **Banners** (§5.1) cover my own face-offs and their result, cards that touch me, the card reveal, clashes I'm in, my dodged slide, and the match winner. Other players' face-offs and cards get none; the feed and the dock cover them. A banner stays up 1.7 s even when its beat is shorter.
- **Face-off fighters** show nicknames. Before the window opens, my state reads "Get ready…".
- **Queue cards** show who plays each card and the card's target rule ("Mochi → The leader"); the exact target isn't in the record.

**Name tags and the 3D scene**
- **Name tags** are DOM elements that a frame callback inside the canvas moves to their pieces, rather than drei's `<Html>`:
  - a piece under a stack shows its tag beside the stack;
  - on the start row, every other tag hangs higher, because the pieces stand close together.
- **Fixes to Phase 4 found in the browser:**
  - **Overview framing:** the overview camera now frames a little toward the start row (height 22, radius 22, looking at z 2.5), so the ROLL dock no longer hides it.
  - **Piece facing:** pieces face along their row (±X), so the camera sees their profiles; the knight and the dragon head read as blocks head-on.

**Menu and settings**
- **Menu scene:** reuses the tag projector's registry for its three screen anchors (the name plate and the two arrows).
- **Podium:** no glow disc. The mockup drew one with an rgba texture, which the token rule forbids; the emissive ring carries the glow.
- **Settings:** shows the chosen quality's one-line description and the level in use (`startLevel(quality, deviceEnv())`).
- **Rename:** Enter or blur saves, Esc cancels, and an empty name keeps the old one. A done-flag stops a blur fired on unmount from saving after Esc.

**App shell**
- **Fullscreen** is requested only for a touch first tap (never a desktop click), and never on iOS, including iPadOS, which reports MacIntel with touch points.
- **Leaving sessions:** the App leaves the session (ending the worker) on failure, Play again and Main menu. The match screen leaves it itself through the leave dialog.

---

## Before Task 1: commit the plan

- [ ] **Commit the plan, the phase index row and the handoff note**

In `docs/superpowers/HANDOFF.md`, change the Phase 5 row of "Where things stand" to say the plan is written (`docs/superpowers/plans/2026-10-08-client-phase-5-hud-screens.md`) and is being executed on `client/phase-5`. In `docs/superpowers/plans/2026-10-04-3d-client-phases.md`, fill the Phase 5 plan cell with `2026-10-08-client-phase-5-hud-screens.md`.

```bash
git add docs/superpowers/plans/2026-10-08-client-phase-5-hud-screens.md docs/superpowers/plans/2026-10-04-3d-client-phases.md docs/superpowers/HANDOFF.md
git commit -m "docs: add the phase 5 plan (HUD and screens)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Design tokens, base styles and fonts

**Files:**
- Modify: `apps/client/index.html`, `apps/client/src/app/theme.css`, `apps/client/src/app/theme.ts`
- Create: `apps/client/src/app/base.css`, `apps/client/test/tokens.test.ts`

**Interfaces:**
- Produces:
  - CSS tokens (`--ink`, `--plate`, `--paper`, `--highlight`, `--primary`, `--accent`, `--panel-header`, `--done`, `--warn-on-paper`, rarity, type and result colours, `--display`, `--body` and the `--o-sm`, `--o` and `--o-lg` outlines);
  - `PODIUM_COLORS` in `theme.ts`;
  - base classes `.app` (the size container, with safe-area variables and `--edge`), `.layer`, `.live`, `.display`, `.outlined`, `.btn` (`.primary`, `.accent`, `.highlight`), `.pill`, `.panel`, `.backdrop` and `.spinner`;
  - the `rise`, `pop-in`, `fade-in` and `spin` keyframes, and the reduced-motion rules.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PODIUM_COLORS } from '../src/app/theme';

// Every source file's text, read through Vite's raw imports.
const SOURCES = import.meta.glob<string>('../src/**/*.{css,ts,tsx}', { query: '?raw', import: 'default', eager: true });
/** The only files allowed to spell out a colour (spec #2 §7.4). */
const THEME_FILES = new Set(['../src/app/theme.ts', '../src/app/theme.css']);
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

describe('design tokens (spec #2 §7.4)', () => {
  it('keeps every colour in the theme files', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
    const offenders = Object.entries(SOURCES)
      .filter(([file]) => !THEME_FILES.has(file))
      .flatMap(([file, text]) =>
        text
          .split('\n')
          .map((line, i) => ({ file, line: i + 1, text: line.trim() }))
          .filter((l) => COLOUR.test(l.text)),
      );
    expect(offenders).toEqual([]);
  });

  it('has the Tangerine Dusk podium colours', () => {
    expect(PODIUM_COLORS).toEqual({ top: '#fff3e3', band: '#ff9a3d', base: '#147676', ring: '#ff5470', island: '#0f5d63', chunk: '#ffb070' });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/tokens.test.ts`
Expected: FAIL in "has the Tangerine Dusk podium colours" (`PODIUM_COLORS` doesn't exist yet).

- [ ] **Step 3: Add the tokens, the base styles and the fonts**

Replace `apps/client/src/app/theme.css` with:

```css
/* Tangerine Dusk HUD tokens (spec #2 §7.4). Colours used from TypeScript live in theme.ts.
   No other stylesheet hard-codes a colour: test/tokens.test.ts checks that. */
:root {
  --sky-top: #0b4a5a;
  --sky-mid: #2f8f8a;
  --sky-horizon: #ffc184;
  --ink: #0f2e36;
  --plate: rgba(9, 38, 45, 0.86);
  --plate-soft: rgba(9, 38, 45, 0.62);
  --paper: #fff7ec;
  --paper-alt: #e2f3ee;
  --muted-on-paper: #46707a;
  --muted-on-plate: #a8d0d2;
  --highlight: #5ff0c5;
  --primary: #ff7a1a;
  --primary-hover: #ff9140;
  --accent: #ff5470;
  --panel-header: #147676;
  --backdrop-light: rgba(5, 30, 36, 0.5);
  --backdrop-dark: rgba(5, 30, 36, 0.86);
  --white: #ffffff;
  --faint-on-plate: rgba(255, 255, 255, 0.18);
  --empty-seat: rgba(255, 255, 255, 0.08);
  --empty-seat-edge: rgba(255, 255, 255, 0.6);

  /* Board-derived accents: "?" squares and their rarity glyphs (§6.1), and the card types,
     which reuse the classic square colours so the cards read as part of the board. */
  --mystery: #8f4dff;
  --rarity-common: #ffffff;
  --rarity-rare: #6ff3ff;
  --rarity-epic: #ffcc33;
  --type-movement: #4a9dff;
  --type-defense: #4fd16a;
  --type-attack: #ff5a5f;
  --type-risky: #ffa22e;
  --type-misc: #8f4dff;
  --result-hit: #ff5470;
  --result-blocked: #6ff3ff;
  --result-fizzled: #a8d0d2;
  --gold: #ffcc33;
  /* Past stages on the stage bar, and "done" status icons (§7.2): the board's green. */
  --done: #4fd16a;
  /* Fizzle warnings on cards (§7.2): a deep coral that reads as small text on paper. */
  --warn-on-paper: #c2412e;

  /* Type (§7.4): Lilita One for display text, Fredoka for body text, with system fallbacks. */
  --display: 'Lilita One', 'Arial Rounded MT Bold', 'Trebuchet MS', system-ui, sans-serif;
  --body: 'Fredoka', 'Nunito', 'Segoe UI', system-ui, sans-serif;

  /* The ink outline on display text, as in the mockups (a multi-direction text shadow). */
  --o-sm: 1.5px 0 0 var(--ink), -1.5px 0 0 var(--ink), 0 1.5px 0 var(--ink), 0 -1.5px 0 var(--ink), 0 3px 0 var(--ink);
  --o: 2px 0 0 var(--ink), -2px 0 0 var(--ink), 0 2px 0 var(--ink), 0 -2px 0 var(--ink), 2px 2px 0 var(--ink),
    -2px 2px 0 var(--ink), 2px -2px 0 var(--ink), -2px -2px 0 var(--ink), 0 4px 0 var(--ink);
  --o-lg: 4px 0 0 var(--ink), -4px 0 0 var(--ink), 0 4px 0 var(--ink), 0 -4px 0 var(--ink), 3px 3px 0 var(--ink),
    -3px 3px 0 var(--ink), 3px -3px 0 var(--ink), -3px -3px 0 var(--ink), 0 8px 0 var(--ink);
}
```

Replace `apps/client/src/app/theme.ts` with:

```ts
// Tangerine Dusk colours used from TypeScript (spec #2 §7.4). HUD colours are CSS custom
// properties in theme.css; the board and the 3D world around it take their colours from here.

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

/** The 3D world around the board (spec #2 §6.1, §7.4): all values come from the Tangerine Dusk palette. */
export const WORLD_COLORS = {
  sky: ['#0b4a5a', '#2f8f8a', '#ffc184'],
  fog: '#ffc79a',
  islandTop: '#ffb070',
  islandRock: '#0f5d63',
  bumper: ['#ff5470', '#5ff0c5'],
  cloud: '#fff7ec',
  ink: '#0f2e36',
  crown: '#ffcc33',
  pad: '#5ff0c5',
  chevron: '#ff5470',
  die: '#fff7ec',
  pip: '#0f2e36',
  orb: '#5ff0c5',
  shield: '#6ff3ff',
  ring: '#ffcc33',
} as const;

/** The menu podium and its floating island (spec #2 §7.4 Podium tokens). */
export const PODIUM_COLORS = {
  top: '#fff3e3',
  band: '#ff9a3d',
  base: '#147676',
  ring: '#ff5470',
  island: '#0f5d63',
  chunk: '#ffb070',
} as const;
```

Create `apps/client/src/app/base.css`:

```css
/* Base styles shared by every screen (spec #2 §7.3, §7.4). Colours come from theme.css tokens. */
* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  height: 100%;
}

body {
  overflow: hidden;
  overscroll-behavior: none;
  background: var(--sky-top);
  color: var(--ink);
  font-family: var(--body);
  -webkit-tap-highlight-color: transparent;
}

button,
input {
  font-family: inherit;
}

button:focus-visible,
input:focus-visible,
[role='button']:focus-visible {
  outline: 3px solid var(--highlight);
  outline-offset: 3px;
}

/* The app fills the viewport and is the size container: HUD sizes use cqh (1% of its height)
   with pixel minimums, so one layout works from a 390 px phone to a 1080 px desktop (§7.3). */
.app {
  position: fixed;
  inset: 0;
  container-type: size;
  overflow: hidden;
  background: linear-gradient(var(--sky-top), var(--sky-mid) 60%, var(--sky-horizon));
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  --safe-t: env(safe-area-inset-top, 0px);
  --safe-r: env(safe-area-inset-right, 0px);
  --safe-b: env(safe-area-inset-bottom, 0px);
  --safe-l: env(safe-area-inset-left, 0px);
  --edge: max(10px, 2.2cqh);
}

/* A full-screen HUD layer that lets taps through to the 3D canvas, except on `.live` parts. */
.layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.live {
  pointer-events: auto;
}

.display {
  font-family: var(--display);
  font-weight: 400;
  letter-spacing: 0.4px;
}

.outlined {
  color: var(--white);
  text-shadow: var(--o);
}

/* Chunky toy buttons: ink border, ink drop shadow, at least 44 px tall (§7.3). */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  min-width: 44px;
  padding: max(10px, 1.9cqh) max(16px, 3.2cqh) max(9px, 1.7cqh);
  border: 3px solid var(--ink);
  border-radius: max(12px, 2.4cqh);
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 max(3px, 0.8cqh) 0 var(--ink);
  font: 400 max(16px, 3.4cqh) / 1 var(--display);
  letter-spacing: 0.4px;
  cursor: pointer;
}

.btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--ink);
}

.btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.btn.primary {
  background: var(--primary);
}

.btn.primary:hover:not(:disabled) {
  background: var(--primary-hover);
}

.btn.accent {
  background: var(--accent);
  color: var(--white);
  text-shadow: 0 2px 0 var(--ink);
}

.btn.highlight {
  background: var(--highlight);
}

/* A translucent chip on the sky: feed lines, waiting pills, captions (§7.4 Plate). */
.pill {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: max(7px, 1.3cqh) max(14px, 2.4cqh);
  border-radius: 999px;
  background: var(--plate);
  color: var(--white);
  font: 600 max(13px, 2.3cqh) / 1.25 var(--body);
  white-space: nowrap;
}

.panel {
  background: var(--paper);
  border: 3px solid var(--ink);
  border-radius: max(14px, 2.6cqh);
  box-shadow: 0 max(4px, 0.9cqh) 0 var(--ink);
  color: var(--ink);
}

/* The dimmed board behind popups and dialogs (§7.4 Dimmed backdrop). */
.backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 45%, var(--backdrop-light), var(--backdrop-dark));
  animation: fade-in 0.25s ease-out;
}

.spinner {
  display: inline-block;
  flex: none;
  width: 1em;
  height: 1em;
  border: 3px solid var(--faint-on-plate);
  border-top-color: var(--white);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.96);
  }
}

@keyframes pop-in {
  from {
    transform: scale(0.3);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}

/* The Reduced motion setting does the same for players who turned it on in the game (§7.1). */
.app.reduced-motion *,
.app.reduced-motion *::before,
.app.reduced-motion *::after {
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 1ms !important;
}
```

Replace `apps/client/index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0b4a5a" />
    <title>Laddorious</title>
    <!-- Lilita One (display) and Fredoka (body), spec #2 §7.4; the CSS falls back to system fonts if these can't load. -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Lilita+One&display=swap" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/tokens.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  43 passed (43)` and `Tests  296 passed (296)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add the Tangerine Dusk tokens, base styles and fonts

Every colour is a token in theme.ts or theme.css, and a test scans the
sources for stray ones (spec #2 §7.4). Base styles size the HUD from the
viewport height with pixel minimums inside the safe areas (§7.3), and
the page loads Lilita One and Fredoka.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Profile and settings store

**Files:**
- Create: `apps/client/src/app/prefs.ts`, `apps/client/test/prefs.test.ts`

**Interfaces:**
- Produces:
  - `NICKNAME_MAX` (16), `cleanNickname(raw)`, `defaultNickname(random?)` and `browserStorage(): KeyValueStore | null`;
  - `interface Settings { quality: QualitySetting; reducedMotion: boolean }`;
  - `createPrefsStore(storage, env)`, which returns a `StoreApi<PrefsState>` with `profile`, `settings`, `rename(raw): boolean`, `setPiece(piece)`, `setQuality(quality)` and `setReducedMotion(on)`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/prefs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cleanNickname, createPrefsStore, defaultNickname, type KeyValueStore } from '../src/app/prefs';

/** An in-memory Storage stand-in. */
function memory(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

/** A storage that throws on every access, as blocked localStorage does. */
const blocked: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

const env = { prefersReducedMotion: false, random: () => 0.4821 };

describe('nickname rules (spec #2 C9)', () => {
  it('trims and accepts 1–16 characters', () => {
    expect(cleanNickname('  Arief  ')).toBe('Arief');
    expect(cleanNickname('x'.repeat(16))).toBe('x'.repeat(16));
    expect(cleanNickname('x'.repeat(17))).toBeNull();
    expect(cleanNickname('   ')).toBeNull();
  });

  it('defaults to Guest and four digits', () => {
    expect(defaultNickname(() => 0)).toBe('Guest1000');
    expect(defaultNickname(() => 0.99999)).toBe('Guest9999');
    expect(defaultNickname()).toMatch(/^Guest\d{4}$/);
  });
});

describe('the prefs store', () => {
  it('starts with a Guest profile, the knight, Auto quality and the system motion setting, and saves the new profile', () => {
    const storage = memory();
    const prefs = createPrefsStore(storage, { prefersReducedMotion: true, random: () => 0.4821 });
    expect(prefs.getState().profile).toEqual({ nickname: 'Guest5338', piece: 'knight' });
    expect(prefs.getState().settings).toEqual({ quality: 'auto', reducedMotion: true });
    expect(JSON.parse(storage.data['laddorious.profile']!)).toEqual({ nickname: 'Guest5338', piece: 'knight' });
  });

  it('saves renames, piece and settings, and loads them back', () => {
    const storage = memory();
    const prefs = createPrefsStore(storage, env);
    expect(prefs.getState().rename('  Pip Fan ')).toBe(true);
    prefs.getState().setPiece('dragon');
    prefs.getState().setQuality('low');
    prefs.getState().setReducedMotion(true);
    const again = createPrefsStore(storage, env).getState();
    expect(again.profile).toEqual({ nickname: 'Pip Fan', piece: 'dragon' });
    expect(again.settings).toEqual({ quality: 'low', reducedMotion: true });
  });

  it('refuses a bad rename and keeps the old name', () => {
    const prefs = createPrefsStore(memory(), env);
    const before = prefs.getState().profile.nickname;
    expect(prefs.getState().rename('')).toBe(false);
    expect(prefs.getState().rename('a much too long nickname')).toBe(false);
    expect(prefs.getState().profile.nickname).toBe(before);
  });

  it('ignores corrupted or invalid saved values', () => {
    const storage = memory({ 'laddorious.profile': '{"nickname":"","piece":"wizard"}', 'laddorious.settings': 'not json' });
    const prefs = createPrefsStore(storage, env).getState();
    expect(prefs.profile).toEqual({ nickname: 'Guest5338', piece: 'knight' });
    expect(prefs.settings).toEqual({ quality: 'auto', reducedMotion: false });
  });

  it('works for the session when storage is blocked (spec #2 §8)', () => {
    const prefs = createPrefsStore(blocked, env);
    expect(prefs.getState().rename('Offline')).toBe(true);
    prefs.getState().setQuality('high');
    expect(prefs.getState().profile.nickname).toBe('Offline');
    expect(prefs.getState().settings.quality).toBe('high');
    expect(createPrefsStore(null, env).getState().profile.nickname).toBe('Guest5338');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/prefs.test.ts`
Expected: FAIL with `Cannot find module '../src/app/prefs'`.

- [ ] **Step 3: Implement the store**

Create `apps/client/src/app/prefs.ts`:

```ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { QualitySetting } from '../scene/quality';
import { PIECES, type PieceId, type Profile } from '../service/matchService';

// The guest profile and the settings, kept on this device (spec #2 C9, §7.1, §8).

export const NICKNAME_MAX = 16;
const QUALITIES: readonly QualitySetting[] = ['auto', 'low', 'high'];
const KEYS = { profile: 'laddorious.profile', settings: 'laddorious.settings' } as const;

export interface Settings {
  quality: QualitySetting;
  reducedMotion: boolean;
}

export interface PrefsState {
  profile: Profile;
  settings: Settings;
  /** Rename: trimmed, 1–16 characters. Returns false and keeps the old name otherwise. */
  rename(raw: string): boolean;
  setPiece(piece: PieceId): void;
  setQuality(quality: QualitySetting): void;
  setReducedMotion(on: boolean): void;
}

/** The part of Storage the store uses. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** A nickname as typed, trimmed; null if it is empty or longer than 16 characters. */
export function cleanNickname(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && [...name].length <= NICKNAME_MAX ? name : null;
}

/** "Guest" and four digits, e.g. Guest4821. */
export function defaultNickname(random: () => number = Math.random): string {
  return `Guest${1000 + Math.floor(random() * 9000)}`;
}

/** localStorage, or null where it is blocked (private modes, embedded frames, file://). */
export function browserStorage(): KeyValueStore | null {
  try {
    const storage = window.localStorage;
    const probe = 'laddorious.probe';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function read(storage: KeyValueStore | null, key: string): unknown {
  try {
    const text = storage?.getItem(key);
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

function write(storage: KeyValueStore | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is full or blocked: keep the value in memory for this session (§8).
  }
}

function loadProfile(stored: unknown, random: () => number): Profile {
  const saved = (stored ?? {}) as Partial<Profile>;
  const nickname = typeof saved.nickname === 'string' ? cleanNickname(saved.nickname) : null;
  const piece = PIECES.includes(saved.piece as PieceId) ? (saved.piece as PieceId) : 'knight';
  return { nickname: nickname ?? defaultNickname(random), piece };
}

function loadSettings(stored: unknown, prefersReducedMotion: boolean): Settings {
  const saved = (stored ?? {}) as Partial<Settings>;
  return {
    quality: QUALITIES.includes(saved.quality as QualitySetting) ? (saved.quality as QualitySetting) : 'auto',
    reducedMotion: typeof saved.reducedMotion === 'boolean' ? saved.reducedMotion : prefersReducedMotion,
  };
}

/**
 * The profile and settings store. With `storage` null (blocked), everything still works and
 * lasts for the session. A brand-new profile is saved at once, so the Guest number sticks.
 */
export function createPrefsStore(
  storage: KeyValueStore | null,
  env: { prefersReducedMotion: boolean; random?: () => number } = { prefersReducedMotion: false },
): StoreApi<PrefsState> {
  const storedProfile = read(storage, KEYS.profile);
  const profile = loadProfile(storedProfile, env.random ?? Math.random);
  if (!storedProfile) write(storage, KEYS.profile, profile);
  const settings = loadSettings(read(storage, KEYS.settings), env.prefersReducedMotion);

  return createStore<PrefsState>()((set, get) => {
    const saveProfile = (next: Profile) => {
      set({ profile: next });
      write(storage, KEYS.profile, next);
    };
    const saveSettings = (next: Settings) => {
      set({ settings: next });
      write(storage, KEYS.settings, next);
    };
    return {
      profile,
      settings,
      rename(raw) {
        const nickname = cleanNickname(raw);
        if (nickname === null) return false;
        saveProfile({ ...get().profile, nickname });
        return true;
      },
      setPiece(piece) {
        saveProfile({ ...get().profile, piece });
      },
      setQuality(quality) {
        saveSettings({ ...get().settings, quality });
      },
      setReducedMotion(reducedMotion) {
        saveSettings({ ...get().settings, reducedMotion });
      },
    };
  });
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/prefs.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  44 passed (44)` and `Tests  303 passed (303)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): keep the guest profile and settings on the device

A Guest#### nickname (1-16 characters, trimmed) and a piece, plus the
quality and reduced-motion settings, in localStorage; kept in memory for
the session when storage is blocked (spec #2 C9, §8).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The director keeps an event log

**Files:**
- Modify: `apps/client/src/director/director.ts`, `apps/client/test/director.test.ts`

**Interfaces:**
- Produces:
  - `LOG_LIMIT` (300);
  - `interface LoggedEvent { seq: number; event: GameEvent }`;
  - `DirectorState.log: LoggedEvent[]`, the events shown so far, oldest first. A beat's events join when it starts; beats that take no time join at once; a fast-forward adds the events it skips. Another player's private events never appear.

- [ ] **Step 1: Write the failing tests**

Replace `apps/client/test/director.test.ts` with:

```ts
import type { GameEvent, MoveCause, PlayerId, PlayerView, WindowKind } from '@laddorious/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BEAT_MS } from '../src/director/beats';
import { Director, LOG_LIMIT, MAX_QUEUED_UPDATES } from '../src/director/director';
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

describe('Director event log (for the HUD)', () => {
  const totaled = (player: PlayerId, total: number): GameEvent => ({ type: 'DiceTotaled', player, faces: [total], total, visibility: 'public' });
  const logged = (d: Director) => d.store.getState().log.map((l) => l.event);

  it('logs events that take no time at once, and a beat when it starts', () => {
    const { director } = startDirector();
    director.push(update([totaled('p1', 3), moved('p1', 0, 3), moved('p1', 3, 14, 'ladder')], { p1: 14 }, 2));
    expect(logged(director)).toEqual([totaled('p1', 3), moved('p1', 0, 3)]);
    vi.advanceTimersByTime(hops(3));
    expect(logged(director)).toEqual([totaled('p1', 3), moved('p1', 0, 3), moved('p1', 3, 14, 'ladder')]);
    const seqs = director.store.getState().log.map((l) => l.seq);
    expect(seqs).toEqual([1, 2, 3]);
  });

  it('logs the events a fast-forward skips, in order', () => {
    const { director } = startDirector();
    director.push(update([moved('p1', 0, 20), moved('p1', 20, 30, 'ladder')], { p1: 30 }, 2));
    for (let n = 3; n <= 6; n++) director.push(update([moved('p2', n - 3, n - 2)], { p1: 30, p2: n - 2 }, n));
    expect(logged(director)).toEqual([
      moved('p1', 0, 20),
      moved('p1', 20, 30, 'ladder'),
      moved('p2', 0, 1),
      moved('p2', 1, 2),
      moved('p2', 2, 3),
      moved('p2', 3, 4),
    ]);
  });

  it(`keeps only the newest ${LOG_LIMIT} events`, () => {
    const { director } = startDirector();
    const many = Array.from({ length: LOG_LIMIT + 5 }, (_, i) => totaled('p1', (i % 6) + 1));
    director.push(update(many, {}, 2));
    const log = director.store.getState().log;
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]!.seq).toBe(6);
    expect(log.at(-1)!.seq).toBe(LOG_LIMIT + 5);
  });

  it("never logs another player's private events", () => {
    const { director } = startDirector();
    const theirs: GameEvent = { type: 'MysteryOffered', player: 'p1', tile: 4, rarity: 'common', cards: ['sprint', 'sprint', 'sprint'], visibility: { private: 'p1' } };
    const mine: GameEvent = { ...theirs, player: 'p0', visibility: { private: 'p0' } };
    director.push(update([theirs, mine], {}, 2));
    expect(logged(director)).toEqual([mine]);
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

- [ ] **Step 2: Run them and watch the new ones fail**

Run: `pnpm vitest run apps/client/test/director.test.ts`
Expected: FAIL in the four "Director event log" tests (the state has no log yet).

- [ ] **Step 3: Add the log**

Replace `apps/client/src/director/director.ts` with:

```ts
import type { GameEvent, PlayerId } from '@laddorious/core';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { MatchUpdate } from '../service/matchService';
import { buildTimeline, type Beat } from './beats';
import { presentationFromView, samePresentation, type PresentationState } from './presentation';

/** More updates than this waiting behind a timeline fast-forward to the latest view (spec #2 §5.2). */
export const MAX_QUEUED_UPDATES = 3;
/** The event log keeps this many of the newest events. */
export const LOG_LIMIT = 300;

export interface PlayingBeat extends Beat {
  /** Epoch ms when the beat started; renderers animate towards `after` over `durationMs`. */
  startedAt: number;
}

/** One shown event; `seq` counts up from 1 and never repeats, so it can key a feed line. */
export interface LoggedEvent {
  seq: number;
  event: GameEvent;
}

export interface DirectorState {
  /** What the board shows. Null until the first update. */
  presentation: PresentationState | null;
  /** The beat on stage, or null between timelines. */
  beat: PlayingBeat | null;
  /** The latest update whose timeline has finished: what the HUD shows. */
  settled: MatchUpdate | null;
  /**
   * The events shown so far, oldest first: a beat's events join when it starts (beats that
   * take no time join at once), and a fast-forward adds the events it skips. The HUD reads it.
   */
  log: LoggedEvent[];
}

/**
 * Plays each MatchUpdate as a timeline of beats (spec #2 §5.2). Then it resets the board
 * to the update's view, and reports playback done for the window the update opened.
 * Plain TypeScript; React reads `store` with zustand's useStore.
 */
export class Director {
  readonly store: StoreApi<DirectorState> = createStore<DirectorState>()(() => ({ presentation: null, beat: null, settled: null, log: [] }));
  private readonly queue: MatchUpdate[] = [];
  private current: { update: MatchUpdate; beats: Beat[]; next: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

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
      const instant = current.beats[current.next]!;
      this.store.setState({ presentation: instant.after, log: this.logged(instant.events) });
      current.next += 1;
    }
    const beat = current.beats[current.next];
    if (!beat) {
      this.finish(current.update, true);
      return;
    }
    this.store.setState({ beat: { ...beat, startedAt: Date.now() }, log: this.logged(beat.events) });
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

  /** The log with these events added at the end, trimmed to LOG_LIMIT. */
  private logged(events: GameEvent[]): LoggedEvent[] {
    const log = this.store.getState().log;
    if (events.length === 0) return log;
    const next = [...log, ...events.map((event) => ({ seq: ++this.seq, event }))];
    return next.length > LOG_LIMIT ? next.slice(-LOG_LIMIT) : next;
  }

  /** Public events and my own private ones (spec #2 §4.2). */
  private visible(event: GameEvent): boolean {
    return event.visibility === 'public' || event.visibility.private === this.me;
  }

  /** Too far behind: skip straight to the latest update's view. */
  private fastForward(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    // The skipped events still reach the log: the HUD's dice and cards come from it.
    const playing = this.current?.beats.slice(this.current.next + (this.store.getState().beat ? 1 : 0)) ?? [];
    const skipped = [...playing.flatMap((b) => b.events), ...this.queue.flatMap((u) => u.events.filter((e) => this.visible(e)))];
    this.store.setState({ log: this.logged(skipped) });
    const latest = this.queue[this.queue.length - 1]!;
    this.queue.length = 0;
    this.current = null;
    this.finish(latest, false);
  }
}
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/director.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  44 passed (44)` and `Tests  307 passed (307)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): log the events the director shows

The HUD reads this round's dice, cards and feed lines from a log of the
events shown so far, including zero-length beats and the events a
fast-forward skips, capped at 300.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: HUD labels

**Files:**
- Create: `apps/client/src/hud/labels.ts`, `apps/client/test/labels.test.ts`

**Interfaces:**
- Produces:
  - `PIECE_NAMES` and `type IconName`;
  - `cardInfo(id): CardInfo` (name, text, type, rarity, target line, icon) and `targetLine(rule)`;
  - `fizzleWarning(id, view): string | null`;
  - `effectChip(effect, names): EffectChip` (icon, badge, name, description, life);
  - `nextRollMods(effects, me): string[]`, in the engine's order;
  - `rejectionText(code): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/labels.test.ts`:

```ts
import type { ActiveEffect, EffectParams, Lifetime, PlayerView } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { cardInfo, effectChip, fizzleWarning, nextRollMods, rejectionText, targetLine } from '../src/hud/labels';
import { openingUpdate } from './support/fixtures';

const names = new Map([['p0', 'You'], ['p1', 'Mochi']]);

function effect(params: EffectParams, lifetime: Lifetime, extra: Partial<ActiveEffect> = {}): ActiveEffect {
  return { id: 'e1', owner: 'p0', sourceCard: 'shield', sourcePlayer: 'p0', params, lifetime, createdRound: 5, seq: 1, ...extra };
}

/** The opening view with these tile positions. */
function viewAt(positions: Record<string, number>): PlayerView {
  const { view } = openingUpdate();
  return { ...view, players: view.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })) };
}

describe('card labels (spec #2 §7.2)', () => {
  it('reads name, text, type, rarity and icon from the starter set', () => {
    expect(cardInfo('heavy-boots')).toEqual({
      id: 'heavy-boots',
      name: 'Heavy Boots',
      text: "The leader's next dice total is reduced by 3.",
      type: 'attack',
      rarity: 'rare',
      targetLine: 'The leader',
      icon: 'boot',
    });
  });

  it('writes the target line from the targeting rule', () => {
    expect(targetLine({ condition: 'self', pick: 'self', tieBreak: 'lowest-seat' })).toBe('You');
    expect(targetLine({ condition: 'ahead-of-caster', pick: 'nearest', tieBreak: 'random' })).toBe('Nearest player ahead');
    expect(targetLine({ condition: 'ahead-of-caster', pick: 'furthest', tieBreak: 'random' })).toBe('Furthest player ahead');
    expect(targetLine({ condition: 'other', pick: 'last', tieBreak: 'random' })).toBe('The player in last place');
    expect(targetLine({ condition: 'section', section: [40, 60], pick: 'nearest', tieBreak: 'random' })).toBe('A player on tiles 40–60');
  });

  it('warns when a card would fizzle on the board as it is', () => {
    expect(fizzleWarning('shove', viewAt({ p0: 50, p1: 10, p2: 20, p3: 30 }))).toBe('Nobody is ahead of you right now. If that holds, it fizzles.');
    expect(fizzleWarning('shove', viewAt({ p0: 5, p1: 10 }))).toBeNull();
    expect(fizzleWarning('sprint', viewAt({ p0: 50 }))).toBeNull();
    const noPads = { ...viewAt({ p0: 95 }) };
    expect(fizzleWarning('ladder-warp', { ...noPads, board: { ...noPads.board, jumps: [] } })).toBe('No launch pad ahead of you right now. If that holds, it fizzles.');
  });
});

describe('effect chips (spec #2 §7.2)', () => {
  it('shows dice modifiers as badges, saying who cast them', () => {
    expect(effectChip(effect({ hook: 'diceTotal', op: 'add', value: -3 }, { charges: 1 }, { sourceCard: 'heavy-boots', sourcePlayer: 'p1' }), names)).toEqual({
      id: 'e1',
      icon: 'boot',
      badge: '−3',
      name: 'Heavy Boots',
      description: 'Next dice total −3, from Mochi',
      life: '1 use',
    });
    expect(effectChip(effect({ hook: 'diceTotal', op: 'multiply', value: 2 }, { charges: 1 }, { sourceCard: 'overdrive' }), names).badge).toBe('×2');
    expect(effectChip(effect({ hook: 'diceFace', die: 'first', set: 6 }, { charges: 1 }, { sourceCard: 'loaded-die' }), names).description).toBe('Next die shows 6');
  });

  it('shows shields with their uses and the round they end', () => {
    const chip = effectChip(effect({ hook: 'beforeAttack' }, { rounds: 3, charges: 1 }), names);
    expect(chip).toMatchObject({ icon: 'shield', badge: '×1', name: 'Shield', description: 'Blocks the next attack', life: '1 use · until round 8' });
    expect(effectChip(effect({ hook: 'beforeSnake' }, { rounds: 2 }, { sourceCard: 'aegis' }), names).badge).toBe('2r');
  });
});

describe('next roll modifiers', () => {
  it('lists my modifiers in the order the engine applies them: face, newest Replace, Multiply, Add', () => {
    const effects = [
      effect({ hook: 'diceTotal', op: 'add', value: -3 }, { charges: 1 }, { id: 'a', seq: 1 }),
      effect({ hook: 'diceTotal', op: 'replace', value: 4 }, { charges: 1 }, { id: 'b', seq: 2 }),
      effect({ hook: 'diceTotal', op: 'replace', value: 5 }, { charges: 1 }, { id: 'c', seq: 3 }),
      effect({ hook: 'diceTotal', op: 'multiply', value: 2 }, { charges: 1 }, { id: 'd', seq: 4 }),
      effect({ hook: 'diceFace', die: 'first', set: 6 }, { charges: 1 }, { id: 'e', seq: 5 }),
      effect({ hook: 'diceTotal', op: 'add', value: 2 }, { charges: 1 }, { id: 'f', seq: 6, owner: 'p1' }),
    ];
    expect(nextRollMods(effects, 'p0')).toEqual(['Die = 6', 'Total = 5', 'Total ×2', 'Total −3']);
    expect(nextRollMods([], 'p0')).toEqual([]);
  });
});

describe('rejected actions (spec #2 §8)', () => {
  it('explains a late or doubled action in a few words', () => {
    expect(rejectionText('STALE_INPUT')).toBe('Too late, that window closed');
    expect(rejectionText('NOT_AWAITED')).toBe('Too late, that window closed');
    expect(rejectionText('ALREADY_PICKED')).toBe('You already picked');
    expect(rejectionText('REROLL_LIMIT')).toBe('No rerolls left');
    expect(rejectionText('SLOT_ALREADY_REROLLED')).toBe('That card was already rerolled');
    expect(rejectionText('MATCH_FINISHED')).toBe('The match is over');
    expect(rejectionText('INVALID_INPUT')).toBe("That didn't work. Try again.");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/labels.test.ts`
Expected: FAIL with `Cannot find module '../src/hud/labels'`.

- [ ] **Step 3: Write the labels**

Create `apps/client/src/hud/labels.ts`:

```ts
import { STARTER_CARDS, cardById, targetCandidates, type ActiveEffect, type CardDef, type InputErrorCode, type PlayerId, type PlayerView, type TargetRule } from '@laddorious/core';
import type { PieceId } from '../service/matchService';

// Words and icons for cards and effects (spec #2 §7.2). The engine plays the starter set, so
// the client reads names, texts and targets from it.

/** How the HUD names each piece. */
export const PIECE_NAMES: Record<PieceId, string> = { knight: 'Knight', pawn: 'Pawn', meeple: 'Meeple', dragon: 'Dragon head' };

/** Icon names drawn by ui/Icon.tsx. */
export type IconName =
  | 'arrow' | 'die' | 'x2' | 'pad' | 'charm' | 'shield' | 'aegis' | 'push' | 'boot' | 'swap' | 'coin' | 'bait'
  | 'jackpot' | 'steady' | 'cleanse' | 'slide' | 'card' | 'lock' | 'check' | 'bolt' | 'eye' | 'reroll' | 'target'
  | 'qmark' | 'swords' | 'gear' | 'close' | 'play' | 'back' | 'next' | 'menu' | 'pencil' | 'trophy'
  | 'rock' | 'paper' | 'scissors';

const CARD_ICONS: Record<string, IconName> = {
  sprint: 'arrow',
  'loaded-die': 'die',
  overdrive: 'x2',
  'ladder-warp': 'pad',
  'snake-charm': 'charm',
  shield: 'shield',
  aegis: 'aegis',
  shove: 'push',
  'heavy-boots': 'boot',
  switcheroo: 'swap',
  'coin-flip': 'coin',
  'snake-bait': 'bait',
  jackpot: 'jackpot',
  'steady-hand': 'steady',
  cleanse: 'cleanse',
  'snake-pit': 'slide',
  'ladder-drop': 'pad',
};

export interface CardInfo {
  id: string;
  name: string;
  text: string;
  type: CardDef['type'];
  rarity: CardDef['rarity'];
  /** Who it aims at, as shown before picking: the exact target stays hidden until it resolves. */
  targetLine: string;
  icon: IconName;
}

/** The target line of a card (spec #2 §7.2). */
export function targetLine(rule: TargetRule): string {
  if (rule.condition === 'self') return 'You';
  if (rule.condition === 'section') return `A player on tiles ${rule.section?.[0]}–${rule.section?.[1]}`;
  if (rule.condition === 'ahead-of-caster') return rule.pick === 'furthest' ? 'Furthest player ahead' : 'Nearest player ahead';
  if (rule.condition === 'behind-of-caster') return rule.pick === 'furthest' ? 'Furthest player behind' : 'Nearest player behind';
  if (rule.pick === 'leader') return 'The leader';
  if (rule.pick === 'last') return 'The player in last place';
  return rule.pick === 'furthest' ? 'The furthest player' : 'The nearest player';
}

export function cardInfo(id: string): CardInfo {
  const card = cardById(STARTER_CARDS, id);
  return { id, name: card.name, text: card.text, type: card.type, rarity: card.rarity, targetLine: targetLine(card.target), icon: CARD_ICONS[id] ?? 'card' };
}

/**
 * Why a card would fizzle if the board stayed as it is now, or null (spec #2 §7.2). Uses the
 * engine's own targeting rules on the view, so the warning matches what will happen.
 */
export function fizzleWarning(id: string, view: PlayerView): string | null {
  const card = cardById(STARTER_CARDS, id);
  const me = view.players.find((p) => p.id === view.me);
  if (!me) return null;
  if (targetCandidates(view.players, me, card.target).length === 0) {
    if (card.target.condition === 'ahead-of-caster') return 'Nobody is ahead of you right now. If that holds, it fizzles.';
    if (card.target.condition === 'behind-of-caster') return 'Nobody is behind you right now. If that holds, it fizzles.';
    return 'Nobody it can aim at right now. If that holds, it fizzles.';
  }
  const needsLadderAhead = card.effects.some((op) => op.op === 'moveTo' && op.rule === 'nearest-ladder-foot-ahead');
  if (needsLadderAhead && !view.board.jumps.some((j) => j.to > j.from && j.from > me.position)) {
    return 'No launch pad ahead of you right now. If that holds, it fizzles.';
  }
  return null;
}

export interface EffectChip {
  id: string;
  icon: IconName;
  /** Short badge on the chip: "6", "×2", "−3", "=4", or the rounds left. */
  badge: string;
  name: string;
  /** What it does, written out (the your-piece panel and the details card). */
  description: string;
  /** How long it lasts. */
  life: string;
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

function lifeOf(effect: ActiveEffect): string {
  if (effect.lifetime === 'permanent') return 'Permanent';
  const parts: string[] = [];
  if (effect.lifetime.charges !== undefined) parts.push(effect.lifetime.charges === 1 ? '1 use' : `${effect.lifetime.charges} uses`);
  if (effect.lifetime.rounds !== undefined) parts.push(`until round ${effect.createdRound + effect.lifetime.rounds}`);
  return parts.join(' · ');
}

/** The chip for an active effect (spec #2 §7.2): icon, badge and words. */
export function effectChip(effect: ActiveEffect, names: ReadonlyMap<PlayerId, string>): EffectChip {
  const from = effect.sourcePlayer !== effect.owner ? `, from ${names.get(effect.sourcePlayer) ?? effect.sourcePlayer}` : '';
  const name = cardById(STARTER_CARDS, effect.sourceCard).name;
  const p = effect.params;
  const base = { id: effect.id, name, life: lifeOf(effect) };
  switch (p.hook) {
    case 'diceFace':
      return { ...base, icon: 'die', badge: String(p.set), description: `${p.die === 'each' ? 'Every die' : 'Next die'} shows ${p.set}${from}` };
    case 'diceTotal':
      if (p.op === 'multiply') return { ...base, icon: 'x2', badge: `×${p.value}`, description: `Next dice total ×${p.value}${from}` };
      if (p.op === 'replace') return { ...base, icon: 'steady', badge: `=${p.value}`, description: `Next dice total becomes ${p.value}${from}` };
      return { ...base, icon: p.value < 0 ? 'boot' : 'arrow', badge: signed(p.value), description: `Next dice total ${signed(p.value)}${from}` };
    case 'beforeSnake':
      return { ...base, icon: 'charm', badge: roundsBadge(effect), description: `Ignores the next slide${from}` };
    case 'beforeAttack':
      return { ...base, icon: 'shield', badge: roundsBadge(effect), description: `Blocks the next attack${from}` };
    case 'afterMove':
      return { ...base, icon: 'bait', badge: signed(p.amount), description: `Landing on a slide's vacuum moves you ${signed(p.amount)} after sliding${from}` };
  }
}

function roundsBadge(effect: ActiveEffect): string {
  if (effect.lifetime === 'permanent') return '∞';
  return effect.lifetime.charges !== undefined ? `×${effect.lifetime.charges}` : `${effect.lifetime.rounds ?? ''}r`;
}

/**
 * What changes my next roll, in the order the engine applies it (spec #1 §5.6): die faces,
 * then the newest Replace, then Multiply, then Add.
 */
export function nextRollMods(effects: ActiveEffect[], me: PlayerId): string[] {
  const mine = effects.filter((e) => e.owner === me).sort((a, b) => a.seq - b.seq);
  const out: string[] = [];
  for (const e of mine) if (e.params.hook === 'diceFace') out.push(`Die = ${e.params.set}`);
  const totals = mine.flatMap((e) => (e.params.hook === 'diceTotal' ? [e.params] : []));
  const replace = totals.filter((t) => t.op === 'replace').at(-1);
  if (replace) out.push(`Total = ${replace.value}`);
  for (const t of totals) if (t.op === 'multiply') out.push(`Total ×${t.value}`);
  for (const t of totals) if (t.op === 'add') out.push(`Total ${signed(t.value)}`);
  return out;
}

/** A toast for an action the match turned down (spec #2 §8): usually a late or doubled tap. */
export function rejectionText(code: InputErrorCode): string {
  switch (code) {
    case 'STALE_INPUT':
    case 'STALE_TIMEOUT':
    case 'NOT_AWAITED':
    case 'WRONG_PHASE':
      return 'Too late, that window closed';
    case 'ALREADY_PICKED':
      return 'You already picked';
    case 'REROLL_LIMIT':
      return 'No rerolls left';
    case 'SLOT_ALREADY_REROLLED':
      return 'That card was already rerolled';
    case 'MATCH_FINISHED':
      return 'The match is over';
    default:
      return "That didn't work. Try again.";
  }
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/labels.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  45 passed (45)` and `Tests  314 passed (314)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): label cards, effects and rejected actions for the HUD

Card names, rules text, target lines and fizzle warnings come from the
engine's starter set and targeting rules; effects become chips with
badges; next-roll modifiers follow the engine's order; rejections become
short toasts (spec #2 §7.2, §8).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: This round's record and the event feed

**Files:**
- Create: `apps/client/src/hud/record.ts`, `apps/client/src/hud/feed.ts`, `apps/client/test/record.test.ts`

**Interfaces:**
- Consumes: `LoggedEvent` (Task 3) and `cardInfo` (Task 4).
- Produces:
  - `roundRecord(log): RoundRecord`, holding `dice` (faces, forced, total) and `cards` (cardId and result) since the latest `RoundStarted`;
  - `type FeedPart = string | { player }` and `FeedLine { seq, parts, private }`;
  - `FEED_LINES` (5), `listParts(players)` and `feedLines(log, max?)`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/record.test.ts`:

```ts
import type { EventBody, GameEvent } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { LoggedEvent } from '../src/director/director';
import { FEED_LINES, feedLines } from '../src/hud/feed';
import { roundRecord } from '../src/hud/record';

const pub = (body: EventBody): GameEvent => ({ ...body, visibility: 'public' });
const mine = (body: EventBody): GameEvent => ({ ...body, visibility: { private: 'p0' } });
const logOf = (events: GameEvent[]): LoggedEvent[] => events.map((event, i) => ({ seq: i + 1, event }));

describe('the round record', () => {
  it("keeps only this round's dice and cards", () => {
    const record = roundRecord(
      logOf([
        pub({ type: 'RoundStarted', round: 6 }),
        pub({ type: 'DieRolled', player: 'p1', natural: 2, face: 2, forced: false, auto: false }),
        pub({ type: 'CardSelected', player: 'p1', cardId: 'shove', cardType: 'attack', rarity: 'common', auto: false }),
        pub({ type: 'RoundStarted', round: 7 }),
        pub({ type: 'DieRolled', player: 'p0', natural: 3, face: 6, forced: true, auto: false }),
        pub({ type: 'DieRolled', player: 'p3', natural: 5, face: 5, forced: false, auto: true }),
        pub({ type: 'DiceTotaled', player: 'p3', faces: [5], total: 2 }),
        pub({ type: 'CardSelected', player: 'p2', cardId: 'sprint', cardType: 'movement', rarity: 'common', auto: false }),
        pub({ type: 'CardResolved', caster: 'p2', cardId: 'sprint', target: 'p2', result: 'hit' }),
      ]),
    );
    expect(record.round).toBe(7);
    expect(record.dice).toEqual({
      p0: { faces: [6], forced: [true], total: null },
      p3: { faces: [5], forced: [false], total: 2 },
    });
    expect(record.cards).toEqual({ p2: { cardId: 'sprint', result: 'hit' } });
  });

  it('starts at the beginning of the log in round 1', () => {
    const record = roundRecord(logOf([pub({ type: 'DieRolled', player: 'p1', natural: 4, face: 4, forced: false, auto: false })]));
    expect(record.round).toBeNull();
    expect(record.dice.p1?.faces).toEqual([4]);
  });
});

describe('feed lines (spec #2 §7.2)', () => {
  it('writes the newest line first, with names as parts and private lines marked', () => {
    const lines = feedLines(
      logOf([
        pub({ type: 'RoundStarted', round: 7 }),
        pub({ type: 'DieRolled', player: 'p1', natural: 4, face: 4, forced: false, auto: false }),
        pub({ type: 'ChallengeStarted', challengeId: 'c9', tile: 23, players: ['p0', 'p1', 'p2'], kind: 'minority', theme: ['Sun', 'Moon'] }),
        mine({ type: 'ChallengePickEcho', challengeId: 'c9', player: 'p0', choice: 'B' }),
      ]),
    );
    expect(lines).toEqual([
      { seq: 4, parts: ['You picked ', 'Moon'], private: true },
      { seq: 3, parts: ['Face-off on tile 23: ', { player: 'p0' }, ', ', { player: 'p1' }, ' and ', { player: 'p2' }], private: false },
      { seq: 2, parts: [{ player: 'p1' }, ' rolled 4'], private: false },
      { seq: 1, parts: ['Round 7 started'], private: false },
    ]);
  });

  it('describes moves, face-offs, cards and the win', () => {
    const text = (e: GameEvent) =>
      feedLines(logOf([e]))[0]?.parts.map((p) => (typeof p === 'string' ? p : `<${p.player}>`)).join('') ?? null;
    expect(text(pub({ type: 'Moved', player: 'p2', from: 40, to: 12, cause: 'snake', bounced: false }))).toBe('<p2> slid down to 12');
    expect(text(pub({ type: 'Moved', player: 'p2', from: 4, to: 26, cause: 'ladder', bounced: false }))).toBe('<p2> launched up to 26');
    expect(text(pub({ type: 'Moved', player: 'p2', from: 20, to: 17, cause: 'knockback', bounced: false }))).toBe('<p2> was knocked back to 17');
    expect(text(pub({ type: 'Moved', player: 'p2', from: 3, to: 6, cause: 'dice', bounced: false }))).toBeNull();
    expect(text(pub({ type: 'DiceTotaled', player: 'p3', faces: [5], total: 2 }))).toBe('<p3> moves 2 instead of 5');
    expect(text(pub({ type: 'DiceTotaled', player: 'p3', faces: [5], total: 5 }))).toBeNull();
    expect(text(pub({ type: 'ChallengeResolved', challengeId: 'c1', pickRound: 1, picks: { p0: 'rock', p1: 'rock' }, winner: null, losers: [], outcome: 'replay' }))).toBe('A tie! The face-off goes again');
    expect(text(pub({ type: 'ChallengeResolved', challengeId: 'c1', pickRound: 2, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win' }))).toBe('<p1> wins the face-off');
    expect(text(mine({ type: 'MysteryOffered', player: 'p0', tile: 9, rarity: 'epic', cards: ['aegis', 'aegis', 'jackpot'] }))).toBe('You landed on an Epic ? square');
    expect(text(mine({ type: 'CardRerolled', player: 'p0', slot: 1, from: 'shove', to: 'sprint' }))).toBe('You rerolled Shove into Sprint');
    expect(text(pub({ type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p2', result: 'hit' }))).toBe('Shove hit <p2>');
    expect(text(pub({ type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p2', result: 'blocked' }))).toBe('<p2> blocked Shove');
    expect(text(pub({ type: 'CardResolved', caster: 'p1', cardId: 'switcheroo', target: null, result: 'fizzled' }))).toBe("<p1>'s Switcheroo fizzled");
    expect(text(pub({ type: 'CardResolved', caster: 'p2', cardId: 'sprint', target: 'p2', result: 'hit' }))).toBe('<p2> used Sprint');
    expect(text(pub({ type: 'MatchWon', winner: 'p2', rankings: [] }))).toBe('<p2> wins the match!');
  });

  it(`keeps at most ${FEED_LINES} lines`, () => {
    const many = Array.from({ length: 9 }, (_, i) => pub({ type: 'RoundStarted', round: i + 1 }));
    const lines = feedLines(logOf(many));
    expect(lines).toHaveLength(FEED_LINES);
    expect(lines[0]!.parts).toEqual(['Round 9 started']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/record.test.ts`
Expected: FAIL with `Cannot find module '../src/hud/record'`.

- [ ] **Step 3: Implement the record and the feed**

Create `apps/client/src/hud/record.ts`:

```ts
import type { CardResult, PlayerId } from '@laddorious/core';
import type { LoggedEvent } from '../director/director';

// This round, as the HUD has shown it so far: everyone's dice and cards (spec #2 §7.2).

export interface DiceRecord {
  faces: number[];
  /** Per face: a card set it (forced faces flash, §5.1). */
  forced: boolean[];
  /** The total after modifiers, once the dice phase has closed. */
  total: number | null;
}

export interface CardRecord {
  cardId: string;
  /** Hit, Blocked or Fizzled once the card has resolved. */
  result: CardResult | null;
}

export interface RoundRecord {
  round: number | null;
  dice: Record<PlayerId, DiceRecord>;
  /** Cards revealed this round, by caster, in reveal order. */
  cards: Record<PlayerId, CardRecord>;
}

/** Everything logged since the latest RoundStarted (or since the start, in round 1). */
export function roundRecord(log: readonly LoggedEvent[]): RoundRecord {
  let start = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i]!.event.type === 'RoundStarted') {
      start = i;
      break;
    }
  }
  const record: RoundRecord = { round: null, dice: {}, cards: {} };
  for (const { event: e } of log.slice(start)) {
    switch (e.type) {
      case 'RoundStarted':
        record.round = e.round;
        break;
      case 'DieRolled': {
        const dice = (record.dice[e.player] ??= { faces: [], forced: [], total: null });
        dice.faces.push(e.face);
        dice.forced.push(e.forced);
        break;
      }
      case 'DiceTotaled':
        record.dice[e.player] = { faces: [...e.faces], forced: record.dice[e.player]?.forced ?? e.faces.map(() => false), total: e.total };
        break;
      case 'CardSelected':
        record.cards[e.player] = { cardId: e.cardId, result: null };
        break;
      case 'CardResolved': {
        const card = record.cards[e.caster];
        if (card && card.cardId === e.cardId) card.result = e.result;
        break;
      }
    }
  }
  return record;
}
```

Create `apps/client/src/hud/feed.ts`:

```ts
import type { ChallengeChoice, GameEvent, PlayerId } from '@laddorious/core';
import type { LoggedEvent } from '../director/director';
import { cardInfo } from './labels';

// Event feed lines (spec #2 §7.2): built from the events the director has shown.

/** Plain text, or a player's name (drawn in their seat colour). */
export type FeedPart = string | { player: PlayerId };

export interface FeedLine {
  seq: number;
  parts: FeedPart[];
  /** Only I can see it (my picks, my rerolls): drawn dashed. */
  private: boolean;
}

/** How many lines the feed keeps; phones show the first 3 (§7.2). */
export const FEED_LINES = 5;

const RARITY_PHRASE = { common: 'a Common', rare: 'a Rare', epic: 'an Epic' } as const;
const RPS_WORD: Record<string, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

/** "A", "A and B", "A, B and C" as parts. */
export function listParts(players: PlayerId[]): FeedPart[] {
  return players.flatMap((player, i): FeedPart[] => {
    const sep = i === 0 ? [] : i === players.length - 1 ? [' and '] : [', '];
    return [...sep, { player }];
  });
}

function choiceWord(choice: ChallengeChoice, theme: [string, string] | null | undefined): string {
  if (choice === 'A' || choice === 'B') return theme ? theme[choice === 'A' ? 0 : 1] : choice;
  return RPS_WORD[choice] ?? choice;
}

function lineFor(e: GameEvent, themes: ReadonlyMap<string, [string, string] | null>): FeedPart[] | null {
  switch (e.type) {
    case 'RoundStarted':
      return [`Round ${e.round} started`];
    case 'DieRolled':
      return [{ player: e.player }, ` rolled ${e.face}${e.forced ? ' (set by a card)' : ''}`];
    case 'DiceTotaled': {
      const sum = e.faces.reduce((a, b) => a + b, 0);
      return e.total === sum ? null : [{ player: e.player }, ` moves ${e.total} instead of ${sum}`];
    }
    case 'Moved':
      switch (e.cause) {
        case 'snake':
          return [{ player: e.player }, ` slid down to ${e.to}`];
        case 'ladder':
          return [{ player: e.player }, ` launched up to ${e.to}`];
        case 'knockback':
          return [{ player: e.player }, ` was knocked back to ${e.to}`];
        case 'card':
        case 'effect':
          return [{ player: e.player }, ` leapt to ${e.to}`];
        case 'stepBack':
          return [{ player: e.player }, ` stepped back to ${e.to}`];
        case 'dice':
          return null;
      }
      return null;
    case 'SnakeBlocked':
      return [{ player: e.player }, ' dodged a slide'];
    case 'ChallengeStarted':
      return [`Face-off on tile ${e.tile}: `, ...listParts(e.players)];
    case 'ChallengePickEcho':
      return ['You picked ', choiceWord(e.choice, themes.get(e.challengeId))];
    case 'ChallengeResolved':
      if (e.outcome === 'replay') return ['A tie! The face-off goes again'];
      if (e.outcome === 'continue') return ['The face-off goes on with ', ...listParts(Object.keys(e.picks).filter((p) => !e.losers.includes(p)))];
      return e.winner ? [{ player: e.winner }, e.outcome === 'random' ? ' wins the face-off by lot' : ' wins the face-off'] : null;
    case 'MysteryOffered':
      return [`You landed on ${RARITY_PHRASE[e.rarity]} ? square`];
    case 'CardRerolled':
      return ['You rerolled ', cardInfo(e.from).name, ' into ', cardInfo(e.to).name];
    case 'CardSelected':
      return [{ player: e.player }, ' picked ', cardInfo(e.cardId).name];
    case 'CardResolved': {
      const name = cardInfo(e.cardId).name;
      if (e.result === 'fizzled') return [{ player: e.caster }, `'s ${name} fizzled`];
      if (e.result === 'blocked' && e.target) return [{ player: e.target }, ` blocked ${name}`];
      if (e.target && e.target !== e.caster) return [name, ' hit ', { player: e.target }];
      return [{ player: e.caster }, ` used ${name}`];
    }
    case 'Clash':
      return ['Clash! ', e.cardIds.map((id) => cardInfo(id).name).join(' and '), ' cancel out'];
    case 'BoardEdited':
      return [{ player: e.edit.sourcePlayer }, ` changed the board with ${cardInfo(e.edit.sourceCard).name}`];
    case 'MatchWon':
      return [{ player: e.winner }, ' wins the match!'];
    default:
      return null;
  }
}

/** The newest feed lines first, at most `max`. */
export function feedLines(log: readonly LoggedEvent[], max = FEED_LINES): FeedLine[] {
  const themes = new Map<string, [string, string] | null>();
  const lines: FeedLine[] = [];
  for (const { seq, event } of log) {
    if (event.type === 'ChallengeStarted') themes.set(event.challengeId, event.theme);
    const parts = lineFor(event, themes);
    if (parts) lines.push({ seq, parts, private: event.visibility !== 'public' });
  }
  return lines.slice(-max).reverse();
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/record.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  46 passed (46)` and `Tests  319 passed (319)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): build this round's record and the event feed

Everyone's dice and cards since the round started, and feed lines built
from shown events, newest first, with private ones marked (spec #2
§7.2).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The HUD model

**Files:**
- Create: `apps/client/src/hud/model.ts`, `apps/client/test/model.test.ts`

**Interfaces:**
- Consumes: Tasks 3–5; `Beat` and `PresentationState` (Phase 3).
- Produces:
  - Constants: `MAX_REROLLS` and `KNOCKBACK` (from the engine config) and `STAGES`.
  - Stage bar: `stageIndex(beat, window, previous)`, `stageFromLog(log)` and `countdown(timer, durationMs, now)`.
  - Player rows: `type RowStatus`, `interface PlayerRow` and `playerRows({ view, presentation, record, seats, me, watch })`.
  - Dock: `type DockModel` (`roll`, `wait`, `caption`, `queue` or `none`), `QueueCard`, `resolutionQueue(record, beat)` and `dockModel({ beat, view, record, me })`.
  - Popups: `Fighter`, `FaceOffModel`, `faceOffModel({ beat, view, me })`, `CardSlot`, `CardPickModel` and `cardPickModel(view, maxRerolls?)`.
  - Banners: `BannerModel` and `bannerFor(beat, me, seats)`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/model.test.ts`:

```ts
import type { ActiveEffect, GameEvent, PlayerView, PublicChallenge } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { Beat } from '../src/director/beats';
import { presentationFromView } from '../src/director/presentation';
import { KNOCKBACK, MAX_REROLLS, STAGES, bannerFor, cardPickModel, countdown, dockModel, faceOffModel, playerRows, resolutionQueue, stageFromLog, stageIndex } from '../src/hud/model';
import type { RoundRecord } from '../src/hud/record';
import { SEATS, openingUpdate } from './support/fixtures';

const EMPTY: RoundRecord = { round: 1, dice: {}, cards: {} };

/** The opening view (dice window, everyone to roll) with tiles and other changes. */
function view(positions: Record<string, number> = {}, change: Partial<PlayerView> = {}): PlayerView {
  const base = openingUpdate().view;
  return { ...base, players: base.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })), ...change };
}

function challenge(over: Partial<PublicChallenge> = {}): PublicChallenge {
  return { id: 'c4', tile: 23, participants: ['p0', 'p1'], contesting: ['p0', 'p1'], kind: 'rps', theme: null, pickRound: 1, picked: [], winner: null, ...over };
}

const beat = (kind: Beat['kind'], events: GameEvent[] = []): Beat => ({ kind, durationMs: 500, events, after: presentationFromView(view()) });

function rows(v: PlayerView, record = EMPTY, watch: string | null = null) {
  return playerRows({ view: v, presentation: presentationFromView(v), record, seats: SEATS, me: 'p0', watch });
}

describe('stage bar', () => {
  it('follows the beat on stage, then the open window, and keeps the stage through follow-on beats', () => {
    expect(STAGES.map((s) => s.label)).toEqual(['Dice', 'Move', 'Face-off', 'Mystery', 'Cards']);
    expect(stageIndex(beat('roll'), 'dice', null)).toBe(0);
    expect(stageIndex(beat('move'), 'dice', 0)).toBe(1);
    expect(stageIndex(beat('slide'), 'dice', 4)).toBe(4);
    expect(stageIndex(null, 'challenge', 1)).toBe(2);
    expect(stageIndex(null, 'mystery', 1)).toBe(3);
    expect(stageIndex(beat('cardResolved'), 'mystery', 3)).toBe(4);
    expect(stageIndex(null, 'none', 4)).toBe(4);
  });

  it('finds the stage of the latest logged events', () => {
    const at = (events: GameEvent[]) => stageFromLog(events.map((event, i) => ({ seq: i + 1, event })));
    const dice: GameEvent = { type: 'Moved', player: 'p1', from: 0, to: 4, cause: 'dice', bounced: false, visibility: 'public' };
    const slide: GameEvent = { ...dice, from: 4, to: 1, cause: 'snake' };
    const card: GameEvent = { type: 'CardResolved', caster: 'p1', cardId: 'sprint', target: 'p1', result: 'hit', visibility: 'public' };
    expect(at([])).toBeNull();
    expect(at([dice, slide])).toBe(1);
    expect(at([card, slide])).toBe(4);
  });

  it('counts the window down', () => {
    expect(countdown({ endsAt: 12_000 }, 12_000, 4_500)).toEqual({ seconds: 8, fraction: 0.625 });
    expect(countdown({ endsAt: 12_000 }, 12_000, 20_000)).toEqual({ seconds: 0, fraction: 0 });
    expect(countdown(null, 12_000, 0)).toBeNull();
  });
});

describe('player rows (spec #2 §7.2)', () => {
  it('sorts by tile, shares ranks on a tile, and marks my row and the watched one', () => {
    const list = rows(view({ p0: 30, p1: 52, p2: 30, p3: 7 }), EMPTY, 'p3');
    expect(list.map((r) => [r.seat.playerId, r.tile, r.rank])).toEqual([['p1', 52, 1], ['p0', 30, 2], ['p2', 30, 2], ['p3', 7, 4]]);
    expect(list.find((r) => r.me)?.seat.playerId).toBe('p0');
    expect(list.find((r) => r.watched)?.seat.playerId).toBe('p3');
  });

  it('shows who still has to roll', () => {
    const v = view({}, { awaiting: { windowId: 3, window: 'dice', players: ['p0', 'p2'], durationMs: 12_000 } });
    expect(rows(v).map((r) => [r.seat.playerId, r.status])).toEqual([['p0', 'turn'], ['p1', 'done'], ['p2', 'waiting'], ['p3', 'done']]);
  });

  it('shows dice, effects, the "?" chip before a pick, a face-down card after it, and the revealed card', () => {
    const effect: ActiveEffect = { id: 'e1', owner: 'p1', sourceCard: 'shield', sourcePlayer: 'p1', params: { hook: 'beforeAttack' }, lifetime: { rounds: 3, charges: 1 }, createdRound: 1, seq: 1 };
    const base = view({ p0: 5, p1: 9, p2: 12, p3: 2 });
    const mystery = { ...base.board.mystery, 5: 'rare' as const, 9: 'epic' as const };
    const v: PlayerView = {
      ...base,
      board: { ...base.board, mystery },
      effects: [effect],
      phase: { kind: 'mysterySelect', picked: { p0: false, p1: true } },
      awaiting: { windowId: 9, window: 'mystery', players: ['p0'], durationMs: 15_000 },
    };
    const record: RoundRecord = { round: 1, dice: { p2: { faces: [5], forced: [false], total: 2 } }, cards: { p3: { cardId: 'sprint', result: 'hit' } } };
    const byId = Object.fromEntries(rows(v, record).map((r) => [r.seat.playerId, r]));
    expect(byId.p0).toMatchObject({ mystery: 'rare', card: null, status: 'turn' });
    expect(byId.p1).toMatchObject({ mystery: null, card: 'facedown', status: 'locked' });
    expect(byId.p1!.effects.map((e) => e.name)).toEqual(['Shield']);
    expect(byId.p2).toMatchObject({ dice: { faces: [5], total: 2 }, status: 'idle' });
    expect(byId.p3!.card).toEqual({ cardId: 'sprint', result: 'hit' });
  });
});

describe('the dock (spec #2 §7.2)', () => {
  it('offers ROLL in my dice window, else names who is still rolling', () => {
    expect(dockModel({ beat: null, view: view(), record: EMPTY, me: 'p0' })).toEqual({ kind: 'roll', windowId: 1 });
    const v = view({}, { awaiting: { windowId: 1, window: 'dice', players: ['p2'], durationMs: 12_000 } });
    expect(dockModel({ beat: null, view: v, record: EMPTY, me: 'p0' })).toEqual({ kind: 'wait', parts: ['Waiting for ', { player: 'p2' }, ' to roll'] });
  });

  it('waits for a face-off I am not in, and shows nothing when I am in it', () => {
    const settle = { kind: 'settle' as const, challenges: [challenge({ participants: ['p1', 'p2'], contesting: ['p1', 'p2'] })] };
    const v = view({}, { phase: settle, awaiting: { windowId: 4, window: 'challenge', players: ['p1', 'p2'], durationMs: 8_000 } });
    expect(dockModel({ beat: null, view: v, record: EMPTY, me: 'p0' })).toEqual({
      kind: 'wait',
      parts: ['Face-off on tile 23: waiting for ', { player: 'p1' }, ' and ', { player: 'p2' }],
    });
    expect(dockModel({ beat: null, view: v, record: EMPTY, me: 'p1' })).toEqual({ kind: 'none' });
  });

  it('names who still picks a card', () => {
    const v = view({}, { phase: { kind: 'mysterySelect', picked: { p1: false, p3: false } }, awaiting: { windowId: 6, window: 'mystery', players: ['p1', 'p3'], durationMs: 15_000 } });
    expect(dockModel({ beat: null, view: v, record: EMPTY, me: 'p0' })).toEqual({ kind: 'wait', parts: ['Waiting for ', { player: 'p1' }, ' and ', { player: 'p3' }, ' to pick their cards'] });
  });

  it('captions moves with this round’s totals, and slides with who slides', () => {
    const record: RoundRecord = { round: 2, dice: { p0: { faces: [4], forced: [false], total: null }, p1: { faces: [5], forced: [false], total: 2 } }, cards: {} };
    expect(dockModel({ beat: beat('move'), view: view(), record, me: 'p0' })).toEqual({
      kind: 'caption',
      parts: ['Everyone moves'],
      totals: [{ player: 'p0', total: 4 }, { player: 'p1', total: 2 }],
    });
    const slide: GameEvent = { type: 'Moved', player: 'p3', from: 40, to: 12, cause: 'snake', bounced: false, visibility: 'public' };
    expect(dockModel({ beat: beat('slide', [slide]), view: view(), record, me: 'p0' })).toEqual({ kind: 'caption', parts: [{ player: 'p3' }, ' slides down'], totals: null });
  });

  it('lists the cards in resolution order with their results, marking the one resolving', () => {
    const record: RoundRecord = {
      round: 7,
      dice: {},
      cards: { p0: { cardId: 'aegis', result: null }, p1: { cardId: 'heavy-boots', result: null }, p3: { cardId: 'sprint', result: 'hit' } },
    };
    const resolving: GameEvent = { type: 'CardResolved', caster: 'p0', cardId: 'aegis', target: 'p0', result: 'hit', visibility: 'public' };
    expect(resolutionQueue(record, beat('cardResolved', [resolving]))).toEqual([
      { caster: 'p3', cardId: 'sprint', result: 'hit', current: false },
      { caster: 'p0', cardId: 'aegis', result: null, current: true },
      { caster: 'p1', cardId: 'heavy-boots', result: null, current: false },
    ]);
  });
});

describe('the face-off popup (spec #2 §7.2, C11)', () => {
  const settle = (c: PublicChallenge): Partial<PlayerView> => ({
    phase: { kind: 'settle', challenges: [c] },
    awaiting: { windowId: 4, window: 'challenge', players: c.contesting.filter((p) => !c.picked.includes(p)), durationMs: 8_000 },
  });

  it('shows only to its players, with lock states, and lets me pick once', () => {
    const v = view({}, settle(challenge({ picked: ['p1'] })));
    expect(faceOffModel({ beat: null, view: { ...v, me: 'p2' }, me: 'p2' })).toBeNull();
    const model = faceOffModel({ beat: null, view: v, me: 'p0' })!;
    expect(model).toMatchObject({ challengeId: 'c4', tile: 23, kind: 'rps', canPick: true, myPick: null });
    expect(model.choices.map((c) => c.label)).toEqual(['Rock', 'Paper', 'Scissors']);
    expect(model.fighters).toEqual([
      { player: 'p0', locked: false, pick: null, out: false },
      { player: 'p1', locked: true, pick: null, out: false },
    ]);
    const picked = faceOffModel({ beat: null, view: { ...v, myPicks: { c4: 'rock' } }, me: 'p0' })!;
    expect(picked).toMatchObject({ canPick: false, myPick: 'rock' });
  });

  it("uses the Minority theme's two choices", () => {
    const v = view({}, settle(challenge({ participants: ['p0', 'p1', 'p2'], contesting: ['p0', 'p1', 'p2'], kind: 'minority', theme: ['Sun', 'Moon'] })));
    expect(faceOffModel({ beat: null, view: v, me: 'p0' })!.choices).toEqual([
      { choice: 'A', label: 'Sun' },
      { choice: 'B', label: 'Moon' },
    ]);
  });

  it('reveals the picks while the result plays', () => {
    const v = view({}, settle(challenge({ picked: ['p0', 'p1'] })));
    const resolved: GameEvent = { type: 'ChallengeResolved', challengeId: 'c4', pickRound: 1, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win', visibility: 'public' };
    expect(faceOffModel({ beat: beat('faceOffResult', [resolved]), view: v, me: 'p0' })).toMatchObject({
      canPick: false,
      result: { winner: 'p1' },
      fighters: [
        { player: 'p0', pick: 'rock' },
        { player: 'p1', pick: 'paper' },
      ],
    });
  });
});

describe('the card-pick popup (spec #2 §7.2)', () => {
  const offerView = (rerolled: [boolean, boolean, boolean], rerollsUsed: number, picked: number | null = null) =>
    view({ p0: 9 }, {
      phase: { kind: 'mysterySelect', picked: { p0: picked !== null } },
      myOffer: { player: 'p0', tile: 9, rarity: 'epic', cards: ['aegis', 'switcheroo', 'jackpot'], rerolled, rerollsUsed, picked, autoPicked: false },
      awaiting: { windowId: 7, window: 'mystery', players: picked === null ? ['p0'] : [], durationMs: 15_000 },
    });

  it('offers my three cards with rerolls, warning about a fizzle', () => {
    const model = cardPickModel(offerView([false, false, false], 0))!;
    expect(model.rerollsLeft).toBe(MAX_REROLLS);
    expect(model.slots.map((s) => [s.info.name, s.canReroll])).toEqual([['Aegis', true], ['Switcheroo', true], ['Jackpot', true]]);
    expect(model.slots[1]!.warning).toBe('Nobody is ahead of you right now. If that holds, it fizzles.');
  });

  it('disables a rerolled slot, and every slot once the rerolls run out', () => {
    expect(cardPickModel(offerView([false, true, false], 1))!.slots.map((s) => s.canReroll)).toEqual([true, false, true]);
    expect(cardPickModel(offerView([true, true, false], 2))!.slots.map((s) => s.canReroll)).toEqual([false, false, false]);
  });

  it('is gone once I have picked, and for players without an offer', () => {
    expect(cardPickModel(offerView([false, false, false], 0, 1))).toBeNull();
    expect(cardPickModel(view())).toBeNull();
  });
});

describe('banners (spec #2 §5.1)', () => {
  const resolved = (over: Partial<Extract<GameEvent, { type: 'ChallengeResolved' }>>): GameEvent => ({
    type: 'ChallengeResolved', challengeId: 'c4', pickRound: 1, picks: { p0: 'rock', p1: 'paper' }, winner: 'p1', losers: ['p0'], outcome: 'win', visibility: 'public', ...over,
  });
  const card = (over: Partial<Extract<GameEvent, { type: 'CardResolved' }>>): GameEvent => ({ type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p0', result: 'hit', visibility: 'public', ...over });
  const banner = (kind: Beat['kind'], events: GameEvent[]) => bannerFor(beat(kind, events), 'p0', SEATS);

  it('calls out my own face-off and how it ends for me', () => {
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c4', tile: 23, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' };
    expect(banner('faceOff', [started])).toEqual({ text: 'FACE-OFF!', tone: 'bad' });
    expect(banner('faceOff', [{ ...started, players: ['p2', 'p3'] }])).toBeNull();
    expect(banner('faceOffResult', [resolved({})])).toEqual({ text: 'YOU LOSE', tone: 'bad' });
    expect(banner('faceOffResult', [resolved({ winner: 'p0', losers: ['p1'] })])).toEqual({ text: 'YOU WIN!', tone: 'good' });
    expect(banner('faceOffResult', [resolved({ winner: null, losers: [], outcome: 'replay' })])).toEqual({ text: 'DRAW!', tone: 'info' });
    expect(banner('faceOffResult', [resolved({ picks: { p2: 'rock', p3: 'paper' }, winner: 'p3', losers: ['p2'] })])).toBeNull();
  });

  it('calls out cards that touch me, the reveal and clashes', () => {
    expect(banner('cardReveal', [])).toEqual({ text: 'CARDS REVEALED', tone: 'info' });
    expect(banner('cardResolved', [card({})])).toEqual({ text: 'HIT!', tone: 'bad' });
    expect(banner('cardResolved', [card({ result: 'blocked' })])).toEqual({ text: 'BLOCKED!', tone: 'cool' });
    expect(banner('cardResolved', [card({ caster: 'p0', target: null, result: 'fizzled' })])).toEqual({ text: 'FIZZLED', tone: 'info' });
    expect(banner('cardResolved', [card({ target: 'p2' })])).toBeNull();
    expect(banner('clash', [{ type: 'Clash', cardIds: ['switcheroo', 'shove'], casters: ['p0', 'p2'], players: ['p0', 'p2'], visibility: 'public' }])).toEqual({ text: 'CLASH!', tone: 'bad' });
  });

  it('calls out my dodged slide and the winner of the match', () => {
    expect(banner('snakeBlocked', [{ type: 'SnakeBlocked', player: 'p0', tile: 47, effectId: 'e1', visibility: 'public' }])).toEqual({ text: 'DODGED!', tone: 'cool' });
    const won = (winner: string): GameEvent => ({ type: 'MatchWon', winner, rankings: [], visibility: 'public' });
    expect(banner('victory', [won('p0')])).toEqual({ text: 'VICTORY!', tone: 'good' });
    expect(banner('victory', [won('p2')])).toEqual({ text: 'PIP WINS!', tone: 'info' });
    expect(KNOCKBACK).toBe(3);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/model.test.ts`
Expected: FAIL with `Cannot find module '../src/hud/model'`.

- [ ] **Step 3: Write the model**

Create `apps/client/src/hud/model.ts`:

```ts
import {
  CARD_TYPES,
  RARITY_ORDER,
  resolveConfig,
  type ChallengeChoice,
  type GameEvent,
  type PlayerId,
  type PlayerView,
  type Rarity,
  type WindowKind,
} from '@laddorious/core';
import type { Beat } from '../director/beats';
import type { LoggedEvent } from '../director/director';
import type { PresentationState } from '../director/presentation';
import type { SeatInfo } from '../service/matchService';
import { listParts, type FeedPart } from './feed';
import { cardInfo, effectChip, fizzleWarning, type CardInfo, type EffectChip, type IconName } from './labels';
import type { CardRecord, DiceRecord, RoundRecord } from './record';

// What the match HUD shows, as plain data (spec #2 §7.2). Components only draw it.

/** The local host plays the engine's default rules, so the reroll limit is the default one. */
const RULES = resolveConfig({ seed: 'client' });
export const MAX_REROLLS = RULES.mystery.maxRerolls;
/** How far a face-off's loser is knocked back (spec #1 D3). */
export const KNOCKBACK = RULES.collision.knockback;

// ---------------------------------------------------------------- stage bar

export interface Stage {
  id: 'dice' | 'move' | 'faceOff' | 'mystery' | 'cards';
  label: string;
  icon: IconName;
}

export const STAGES: readonly Stage[] = [
  { id: 'dice', label: 'Dice', icon: 'die' },
  { id: 'move', label: 'Move', icon: 'arrow' },
  { id: 'faceOff', label: 'Face-off', icon: 'swords' },
  { id: 'mystery', label: 'Mystery', icon: 'qmark' },
  { id: 'cards', label: 'Cards', icon: 'card' },
];

const BEAT_STAGE: Partial<Record<Beat['kind'], number>> = {
  roll: 0,
  move: 1,
  faceOff: 2,
  faceOffResult: 2,
  cardReveal: 4,
  cardResolved: 4,
  clash: 4,
  cardMove: 4,
};
const WINDOW_STAGE: Partial<Record<WindowKind, number>> = { dice: 0, challenge: 2, mystery: 3 };

/**
 * The current stage (index into STAGES). Beats that follow from another (a slide, a launch,
 * a knockback, a board edit) keep the stage they happen in, so the bar doesn't jump back.
 */
export function stageIndex(beat: Beat | null, window: WindowKind | null, previous: number | null): number | null {
  if (beat) return BEAT_STAGE[beat.kind] ?? previous ?? 1;
  return (window ? WINDOW_STAGE[window] : undefined) ?? previous;
}

/** The stage the latest logged events belong to: what a follow-on beat keeps showing. */
export function stageFromLog(log: readonly LoggedEvent[]): number | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!.event;
    switch (e.type) {
      case 'RoundStarted':
      case 'DieRolled':
        return 0;
      case 'Moved':
        if (e.cause === 'dice') return 1;
        break;
      case 'ChallengeStarted':
      case 'ChallengeResolved':
        return 2;
      case 'MysteryOffered':
        return 3;
      case 'CardSelected':
      case 'CardResolved':
      case 'Clash':
        return 4;
    }
  }
  return null;
}

/** Seconds left on the open window's countdown, and how full its bar is (0–1). */
export function countdown(timer: { endsAt: number } | null, durationMs: number, nowMs: number): { seconds: number; fraction: number } | null {
  if (!timer || durationMs <= 0) return null;
  const left = Math.max(0, Math.min(durationMs, timer.endsAt - nowMs));
  return { seconds: Math.ceil(left / 1000), fraction: left / durationMs };
}

// ---------------------------------------------------------------- player column

export type RowStatus = 'turn' | 'waiting' | 'done' | 'locked' | 'idle';

export interface PlayerRow {
  seat: SeatInfo;
  tile: number;
  /** 1 is in front; players on the same tile share a rank. */
  rank: number;
  me: boolean;
  watched: boolean;
  status: RowStatus;
  statusText: string;
  dice: DiceRecord | null;
  /** On a "?" square with a card still to pick: the square's rarity (spec #2 §7.2). */
  mystery: Rarity | null;
  effects: EffectChip[];
  /** Face-down until the reveal, then the card with its result. */
  card: 'facedown' | CardRecord | null;
}

export interface RowsInput {
  view: PlayerView;
  presentation: PresentationState;
  record: RoundRecord;
  seats: SeatInfo[];
  me: PlayerId;
  watch: PlayerId | null;
}

function statusOf(view: PlayerView, player: PlayerId, me: PlayerId): { status: RowStatus; text: string } {
  const aw = view.awaiting;
  const phase = view.phase;
  if (aw.window === 'dice') {
    if (!aw.players.includes(player)) return { status: 'done', text: 'Rolled' };
    return player === me ? { status: 'turn', text: 'Your turn to roll' } : { status: 'waiting', text: 'Rolling…' };
  }
  if (aw.window === 'challenge' && phase.kind === 'settle') {
    const challenge = phase.challenges.find((c) => c.winner === null && c.contesting.includes(player));
    if (!challenge) return { status: 'idle', text: 'Watching the face-off' };
    if (challenge.picked.includes(player)) return { status: 'locked', text: 'Pick locked' };
    return player === me ? { status: 'turn', text: 'Your pick' } : { status: 'waiting', text: 'Picking…' };
  }
  if (aw.window === 'mystery' && phase.kind === 'mysterySelect') {
    if (!(player in phase.picked)) return { status: 'idle', text: 'Waiting for the cards' };
    if (phase.picked[player]) return { status: 'locked', text: 'Card picked' };
    return player === me ? { status: 'turn', text: 'Your card to pick' } : { status: 'waiting', text: 'Choosing a card…' };
  }
  return { status: 'idle', text: 'Waiting' };
}

/** The rows of the player column, front-runner first (spec #2 §7.2). */
export function playerRows({ view, presentation, record, seats, me, watch }: RowsInput): PlayerRow[] {
  const names = new Map(seats.map((s) => [s.playerId, s.playerId === me ? 'You' : s.nickname]));
  const tileOf = (id: PlayerId) => presentation.positions[id] ?? 0;
  const picked = view.phase.kind === 'mysterySelect' ? view.phase.picked : null;
  return seats
    .map((seat, index) => ({ seat, index, tile: tileOf(seat.playerId) }))
    .sort((a, b) => b.tile - a.tile || a.index - b.index)
    .map(({ seat, tile }) => {
      const id = seat.playerId;
      const { status, text } = statusOf(view, id, me);
      const card = record.cards[id] ?? (picked?.[id] ? 'facedown' : null);
      const onMystery = picked !== null && id in picked && !picked[id];
      return {
        seat,
        tile,
        rank: 1 + seats.filter((s) => tileOf(s.playerId) > tile).length,
        me: id === me,
        watched: id === watch,
        status,
        statusText: text,
        dice: record.dice[id] ?? null,
        mystery: onMystery ? (view.board.mystery[tile] ?? null) : null,
        effects: presentation.effects.filter((e) => e.owner === id).map((e) => effectChip(e, names)),
        card,
      };
    });
}

// ---------------------------------------------------------------- bottom dock

export interface QueueCard {
  caster: PlayerId;
  cardId: string;
  result: CardRecord['result'];
  /** The card resolving right now. */
  current: boolean;
}

export type DockModel =
  | { kind: 'roll'; windowId: number }
  | { kind: 'wait'; parts: FeedPart[] }
  | { kind: 'caption'; parts: FeedPart[]; totals: Array<{ player: PlayerId; total: number }> | null }
  | { kind: 'queue'; caption: string; cards: QueueCard[] }
  | { kind: 'none' };

export interface DockInput {
  beat: Beat | null;
  view: PlayerView;
  record: RoundRecord;
  me: PlayerId;
}

const MOVE_VERB: Partial<Record<Beat['kind'], string>> = {
  slide: ' slides down',
  launch: ' launches up',
  knockback: ' is knocked back',
  stepBack: ' steps back',
  snakeBlocked: ' dodges the slide',
  cardMove: ' leaps',
};

/** Cards in the order they resolve: by type, then Epic → Rare → Common; seat order within a group (spec #1 §5.4). */
export function resolutionQueue(record: RoundRecord, beat: Beat | null): QueueCard[] {
  const resolving = beat?.kind === 'cardResolved' ? beat.events.find((e) => e.type === 'CardResolved') : undefined;
  const rank = (cardId: string) => {
    const info = cardInfo(cardId);
    return CARD_TYPES.indexOf(info.type) * RARITY_ORDER.length + RARITY_ORDER.indexOf(info.rarity);
  };
  return Object.entries(record.cards)
    .map(([caster, card]) => ({
      caster,
      cardId: card.cardId,
      result: card.result,
      current: resolving?.type === 'CardResolved' && resolving.caster === caster,
    }))
    .sort((a, b) => rank(a.cardId) - rank(b.cardId));
}

const moversOf = (events: GameEvent[]) => [...new Set(events.flatMap((e) => (e.type === 'Moved' || e.type === 'SnakeBlocked' ? [e.player] : [])))];

/** Bottom centre (spec #2 §7.2): ROLL, a waiting pill, a move caption, or the card queue. */
export function dockModel({ beat, view, record, me }: DockInput): DockModel {
  if (beat) {
    if (beat.kind === 'move') {
      const totals = Object.entries(record.dice).map(([player, d]) => ({ player, total: d.total ?? d.faces.reduce((a, b) => a + b, 0) }));
      return { kind: 'caption', parts: ['Everyone moves'], totals };
    }
    const verb = MOVE_VERB[beat.kind];
    if (verb) return { kind: 'caption', parts: [...listParts(moversOf(beat.events)), verb], totals: null };
    if (beat.kind === 'faceOff' || beat.kind === 'faceOffResult') {
      const started = beat.events.find((e) => e.type === 'ChallengeStarted');
      if (started?.type === 'ChallengeStarted') return { kind: 'caption', parts: [`Face-off on tile ${started.tile}!`], totals: null };
      const resolved = beat.events.find((e) => e.type === 'ChallengeResolved');
      if (resolved?.type === 'ChallengeResolved' && resolved.winner) return { kind: 'caption', parts: [{ player: resolved.winner }, ' wins the face-off'], totals: null };
      return { kind: 'caption', parts: ['A tie! The face-off goes again'], totals: null };
    }
    if (beat.kind === 'cardReveal' || beat.kind === 'cardResolved' || beat.kind === 'clash' || beat.kind === 'boardEdit') {
      const caption = beat.kind === 'cardReveal' ? 'Cards revealed!' : 'Cards resolve: Movement → Defense → Attack → Risky → Misc, Epic first';
      return { kind: 'queue', caption, cards: resolutionQueue(record, beat) };
    }
  }
  const aw = view.awaiting;
  const phase = view.phase;
  if (aw.window === 'dice') {
    if (aw.players.includes(me)) return { kind: 'roll', windowId: aw.windowId };
    return { kind: 'wait', parts: ['Waiting for ', ...listParts(aw.players), ' to roll'] };
  }
  if (aw.window === 'challenge' && phase.kind === 'settle') {
    const open = phase.challenges.filter((c) => c.winner === null);
    if (open.some((c) => c.participants.includes(me))) return { kind: 'none' };
    const tiles = open.map((c) => c.tile).join(' and ');
    return { kind: 'wait', parts: [`Face-off on tile ${tiles}: waiting for `, ...listParts(aw.players)] };
  }
  if (aw.window === 'mystery' && phase.kind === 'mysterySelect') {
    if (view.myOffer && view.myOffer.picked === null) return { kind: 'none' };
    return { kind: 'wait', parts: ['Waiting for ', ...listParts(aw.players), aw.players.length === 1 ? ' to pick a card' : ' to pick their cards'] };
  }
  return { kind: 'none' };
}

// ---------------------------------------------------------------- popups

export interface Fighter {
  player: PlayerId;
  /** Has locked a pick this pick round. */
  locked: boolean;
  /** Revealed pick, once the round resolves. */
  pick: ChallengeChoice | null;
  /** Lost earlier in this face-off (a Minority narrowing down). */
  out: boolean;
}

export interface FaceOffModel {
  challengeId: string;
  tile: number;
  kind: 'rps' | 'minority';
  pickRound: number;
  choices: Array<{ choice: ChallengeChoice; label: string }>;
  fighters: Fighter[];
  myPick: ChallengeChoice | null;
  canPick: boolean;
  /** Set while the reveal plays: who won, or null for a tie. */
  result: { winner: PlayerId | null } | null;
}

const RPS_CHOICES: FaceOffModel['choices'] = [
  { choice: 'rock', label: 'Rock' },
  { choice: 'paper', label: 'Paper' },
  { choice: 'scissors', label: 'Scissors' },
];

function choicesFor(kind: 'rps' | 'minority', theme: [string, string] | null): FaceOffModel['choices'] {
  if (kind === 'rps') return RPS_CHOICES;
  return [
    { choice: 'A', label: theme?.[0] ?? 'A' },
    { choice: 'B', label: theme?.[1] ?? 'B' },
  ];
}

/** The face-off popup, only for its players (spec #2 §7.2, C11); null for everyone else. */
export function faceOffModel({ beat, view, me }: { beat: Beat | null; view: PlayerView; me: PlayerId }): FaceOffModel | null {
  const resolved = beat?.kind === 'faceOffResult' ? beat.events.find((e) => e.type === 'ChallengeResolved') : undefined;
  if (resolved?.type === 'ChallengeResolved' && me in resolved.picks) {
    const challenge = view.phase.kind === 'settle' ? view.phase.challenges.find((c) => c.id === resolved.challengeId) : undefined;
    const kind = challenge?.kind ?? (Object.keys(resolved.picks).length === 2 ? 'rps' : 'minority');
    return {
      challengeId: resolved.challengeId,
      tile: challenge?.tile ?? 0,
      kind,
      pickRound: resolved.pickRound,
      choices: choicesFor(kind, challenge?.theme ?? null),
      fighters: Object.entries(resolved.picks).map(([player, pick]) => ({ player, locked: pick !== null, pick, out: false })),
      myPick: resolved.picks[me] ?? null,
      canPick: false,
      result: { winner: resolved.winner },
    };
  }
  const started = beat?.kind === 'faceOff' ? beat.events.find((e) => e.type === 'ChallengeStarted' && e.players.includes(me)) : undefined;
  if (started?.type === 'ChallengeStarted') {
    return {
      challengeId: started.challengeId,
      tile: started.tile,
      kind: started.kind,
      pickRound: 1,
      choices: choicesFor(started.kind, started.theme),
      fighters: started.players.map((player) => ({ player, locked: false, pick: null, out: false })),
      myPick: null,
      canPick: false,
      result: null,
    };
  }
  if (view.phase.kind !== 'settle') return null;
  const challenge = view.phase.challenges.find((c) => c.winner === null && c.participants.includes(me));
  if (!challenge) return null;
  const myPick = (view.myPicks[challenge.id] as ChallengeChoice | undefined) ?? null;
  return {
    challengeId: challenge.id,
    tile: challenge.tile,
    kind: challenge.kind,
    pickRound: challenge.pickRound,
    choices: choicesFor(challenge.kind, challenge.theme),
    fighters: challenge.participants.map((player) => ({
      player,
      locked: challenge.picked.includes(player),
      pick: null,
      out: !challenge.contesting.includes(player),
    })),
    myPick,
    canPick: view.awaiting.window === 'challenge' && challenge.contesting.includes(me) && myPick === null,
    result: null,
  };
}

export interface CardSlot {
  slot: number;
  info: CardInfo;
  warning: string | null;
  rerolled: boolean;
  canReroll: boolean;
}

export interface CardPickModel {
  rarity: Rarity;
  tile: number;
  slots: CardSlot[];
  rerollsLeft: number;
}

/** The card-pick popup, only for the offer's owner (spec #2 §7.2); null otherwise. */
export function cardPickModel(view: PlayerView, maxRerolls = MAX_REROLLS): CardPickModel | null {
  const offer = view.myOffer;
  if (view.phase.kind !== 'mysterySelect' || !offer || offer.picked !== null) return null;
  const rerollsLeft = Math.max(0, maxRerolls - offer.rerollsUsed);
  return {
    rarity: offer.rarity,
    tile: offer.tile,
    rerollsLeft,
    slots: offer.cards.map((id, slot) => ({
      slot,
      info: cardInfo(id),
      warning: fizzleWarning(id, view),
      rerolled: offer.rerolled[slot] ?? false,
      canReroll: rerollsLeft > 0 && !(offer.rerolled[slot] ?? false),
    })),
  };
}

// ---------------------------------------------------------------- banners

export interface BannerModel {
  text: string;
  /** good = gold, bad = coral, info = white, cool = cyan. */
  tone: 'good' | 'bad' | 'info' | 'cool';
}

/**
 * The big word over the board for a beat (spec #2 §5.1): my own face-offs, cards that touch
 * me, the card reveal, clashes, my dodged slides and the match winner. Null for everything else.
 */
export function bannerFor(beat: Beat, me: PlayerId, seats: readonly SeatInfo[]): BannerModel | null {
  const name = (id: PlayerId) => (seats.find((s) => s.playerId === id)?.nickname ?? id).toUpperCase();
  for (const e of beat.events) {
    switch (e.type) {
      case 'ChallengeStarted':
        if (e.players.includes(me)) return { text: 'FACE-OFF!', tone: 'bad' };
        break;
      case 'ChallengeResolved':
        if (!(me in e.picks)) break;
        if (e.winner === me) return { text: 'YOU WIN!', tone: 'good' };
        if (e.losers.includes(me)) return { text: 'YOU LOSE', tone: 'bad' };
        return { text: 'DRAW!', tone: 'info' };
      case 'CardResolved':
        if (e.caster !== me && e.target !== me) break;
        if (e.result === 'blocked') return { text: 'BLOCKED!', tone: 'cool' };
        if (e.result === 'fizzled') return { text: 'FIZZLED', tone: 'info' };
        if (e.target === me && e.caster !== me) return { text: 'HIT!', tone: 'bad' };
        break;
      case 'Clash':
        if (e.players.includes(me) || e.casters.includes(me)) return { text: 'CLASH!', tone: 'bad' };
        break;
      case 'SnakeBlocked':
        if (e.player === me) return { text: 'DODGED!', tone: 'cool' };
        break;
      case 'MatchWon':
        return e.winner === me ? { text: 'VICTORY!', tone: 'good' } : { text: `${name(e.winner)} WINS!`, tone: 'info' };
    }
  }
  return beat.kind === 'cardReveal' ? { text: 'CARDS REVEALED', tone: 'info' } : null;
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/model.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  47 passed (47)` and `Tests  339 passed (339)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): model what the match HUD shows

Pure functions for the stage bar and countdown, the player rows, the
bottom dock (ROLL, waiting pill, move caption, card queue), the
face-off and card-pick popups (only for the players involved) and the
banners (spec #2 §5.1, §7.2, C11).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Shared UI pieces

**Files:**
- Create: `apps/client/src/ui/Icon.tsx`, `PieceIcon.tsx`, `DieFace.tsx`, `Dialog.tsx`, `toasts.tsx`, `useMediaQuery.ts`, `RotateScreen.tsx`, `ui.css`, and `apps/client/test/ui.test.tsx`

**Interfaces:**
- Consumes: `IconName` (Task 4).
- Produces:
  - `Icon({ name, className })`, `PieceIcon({ piece })`, `Portrait({ piece, color, className?, badge? })` and `DieFace({ face, forced?, className? })`;
  - `Dialog({ title, onClose, children, className? })`;
  - `showToast(text)`, `ToastHost` and `TOAST_MS`;
  - `useMediaQuery(query)` and `RotateScreen`.

- [ ] **Step 1: Write the failing test**

Create `apps/client/test/ui.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from '../src/ui/Dialog';
import { DieFace } from '../src/ui/DieFace';
import { PieceIcon, Portrait } from '../src/ui/PieceIcon';
import { RotateScreen } from '../src/ui/RotateScreen';
import { TOAST_MS, ToastHost, showToast } from '../src/ui/toasts';
import { PIECES } from '../src/service/matchService';

/** jsdom has no matchMedia: answer every query with `matches`. */
function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Dialog', () => {
  it('has a titled, modal panel that closes on its button, the backdrop and Esc (spec #2 §7.3)', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Settings" onClose={onClose}>
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('.backdrop')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('toasts (spec #2 §8)', () => {
  it('shows a message, then hides it after a few seconds', () => {
    vi.useFakeTimers();
    render(<ToastHost />);
    act(() => showToast('Too late, that window closed'));
    expect(screen.getByRole('status').textContent).toBe('Too late, that window closed');
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('RotateScreen (spec #2 §7.1)', () => {
  it('asks to turn the phone sideways only in portrait', () => {
    mockMatchMedia(true);
    const { unmount } = render(<RotateScreen />);
    expect(screen.getByRole('alert').textContent).toContain('Turn your phone sideways');
    unmount();
    mockMatchMedia(false);
    render(<RotateScreen />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('piece portraits and dice', () => {
  it('draws each piece, and the pawn with a round head', () => {
    for (const piece of PIECES) {
      const { container, unmount } = render(<PieceIcon piece={piece} />);
      expect(container.querySelector('path')?.getAttribute('d')).toMatch(/^M[\d.,QLZ -]+Z$/);
      expect(container.querySelector('circle:not(.piece-eye)') !== null).toBe(piece === 'pawn');
      unmount();
    }
  });

  it('sets the seat colour and the rank badge on a portrait', () => {
    const { container } = render(<Portrait piece="dragon" color="var(--accent)" badge={2} />);
    const portrait = container.querySelector<HTMLElement>('.portrait')!;
    expect(portrait.style.getPropertyValue('--seat')).toBe('var(--accent)');
    expect(portrait.textContent).toBe('2');
  });

  it('draws the pips of a face', () => {
    const { container } = render(<DieFace face={6} forced />);
    expect(container.querySelectorAll('circle')).toHaveLength(6);
    expect(screen.getByRole('img', { name: '6' }).getAttribute('class')).toContain('forced');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run apps/client/test/ui.test.tsx`
Expected: FAIL with `Failed to resolve import "../src/ui/Dialog"`.

- [ ] **Step 3: Build the pieces**

Create `apps/client/src/ui/Icon.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { IconName } from '../hud/labels';

// The HUD's icon set: 24×24, drawn in currentColor so CSS tokens colour them (spec #2 §7.4).

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const PATHS: Record<IconName, ReactNode> = {
  arrow: <path d="M3 9.5h10V4.5l8 7.5-8 7.5v-5H3z" />,
  die: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" {...stroke} />
      <circle cx="8.5" cy="8.5" r="1.7" />
      <circle cx="15.5" cy="8.5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="8.5" cy="15.5" r="1.7" />
      <circle cx="15.5" cy="15.5" r="1.7" />
    </>
  ),
  x2: (
    <>
      <path d="M3.5 7.5l2-2L9 9l3.5-3.5 2 2L11 11l3.5 3.5-2 2L9 13l-3.5 3.5-2-2L7 11z" />
      <path d="M15 13.2c.3-1.8 1.6-2.7 3-2.7 1.6 0 2.8 1 2.8 2.5 0 1.3-.8 2-2.2 3.1l-1 .8H21V19h-6.2v-1.7l2.6-2.2c1-.8 1.4-1.3 1.4-1.9 0-.5-.4-.9-1-.9-.7 0-1.1.5-1.2 1.2z" />
    </>
  ),
  pad: (
    <>
      <path d="M2.5 19h19v2.5h-19z" />
      <path d="M5 16.5C6.5 6 16.5 5.5 19 14" {...stroke} strokeDasharray="2.6 2.4" />
      <path d="M19.8 10.5l1.6 5.6-5.4-1.6z" />
    </>
  ),
  charm: (
    <>
      <path d="M7 19c0-4 10-3 10-7S7 9 7 5" {...stroke} />
      <path d="M4 4l16 16" {...stroke} />
    </>
  ),
  shield: <path d="M12 2.5l7.5 2.8v5.9c0 4.8-3.2 8.8-7.5 10.3-4.3-1.5-7.5-5.5-7.5-10.3V5.3z" />,
  aegis: (
    <>
      <path d="M12 2.5l7.5 2.8v5.9c0 4.8-3.2 8.8-7.5 10.3-4.3-1.5-7.5-5.5-7.5-10.3V5.3z" />
      <path className="icon-cut" d="M12 7.2l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" />
    </>
  ),
  push: <path d="M21 9.5H11V4.5L3 12l8 7.5v-5h10z" />,
  boot: <path d="M7 3h6.5v8.2l5.6 2.6c1.2.6 1.9 1.7 1.9 3V20H3.5v-3.6c0-1 .5-1.9 1.4-2.4L7 12.8z" />,
  swap: <path d="M4 7.5h11.5V4L21 8.8l-5.5 4.7V10H4zM20 16.5H8.5V20L3 15.2l5.5-4.7V14H20z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="8.5" {...stroke} />
      <path d="M12 7v10M9.3 9.6c.5-1 1.5-1.4 2.7-1.4 1.6 0 2.6.8 2.6 1.9s-1 1.6-2.6 1.9-2.6.8-2.6 1.9 1 1.9 2.6 1.9c1.2 0 2.2-.5 2.7-1.4" {...stroke} strokeWidth={2} />
    </>
  ),
  bait: <path d="M15 3v9.5a5 5 0 0 1-10 0V10l3 2.5M15 3l3 3" {...stroke} />,
  jackpot: (
    <>
      <rect x="2.5" y="7" width="11" height="11" rx="3" transform="rotate(-14 8 12.5)" />
      <rect x="10.5" y="5" width="11" height="11" rx="3" fillOpacity=".5" />
    </>
  ),
  steady: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" {...stroke} />
      <path d="M8 10h8M8 14h8" {...stroke} />
    </>
  ),
  cleanse: <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />,
  slide: <path d="M12 4a8 8 0 1 0 8 8 5.5 5.5 0 0 0-5.5-5.5A3.5 3.5 0 0 0 11 10a2 2 0 0 0 2 2" {...stroke} />,
  card: (
    <>
      <rect x="3.5" y="4" width="11.5" height="15.5" rx="2.5" transform="rotate(-10 9 12)" fillOpacity=".45" />
      <rect x="8.5" y="4" width="11.5" height="15.5" rx="2.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...stroke} />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} strokeWidth={3.4} />,
  bolt: <path d="M13.5 2L5 13.5h5.5L9.5 22 19 9.5h-5.6z" />,
  eye: (
    <>
      <path d="M12 5.5c5 0 8.6 4 9.7 6.5-1.1 2.5-4.7 6.5-9.7 6.5S3.4 14.5 2.3 12C3.4 9.5 7 5.5 12 5.5z" />
      <circle className="icon-cut" cx="12" cy="12" r="3.2" />
    </>
  ),
  reroll: (
    <>
      <path d="M19 12.5a7 7 0 1 1-2.2-5.6" {...stroke} strokeWidth={2.8} />
      <path d="M21 3.5v6.5h-6.5z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="7.5" {...stroke} strokeWidth={2.4} />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" {...stroke} strokeWidth={2.4} />
    </>
  ),
  qmark: <path d="M8.5 8.5a3.5 3.5 0 1 1 5.2 3c-1.2.7-1.7 1.4-1.7 2.7v.8M12 19.5v.5" {...stroke} strokeWidth={3} />,
  swords: (
    <>
      <path d="M4 3h2.2l10.3 10.3-2.2 2.2L4 5.2zM20 3h-2.2L7.5 13.3l2.2 2.2L20 5.2z" />
      <path d="M5 14.5l4.5 4.5M19 14.5L14.5 19M4.5 20.5l2-2M19.5 20.5l-2-2" {...stroke} />
    </>
  ),
  gear: (
    <path d="M10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.7c.1.6.1 1.3 0 1.9l2 1.7-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.7c-.1-.6-.1-1.3 0-1.9l-2-1.7 1.7-2.9 2.5.9c.5-.4 1.1-.7 1.7-.9zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" transform="translate(0 1.5) scale(1 .92)" />
  ),
  close: <path d="M6 6l12 12M18 6L6 18" {...stroke} strokeWidth={3.5} />,
  play: <path d="M7 4.5v15l12.5-7.5z" />,
  back: <path d="M15 4l-8 8 8 8" {...stroke} strokeWidth={3.5} />,
  next: <path d="M9 4l8 8-8 8" {...stroke} strokeWidth={3.5} />,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" {...stroke} strokeWidth={3} />,
  pencil: <path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5zM13.5 7l3 3" {...stroke} strokeWidth={2.2} />,
  rock: (
    <>
      <path d="M5.5 10.5C5.5 7 8.3 4.8 12 4.8s6.8 2.1 6.8 5.4c0 1.1-.2 2.1-.6 3 .5.8.7 1.6.7 2.5 0 2.8-2.6 4.3-6.6 4.3-4.3 0-7.3-1.7-7.3-5.1 0-1 .3-1.9.9-2.6-.3-.6-.4-1.2-.4-1.8z" />
      <path className="icon-cut-line" d="M9 9.6c1 .6 2.2.7 3.2.2M13.6 13.2c.9.4 1.9.4 2.8 0" strokeWidth={1.4} strokeLinecap="round" />
    </>
  ),
  paper: (
    <>
      <path d="M6 2.5h8.8L19.5 7v14.5H6z" />
      <path className="icon-cut" d="M14.8 2.5V7h4.7z" fillOpacity=".6" />
      <path className="icon-cut-line" d="M9 11h7.5M9 14.2h7.5M9 17.4h5" strokeWidth={1.5} strokeLinecap="round" />
    </>
  ),
  scissors: (
    <>
      <circle cx="7" cy="17.3" r="3.2" {...stroke} strokeWidth={2.4} />
      <circle cx="17" cy="17.3" r="3.2" {...stroke} strokeWidth={2.4} />
      <path d="M8.7 14.7L16.4 3l1.7 1.1-7.3 11.2zM15.3 14.7L7.6 3 5.9 4.1l7.3 11.2z" />
    </>
  ),
  trophy: <path d="M7 3h10v3h3v2a4 4 0 0 1-4 4h-.4A4.5 4.5 0 0 1 13 14.4V17h3v3H8v-3h3v-2.6A4.5 4.5 0 0 1 8.4 12H8a4 4 0 0 1-4-4V6h3zM6 8a2 2 0 0 0 1 1.7V8zm12 0h-1v1.7A2 2 0 0 0 18 8z" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : 'icon'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
```

Create `apps/client/src/ui/PieceIcon.tsx`:

```tsx
import type { CSSProperties } from 'react';
import type { PieceId } from '../service/matchService';

// 2D portraits of the four pieces for the HUD (spec #2 §7.2): white silhouettes with an ink
// outline, drawn on a disc in the seat colour. The outlines follow the in-match mockup.

type Command = ['M' | 'L', number, number] | ['Q', number, number, number, number];

const SHAPES: Record<Exclude<PieceId, 'pawn'>, { eye?: [number, number]; cmds: Command[] }> = {
  knight: {
    eye: [0.22, 0.7],
    cmds: [['M', -0.26, 0], ['L', 0.22, 0], ['Q', 0.24, 0.18, 0.16, 0.3], ['Q', 0.26, 0.38, 0.4, 0.42], ['Q', 0.5, 0.46, 0.46, 0.56], ['Q', 0.42, 0.64, 0.3, 0.66], ['Q', 0.2, 0.72, 0.14, 0.8], ['L', 0.06, 0.98], ['L', -0.02, 0.84], ['Q', -0.2, 0.82, -0.28, 0.6], ['Q', -0.34, 0.36, -0.26, 0]],
  },
  dragon: {
    eye: [0.2, 0.75],
    cmds: [['M', -0.2, 0], ['L', 0.16, 0], ['Q', 0.1, 0.22, 0.2, 0.36], ['L', 0.42, 0.42], ['L', 0.55, 0.47], ['L', 0.4, 0.52], ['L', 0.56, 0.58], ['Q', 0.6, 0.66, 0.48, 0.68], ['Q', 0.34, 0.7, 0.22, 0.8], ['Q', 0.12, 0.9, 0, 0.88], ['Q', -0.12, 0.86, -0.16, 0.76], ['L', -0.31, 0.74], ['L', -0.22, 0.63], ['L', -0.35, 0.56], ['L', -0.25, 0.45], ['L', -0.34, 0.36], ['L', -0.23, 0.27], ['Q', -0.28, 0.12, -0.2, 0]],
  },
  meeple: {
    cmds: [['M', -0.36, 0], ['L', -0.1, 0], ['Q', 0, 0.24, 0.1, 0], ['L', 0.36, 0], ['Q', 0.3, 0.2, 0.2, 0.34], ['Q', 0.42, 0.38, 0.4, 0.5], ['Q', 0.36, 0.6, 0.16, 0.6], ['Q', 0.24, 0.74, 0.16, 0.84], ['Q', 0, 0.96, -0.16, 0.84], ['Q', -0.24, 0.74, -0.16, 0.6], ['Q', -0.36, 0.6, -0.4, 0.5], ['Q', -0.42, 0.38, -0.2, 0.34], ['Q', -0.3, 0.2, -0.36, 0]],
  },
};
const PAWN_SIDE: Array<[number, number]> = [[0.36, 0], [0.37, 0.04], [0.35, 0.1], [0.27, 0.13], [0.25, 0.18], [0.18, 0.22], [0.14, 0.34], [0.115, 0.5], [0.11, 0.56], [0.2, 0.6], [0.21, 0.63], [0.12, 0.67]];

interface Drawn {
  d: string;
  eye: [number, number] | null;
  head: { cx: number; cy: number; r: number } | null;
}

/** Fit a shape into a 40×40 box: path, eye and (pawn) head in SVG coordinates. */
function draw(piece: PieceId): Drawn {
  const cmds: Command[] =
    piece === 'pawn'
      ? [['M', 0, 0], ...PAWN_SIDE.map(([x, y]): Command => ['L', x, y]), ['L', 0, 0.67], ...[...PAWN_SIDE].reverse().map(([x, y]): Command => ['L', -x, y])]
      : SHAPES[piece].cmds;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of cmds) {
    for (let i = 1; i < c.length; i += 2) {
      xs.push(c[i] as number);
      ys.push(c[i + 1] as number);
    }
  }
  if (piece === 'pawn') {
    xs.push(-0.19, 0.19);
    ys.push(1.01);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const k = 29 / Math.max(maxX - minX, Math.max(...ys) - minY);
  const cx = (minX + maxX) / 2;
  const X = (x: number) => +(20 + (x - cx) * k).toFixed(1);
  const Y = (y: number) => +(35 - (y - minY) * k).toFixed(1);
  const d = `${cmds.map((c) => (c[0] === 'Q' ? `Q${X(c[1])},${Y(c[2])} ${X(c[3])},${Y(c[4])}` : `${c[0]}${X(c[1])},${Y(c[2])}`)).join('')}Z`;
  const eye = piece === 'pawn' ? null : SHAPES[piece].eye ?? null;
  return {
    d,
    eye: eye ? [X(eye[0]), Y(eye[1])] : null,
    head: piece === 'pawn' ? { cx: X(0), cy: Y(0.82), r: +(0.19 * k).toFixed(1) } : null,
  };
}

const DRAWN: Record<PieceId, Drawn> = { knight: draw('knight'), pawn: draw('pawn'), meeple: draw('meeple'), dragon: draw('dragon') };

/** A piece silhouette. The fill and outline come from CSS (.piece-icon). */
export function PieceIcon({ piece }: { piece: PieceId }) {
  const { d, eye, head } = DRAWN[piece];
  return (
    <svg className="piece-icon" viewBox="0 0 40 40" aria-hidden="true">
      <path d={d} />
      {head && <circle cx={head.cx} cy={head.cy} r={head.r} />}
      {eye && <circle className="piece-eye" cx={eye[0]} cy={eye[1]} r={1.8} />}
    </svg>
  );
}

/** A round portrait: the piece on a disc in the seat colour, with an optional badge. */
export function Portrait({ piece, color, className, badge }: { piece: PieceId; color: string; className?: string; badge?: string | number }) {
  return (
    <span className={className ? `portrait ${className}` : 'portrait'} style={{ '--seat': color } as CSSProperties}>
      <PieceIcon piece={piece} />
      {badge !== undefined && <span className="portrait-badge display">{badge}</span>}
    </span>
  );
}
```

Create `apps/client/src/ui/DieFace.tsx`:

```tsx
// A die face for the HUD: pips in currentColor on a paper face (styled by .die-face).

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[29, 29], [50, 50], [71, 71]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[29, 29], [71, 29], [50, 50], [29, 71], [71, 71]],
  6: [[30, 27], [70, 27], [30, 50], [70, 50], [30, 73], [70, 73]],
};

/** `face` 0 draws a blank die (rolling). `forced` faces were set by a card and flash (spec #2 §5.1). */
export function DieFace({ face, forced = false, className }: { face: number; forced?: boolean; className?: string }) {
  const classes = ['die-face', forced ? 'forced' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg className={classes} viewBox="0 0 100 100" role="img" aria-label={face > 0 ? `${face}` : 'rolling'}>
      <rect x="6" y="6" width="88" height="88" rx="22" />
      {(PIPS[face] ?? []).map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="9.5" />
      ))}
    </svg>
  );
}
```

Create `apps/client/src/ui/Dialog.tsx`:

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A modal dialog over a dimmed backdrop (spec #2 §7.1): title bar in the panel header colour,
 * a close button, Esc to close (§7.3). Focus moves into it when it opens.
 */
export function Dialog({ title, onClose, children, className }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-layer live">
      <div className="backdrop" onClick={onClose} />
      <div ref={panelRef} className={className ? `dialog panel ${className}` : 'dialog panel'} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="dialog-head">
          <h2 id={titleId} className="display">
            {title}
          </h2>
          <button type="button" className="round-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
```

Create `apps/client/src/ui/toasts.tsx`:

```tsx
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

// Short messages over the board, e.g. "Too late, that window closed" (spec #2 §8).

export const TOAST_MS = 3800;

interface ToastState {
  toast: { id: number; text: string } | null;
}

export const toasts = createStore<ToastState>()(() => ({ toast: null }));
let nextId = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Show a toast; it replaces the one showing and hides itself after TOAST_MS. */
export function showToast(text: string): void {
  if (timer !== null) clearTimeout(timer);
  const id = ++nextId;
  toasts.setState({ toast: { id, text } });
  timer = setTimeout(() => {
    timer = null;
    if (toasts.getState().toast?.id === id) toasts.setState({ toast: null });
  }, TOAST_MS);
}

export function ToastHost() {
  const toast = useStore(toasts, (s) => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.id} className="toast" role="status">
      {toast.text}
    </div>
  );
}
```

Create `apps/client/src/ui/useMediaQuery.ts`:

```ts
import { useSyncExternalStore } from 'react';

/** Whether a CSS media query matches, kept up to date. False where matchMedia is missing. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof matchMedia !== 'function') return () => {};
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
  );
}
```

Create `apps/client/src/ui/RotateScreen.tsx`:

```tsx
import { useMediaQuery } from './useMediaQuery';

/** Laddorious plays in landscape: an upright screen gets this instead (spec #2 §7.1, §7.3). */
export function RotateScreen() {
  const portrait = useMediaQuery('(orientation: portrait)');
  if (!portrait) return null;
  return (
    <div className="rotate-screen" role="alert">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="20" y="6" width="24" height="52" rx="6" />
        <path d="M28 50h8" />
      </svg>
      <b className="display">Turn your phone sideways</b>
      <span>Laddorious plays in landscape.</span>
    </div>
  );
}
```

Create `apps/client/src/ui/ui.css`:

```css
/* Shared UI pieces (spec #2 §7). Colours come from theme.css tokens. */
.icon {
  width: 1em;
  height: 1em;
  flex: none;
}

.icon .icon-cut {
  fill: var(--paper);
}

.icon .icon-cut-line {
  fill: none;
  stroke: var(--paper);
}

.piece-icon {
  width: 72%;
  height: 72%;
}

.piece-icon path,
.piece-icon circle {
  fill: var(--white);
  stroke: var(--ink);
  stroke-width: 2;
  stroke-linejoin: round;
}

.piece-icon .piece-eye {
  fill: var(--ink);
  stroke: none;
}

.portrait {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: max(40px, 8.5cqh);
  height: max(40px, 8.5cqh);
  border: 3px solid var(--ink);
  border-radius: 50%;
  background: var(--seat);
  box-shadow: 0 0 0 2.5px var(--white);
}

.portrait-badge {
  position: absolute;
  left: -7px;
  top: -7px;
  display: grid;
  place-items: center;
  min-width: 21px;
  height: 21px;
  padding: 0 4px;
  border: 2px solid var(--ink);
  border-radius: 999px;
  background: var(--paper);
  color: var(--ink);
  font-size: 12px;
  line-height: 1;
}

.die-face {
  width: 1.3em;
  height: 1.3em;
  flex: none;
}

.die-face rect {
  fill: var(--paper);
  stroke: var(--ink);
  stroke-width: 8;
}

.die-face circle {
  fill: var(--ink);
}

.die-face.forced rect {
  stroke: var(--accent);
  animation: flash 0.6s ease-in-out infinite alternate;
}

@keyframes flash {
  to {
    fill: var(--highlight);
  }
}

/* Dialogs (settings, leave match): a real panel, unlike the in-match popups (§7.1). */
.dialog-layer {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
}

.dialog {
  position: relative;
  width: min(92cqw, max(320px, 86cqh));
  overflow: hidden;
  animation: rise 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

.dialog:focus {
  outline: none;
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: max(8px, 1.8cqh) max(14px, 2.6cqh);
  border-bottom: 3px solid var(--ink);
  background: var(--panel-header);
  color: var(--white);
}

.dialog-head h2 {
  margin: 0;
  font-size: max(18px, 4cqh);
  line-height: 1;
  text-shadow: 0 2px 0 var(--ink);
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: max(12px, 2.6cqh);
  padding: max(12px, 2.6cqh) max(14px, 2.8cqh) max(14px, 3cqh);
}

/* A round icon button: close, settings gear, arrows (at least 44 px, §7.3). */
.round-btn {
  display: grid;
  place-items: center;
  width: max(44px, 8cqh);
  height: max(44px, 8cqh);
  padding: 0;
  border: 3px solid var(--ink);
  border-radius: 50%;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 max(3px, 0.7cqh) 0 var(--ink);
  font-size: max(20px, 4cqh);
  cursor: pointer;
}

.round-btn:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--ink);
}

.toast {
  position: absolute;
  left: 50%;
  top: calc(var(--safe-t) + max(64px, 17cqh));
  z-index: 50;
  max-width: min(540px, 80cqw);
  padding: 9px 15px;
  border-radius: 12px;
  background: var(--ink);
  color: var(--white);
  font: 500 max(13px, 2.3cqh) / 1.35 var(--body);
  text-align: center;
  transform: translateX(-50%);
  animation: rise 0.25s ease-out;
  pointer-events: none;
}

.rotate-screen {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 40px;
  background: linear-gradient(var(--sky-top), var(--ink));
  color: var(--white);
  text-align: center;
}

.rotate-screen svg {
  width: 96px;
  height: 96px;
  fill: none;
  stroke: var(--white);
  stroke-width: 4;
  stroke-linejoin: round;
  stroke-linecap: round;
  animation: turn 2.4s ease-in-out infinite;
}

.rotate-screen b {
  font-size: 30px;
  line-height: 1.1;
}

.rotate-screen span {
  max-width: 260px;
  color: var(--muted-on-plate);
  font: 500 16px / 1.4 var(--body);
}

@keyframes turn {
  0%,
  20% {
    transform: rotate(0);
  }

  55%,
  80% {
    transform: rotate(-90deg);
  }

  100% {
    transform: rotate(0);
  }
}
```

- [ ] **Step 4: Run the test again**

Run: `pnpm vitest run apps/client/test/ui.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  48 passed (48)` and `Tests  345 passed (345)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add the shared UI pieces

Icons drawn in currentColor, piece portraits, die faces, a modal dialog
with Esc, toasts, a media-query hook and the rotate screen for upright
phones (spec #2 §7.1, §7.3, §8).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: HUD panels: stage bar, feed, player column, your piece

**Files:**
- Create:
  - in `apps/client/src/hud/`: `Parts.tsx`, `StageBar.tsx`, `EventFeed.tsx`, `Chips.tsx`, `PlayerColumn.tsx`, `YourPiece.tsx`, `hud.css`;
  - `apps/client/test/hud.test.tsx`.

**Interfaces:**
- Consumes: Tasks 4–7.
- Produces:
  - `Parts({ parts, seats })`;
  - `StageBar({ round, stage, timer })` and `TIMER_LOW_S`;
  - `EventFeed({ lines, seats })`;
  - `EffectChipView`, `MysteryChip`, `CardChip`, `DiceChips`, `RARITY_NAMES` and `RESULT_NAMES`;
  - `PlayerColumn({ rows, onWatch, reducedMotion })` and `LONG_PRESS_MS`;
  - `YourPiece({ row, mods, players, boardSize })` and `SHORT_SCREEN`.

- [ ] **Step 1: Write the failing tests**

Create `apps/client/test/hud.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { ActiveEffect, PlayerView } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presentationFromView } from '../src/director/presentation';
import { EventFeed } from '../src/hud/EventFeed';
import type { FeedLine } from '../src/hud/feed';
import { nextRollMods } from '../src/hud/labels';
import { playerRows, type PlayerRow } from '../src/hud/model';
import { LONG_PRESS_MS, PlayerColumn } from '../src/hud/PlayerColumn';
import type { RoundRecord } from '../src/hud/record';
import { StageBar } from '../src/hud/StageBar';
import { YourPiece } from '../src/hud/YourPiece';
import { SEATS, openingUpdate } from './support/fixtures';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** jsdom has no matchMedia: answer every query with `matches`. */
function mockMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })),
  );
}

function view(positions: Record<string, number>, change: Partial<PlayerView> = {}): PlayerView {
  const base = openingUpdate().view;
  return { ...base, players: base.players.map((p) => ({ ...p, position: positions[p.id] ?? p.position })), ...change };
}

const effect = (over: Partial<ActiveEffect>): ActiveEffect => ({
  id: 'e1',
  owner: 'p0',
  sourceCard: 'shield',
  sourcePlayer: 'p0',
  params: { hook: 'beforeAttack' },
  lifetime: { rounds: 3, charges: 1 },
  createdRound: 1,
  seq: 1,
  ...over,
});

/**
 * A Mystery window in round 3: You (p0) still pick on a Rare "?" square at tile 5; Mochi (p1)
 * has picked, face down, and wears a Shield; Pip (p2) rolled 5 but moves 2; Juno's (p3)
 * Sprint resolved as a hit.
 */
function mysteryRows(watch: string | null = null): PlayerRow[] {
  const base = view({ p0: 5, p1: 9, p2: 12, p3: 2 });
  const v: PlayerView = {
    ...base,
    board: { ...base.board, mystery: { ...base.board.mystery, 5: 'rare' } },
    effects: [effect({ owner: 'p1', sourcePlayer: 'p1' })],
    phase: { kind: 'mysterySelect', picked: { p0: false, p1: true } },
    awaiting: { windowId: 9, window: 'mystery', players: ['p0'], durationMs: 15_000 },
  };
  const record: RoundRecord = { round: 3, dice: { p2: { faces: [5], forced: [false], total: 2 } }, cards: { p3: { cardId: 'sprint', result: 'hit' } } };
  return playerRows({ view: v, presentation: presentationFromView(v), record, seats: SEATS, me: 'p0', watch });
}

const rowOf = (name: RegExp) => screen.getByRole('button', { name });

describe('StageBar (spec #2 §7.2)', () => {
  it('names only the current stage, marks the past ones done, and turns the timer coral at 3 s', () => {
    const { container, rerender } = render(<StageBar round={7} stage={2} timer={{ seconds: 3, fraction: 0.375 }} />);
    expect(container.querySelector('.stage-round')!.textContent).toBe('ROUND 7');
    const steps = within(screen.getByRole('list', { name: 'Stages of the round' })).getAllByRole('listitem');
    expect(steps.map((s) => s.className)).toEqual(['done', 'done', 'now', 'next', 'next']);
    expect(steps[2]!.getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('timer', { name: '3 seconds left' }).querySelector('.stage-tbar')!.className).toContain('low');
    rerender(<StageBar round={7} stage={0} timer={null} />);
    expect(screen.queryByRole('timer')).toBeNull();
  });
});

describe('EventFeed (spec #2 §7.2)', () => {
  it('lists the lines newest first, dashes private ones and draws names in their seat colour', () => {
    const lines: FeedLine[] = [
      { seq: 9, parts: ['You picked ', 'Rock'], private: true },
      { seq: 8, parts: [{ player: 'p1' }, ' rolled 4'], private: false },
    ];
    render(<EventFeed lines={lines} seats={SEATS} />);
    const items = within(screen.getByRole('list', { name: 'What just happened' })).getAllByRole('listitem');
    expect(items.map((li) => [li.textContent, li.className])).toEqual([
      ['You picked Rock', 'feed-line private'],
      ['Mochi rolled 4', 'feed-line'],
    ]);
    expect(items[1]!.querySelector<HTMLElement>('.who')!.style.getPropertyValue('--seat')).toBe(SEATS[1]!.color);
  });
});

describe('PlayerColumn (spec #2 §7.2, §9.2)', () => {
  it('lists the players front-runner first, with rank badges and my row marked', () => {
    render(<PlayerColumn rows={mysteryRows()} onWatch={() => {}} reducedMotion={false} />);
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')!.split(',')[0]);
    expect(names).toEqual(['Pip', 'Mochi', 'You (you)', 'Juno']);
    expect(['Pip', 'Mochi', 'You', 'Juno'].map((n) => rowOf(new RegExp(`^${n}`)).querySelector('.portrait-badge')!.textContent)).toEqual(['1', '2', '3', '4']);
    expect(rowOf(/^You/).className).toContain('me');
  });

  it("shows this round's dice, the \"?\" chip, effect chips and the face-down and revealed card chips", () => {
    render(<PlayerColumn rows={mysteryRows()} onWatch={() => {}} reducedMotion={false} />);
    const pip = within(rowOf(/^Pip/));
    expect(pip.getByRole('img', { name: '5' })).toBeTruthy();
    expect(rowOf(/^Pip/).querySelector('.prow-total')!.textContent).toBe('=2');
    expect(within(rowOf(/^You/)).getByRole('img', { name: 'On a Rare ? square' })).toBeTruthy();
    const mochi = within(rowOf(/^Mochi/));
    expect(mochi.getByRole('img', { name: 'Shield' })).toBeTruthy();
    expect(mochi.getByRole('img', { name: 'Card picked, face down' })).toBeTruthy();
    expect(within(rowOf(/^Juno/)).getByRole('img', { name: 'Sprint: Hit' })).toBeTruthy();
    expect(rowOf(/^Juno/).querySelector('.chip-card i')!.className).toBe('hit');
  });

  it('says what each player is doing', () => {
    render(<PlayerColumn rows={mysteryRows()} onWatch={() => {}} reducedMotion={false} />);
    expect(rowOf(/^You/).getAttribute('aria-label')).toBe('You (you), tile 5, rank 3. Your card to pick');
    expect(rowOf(/^Mochi/).querySelector('.prow-status')!.className).toBe('prow-status locked');
  });

  it('watches a piece on tap, and goes back to mine from the watched row or my own', () => {
    const onWatch = vi.fn();
    const { rerender } = render(<PlayerColumn rows={mysteryRows()} onWatch={onWatch} reducedMotion={false} />);
    fireEvent.click(rowOf(/^Mochi/));
    expect(onWatch).toHaveBeenLastCalledWith('p1');
    rerender(<PlayerColumn rows={mysteryRows('p1')} onWatch={onWatch} reducedMotion={false} />);
    expect(rowOf(/^Mochi/).className).toContain('watched');
    fireEvent.click(rowOf(/^Mochi/));
    expect(onWatch).toHaveBeenLastCalledWith(null);
    fireEvent.click(rowOf(/^You/));
    expect(onWatch).toHaveBeenLastCalledWith(null);
  });

  it('opens the details card on a long press without watching, and closes it on the next tap', () => {
    vi.useFakeTimers();
    const onWatch = vi.fn();
    render(<PlayerColumn rows={mysteryRows()} onWatch={onWatch} reducedMotion={false} />);
    const pip = rowOf(/^Pip/);
    fireEvent.pointerDown(pip, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1));
    expect(screen.queryByRole('note')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    const card = screen.getByRole('note', { name: 'Pip' });
    expect(card.textContent).toContain('Meeple · tile 12 · rank 1 of 4');
    expect(card.textContent).toContain('Moves 2');
    fireEvent.pointerUp(pip, { pointerType: 'touch' });
    fireEvent.click(pip);
    expect(screen.getByRole('note', { name: 'Pip' })).toBeTruthy();
    fireEvent.click(pip);
    expect(screen.queryByRole('note')).toBeNull();
    expect(onWatch).not.toHaveBeenCalled();
  });

  it('opens the details card while a mouse hovers a row', () => {
    render(<PlayerColumn rows={mysteryRows()} onWatch={() => {}} reducedMotion={false} />);
    fireEvent.pointerEnter(rowOf(/^Mochi/), { pointerType: 'mouse' });
    const card = screen.getByRole('note', { name: 'Mochi' });
    expect(card.textContent).toContain('Shield');
    expect(card.textContent).toContain('Picked a card. It stays hidden until everyone has picked.');
    fireEvent.pointerLeave(rowOf(/^Mochi/), { pointerType: 'mouse' });
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.pointerEnter(rowOf(/^Mochi/), { pointerType: 'touch' });
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('YourPiece (spec #2 §7.2)', () => {
  const effects = [
    effect({ id: 'e1', sourceCard: 'heavy-boots', sourcePlayer: 'p1', params: { hook: 'diceTotal', op: 'add', value: -3 }, lifetime: { charges: 1 }, seq: 2 }),
    effect({ id: 'e2', sourceCard: 'loaded-die', params: { hook: 'diceFace', die: 'first', set: 6 }, lifetime: { charges: 1 }, seq: 1 }),
  ];

  function mine(withEffects: ActiveEffect[]) {
    const v = view({ p0: 30, p1: 52, p2: 30, p3: 7 }, { effects: withEffects });
    const rows = playerRows({ view: v, presentation: presentationFromView(v), record: { round: 1, dice: {}, cards: {} }, seats: SEATS, me: 'p0', watch: null });
    return { row: rows.find((r) => r.me)!, mods: nextRollMods(withEffects, 'p0'), players: rows.length };
  }

  it('shows my tile and rank, what changes my next roll in order, and my effects in full', () => {
    mockMatchMedia(false);
    render(<YourPiece {...mine(effects)} boardSize={100} />);
    expect(screen.getByRole('button', { name: /Your knight/ }).textContent).toContain('Rank 2 of 4');
    expect(screen.getByText('30').closest('.yp-tile')!.textContent).toBe('30/100');
    expect([...document.querySelectorAll('.yp-next b')].map((b) => b.textContent)).toEqual(['Die = 6', 'Total −3']);
    const list = within(screen.getByRole('list', { name: 'Effects on you' }));
    expect(list.getAllByRole('listitem').map((li) => li.querySelector('strong')!.textContent)).toEqual(['Heavy Boots', 'Loaded Die']);
    expect(list.getByText(/Next dice total −3, from Mochi/)).toBeTruthy();
  });

  it('says when nothing changes my roll and no effect is on me', () => {
    mockMatchMedia(false);
    render(<YourPiece {...mine([])} boardSize={100} />);
    expect(document.querySelector('.yp-next b')!.textContent).toBe('No modifiers');
    expect(screen.getByText('No effects on you right now.')).toBeTruthy();
  });

  it('collapses, and starts collapsed on screens under 450 px tall', () => {
    mockMatchMedia(true);
    render(<YourPiece {...mine(effects)} boardSize={100} />);
    const head = screen.getByRole('button', { name: /Your knight/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Effects on you' })).toBeNull();
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('list', { name: 'Effects on you' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/hud.test.tsx`
Expected: FAIL with `Failed to resolve import` for a panel that doesn't exist yet.

- [ ] **Step 3: Build the panels**

Create `apps/client/src/hud/Parts.tsx`:

```tsx
import type { CSSProperties } from 'react';
import type { SeatInfo } from '../service/matchService';
import type { FeedPart } from './feed';

/** Feed-style text: plain strings, and players' nicknames drawn in their seat colour. */
export function Parts({ parts, seats }: { parts: readonly FeedPart[]; seats: readonly SeatInfo[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return part;
        const seat = seats.find((s) => s.playerId === part.player);
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- parts never reorder
          <b key={i} className="who" style={seat ? ({ '--seat': seat.color } as CSSProperties) : undefined}>
            {seat?.nickname ?? part.player}
          </b>
        );
      })}
    </>
  );
}
```

Create `apps/client/src/hud/StageBar.tsx`:

```tsx
import { Icon } from '../ui/Icon';
import { STAGES } from './model';

/** Seconds left at which the timer bar turns to the accent colour. */
export const TIMER_LOW_S = 3;

/**
 * Top centre, one row (spec #2 §7.2): ROUND n, an icon per stage (past ones done, the current
 * one named), then the open window's timer.
 */
export function StageBar({ round, stage, timer }: { round: number; stage: number | null; timer: { seconds: number; fraction: number } | null }) {
  return (
    <div className="stage-bar">
      <span className="stage-round display">
        ROUND <b>{round}</b>
      </span>
      <span className="stage-sep" />
      <ol className="stage-steps" aria-label="Stages of the round">
        {STAGES.map((s, i) => {
          const state = stage === null || i > stage ? 'next' : i < stage ? 'done' : 'now';
          return (
            <li key={s.id} className={state} aria-label={s.label} aria-current={state === 'now' ? 'step' : undefined}>
              <Icon name={s.icon} />
              <span className="display" aria-hidden="true">
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      {timer && (
        <>
          <span className="stage-sep" />
          <div className="stage-timer" role="timer" aria-label={`${timer.seconds} seconds left`}>
            <div className={timer.seconds <= TIMER_LOW_S ? 'stage-tbar low' : 'stage-tbar'}>
              <i style={{ width: `${(timer.fraction * 100).toFixed(1)}%` }} />
            </div>
            <span className="display">{`${timer.seconds}s`}</span>
          </div>
        </>
      )}
    </div>
  );
}
```

Create `apps/client/src/hud/EventFeed.tsx`:

```tsx
import type { SeatInfo } from '../service/matchService';
import type { FeedLine } from './feed';
import { Parts } from './Parts';

/** Top left (spec #2 §7.2): the newest lines first; private ones are dashed. Phones show 3. */
export function EventFeed({ lines, seats }: { lines: readonly FeedLine[]; seats: readonly SeatInfo[] }) {
  return (
    <ol className="feed" aria-label="What just happened" aria-live="polite">
      {lines.map((line) => (
        <li key={line.seq} className={line.private ? 'feed-line private' : 'feed-line'}>
          <Parts parts={line.parts} seats={seats} />
        </li>
      ))}
    </ol>
  );
}
```

Create `apps/client/src/hud/Chips.tsx`:

```tsx
import type { CardResult, Rarity } from '@laddorious/core';
import { DieFace } from '../ui/DieFace';
import { Icon } from '../ui/Icon';
import { cardInfo, type EffectChip } from './labels';
import type { CardRecord, DiceRecord } from './record';

// The small chips of the player column, the details card and the your-piece panel (spec #2 §7.2).

export const RARITY_NAMES: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic' };
export const RESULT_NAMES: Record<CardResult, string> = { hit: 'Hit', blocked: 'Blocked', fizzled: 'Fizzled' };

/** An active effect: its icon with a short badge ("6", "×2", "−3", "2r"). */
export function EffectChipView({ chip, large = false }: { chip: EffectChip; large?: boolean }) {
  return (
    <span className={large ? 'chip lg' : 'chip'} role="img" aria-label={chip.name}>
      <Icon name={chip.icon} />
      <b>{chip.badge}</b>
    </span>
  );
}

/** On a "?" square with a card still to pick; the glyph's colour shows the rarity (§6.1). */
export function MysteryChip({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`chip chip-q display ${rarity}`} role="img" aria-label={`On a ${RARITY_NAMES[rarity]} ? square`}>
      ?
    </span>
  );
}

/** A picked card: face down until the reveal, then its type colour, rarity ring and result dot. */
export function CardChip({ card }: { card: 'facedown' | CardRecord }) {
  if (card === 'facedown') {
    return (
      <span className="chip chip-card facedown" role="img" aria-label="Card picked, face down">
        <Icon name="lock" />
      </span>
    );
  }
  const info = cardInfo(card.cardId);
  const label = card.result ? `${info.name}: ${RESULT_NAMES[card.result]}` : info.name;
  return (
    <span className={`chip chip-card ${info.type} ${info.rarity}`} role="img" aria-label={label}>
      <Icon name={info.icon} />
      {card.result && <i className={card.result} />}
    </span>
  );
}

/** This round's dice: each face (forced ones flash), then the total when modifiers changed it. */
export function DiceChips({ dice }: { dice: DiceRecord }) {
  const sum = dice.faces.reduce((a, b) => a + b, 0);
  return (
    <>
      {dice.faces.map((face, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- a die's position is its identity
        <DieFace key={i} face={face} forced={dice.forced[i] ?? false} />
      ))}
      {dice.total !== null && (dice.faces.length > 1 || dice.total !== sum) && <span className="prow-total display">{`=${dice.total}`}</span>}
    </>
  );
}
```

Create `apps/client/src/hud/PlayerColumn.tsx`:

```tsx
import type { PlayerId } from '@laddorious/core';
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from '../ui/Icon';
import { Portrait } from '../ui/PieceIcon';
import { CardChip, DiceChips, EffectChipView, MysteryChip, RARITY_NAMES, RESULT_NAMES } from './Chips';
import { PIECE_NAMES, cardInfo } from './labels';
import type { PlayerRow, RowStatus } from './model';

/** A press this long opens a row's details card instead of watching (spec #2 §7.2). */
export const LONG_PRESS_MS = 500;
/** How long a re-sorted row takes to slide to its new place. */
const RESORT_MS = 450;

const STATUS_ICON: Record<Exclude<RowStatus, 'waiting'>, 'bolt' | 'check' | 'lock' | 'eye'> = { turn: 'bolt', done: 'check', locked: 'lock', idle: 'eye' };

function StatusIcon({ status }: { status: RowStatus }) {
  return <span className={`prow-status ${status}`}>{status === 'waiting' ? <span className="spinner" /> : <Icon name={STATUS_ICON[status]} />}</span>;
}

const isMouse = (e: ReactPointerEvent) => e.pointerType !== 'touch' && e.pointerType !== 'pen';
const nameOf = (row: PlayerRow) => (row.me ? `${row.seat.nickname} (you)` : row.seat.nickname);

/** Everything about one player, for a long press or a mouse hover (spec #2 §7.2). */
function Details({ row, players }: { row: PlayerRow; players: number }) {
  const card = row.card;
  return (
    <div className="pdetail panel" role="note" aria-label={row.seat.nickname}>
      <span className="pdetail-name display">{row.seat.nickname}</span>
      <span className="pdetail-sub">{`${PIECE_NAMES[row.seat.piece]} · tile ${row.tile} · rank ${row.rank} of ${players}`}</span>
      <div className="pdetail-row">
        <span className="pdetail-key">Dice</span>
        {row.dice ? (
          <>
            <DiceChips dice={{ ...row.dice, total: null }} />
            {row.dice.total !== null && <span>{`Moves ${row.dice.total}`}</span>}
          </>
        ) : (
          <span className="pdetail-none">Not rolled yet</span>
        )}
      </div>
      <div className="pdetail-row">
        <span className="pdetail-key">Now</span>
        {row.statusText}
      </div>
      {row.mystery && (
        <div className="pdetail-row">
          <span className="pdetail-key">Square</span>
          <MysteryChip rarity={row.mystery} />
          {`${RARITY_NAMES[row.mystery]} ?, picks a card this round`}
        </div>
      )}
      <span className="pdetail-key">Effects</span>
      {row.effects.length > 0 ? (
        row.effects.map((chip) => (
          <div key={chip.id} className="pdetail-fx">
            <EffectChipView chip={chip} />
            <span>
              <b>{chip.name}</b> {`${chip.description}. ${chip.life}.`}
            </span>
          </div>
        ))
      ) : (
        <div className="pdetail-none">None</div>
      )}
      {card && <span className="pdetail-key">Card</span>}
      {card === 'facedown' && <div className="pdetail-none">Picked a card. It stays hidden until everyone has picked.</div>}
      {card && card !== 'facedown' && (
        <div className="pdetail-fx">
          <CardChip card={card} />
          <span>
            <b>{cardInfo(card.cardId).name}</b> {cardInfo(card.cardId).text}
            {card.result && <b>{` ${RESULT_NAMES[card.result]}`}</b>}
          </span>
        </div>
      )}
    </div>
  );
}

interface PlayerColumnProps {
  rows: PlayerRow[];
  /** Watch a piece, or null to go back to my own (spec #2 §5.3). */
  onWatch: (player: PlayerId | null) => void;
  reducedMotion: boolean;
}

/**
 * The TFT-style player column on the right edge (spec #2 §7.2): front-runner first, each row
 * with a status icon, a name plate with the tile, a mini row of dice and chips, and a portrait
 * with the rank. Tap watches that piece; a long press or a mouse hover opens the details card.
 */
export function PlayerColumn({ rows, onWatch, reducedMotion }: PlayerColumnProps) {
  const [detail, setDetail] = useState<{ id: PlayerId; by: 'press' | 'hover' } | null>(null);
  const pressRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
  const itemsRef = useRef(new Map<PlayerId, HTMLLIElement>());
  const topsRef = useRef(new Map<PlayerId, number>());
  const order = rows.map((r) => r.seat.playerId).join(' ');

  useEffect(() => () => {
    if (pressRef.current.timer !== null) clearTimeout(pressRef.current.timer);
  }, []);

  // Rows that change place slide there from where they were (FLIP), unless motion is reduced.
  useLayoutEffect(() => {
    for (const [id, el] of itemsRef.current) {
      const top = el.offsetTop;
      const before = topsRef.current.get(id);
      topsRef.current.set(id, top);
      if (reducedMotion || before === undefined || before === top || typeof el.animate !== 'function') continue;
      el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], { duration: RESORT_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1.1)' });
    }
  }, [order, reducedMotion]);

  const stopPress = () => {
    if (pressRef.current.timer !== null) clearTimeout(pressRef.current.timer);
    pressRef.current.timer = null;
  };

  return (
    <ol className="players live" aria-label="Players">
      {rows.map((row) => {
        const id = row.seat.playerId;
        const classes = ['prow', row.me ? 'me' : '', row.watched ? 'watched' : '', row.rank === 1 ? 'first' : ''].filter(Boolean).join(' ');
        return (
          <li
            key={id}
            ref={(el) => {
              if (el) itemsRef.current.set(id, el);
              else itemsRef.current.delete(id);
            }}
          >
            <button
              type="button"
              className={classes}
              aria-label={`${nameOf(row)}, tile ${row.tile}, rank ${row.rank}. ${row.statusText}`}
              onPointerDown={() => {
                stopPress();
                pressRef.current.fired = false;
                pressRef.current.timer = setTimeout(() => {
                  pressRef.current.timer = null;
                  pressRef.current.fired = true;
                  setDetail({ id, by: 'press' });
                }, LONG_PRESS_MS);
              }}
              onPointerUp={stopPress}
              onPointerCancel={stopPress}
              onPointerEnter={(e) => {
                if (isMouse(e)) setDetail({ id, by: 'hover' });
              }}
              onPointerLeave={(e) => {
                stopPress();
                if (isMouse(e)) setDetail((d) => (d?.id === id && d.by === 'hover' ? null : d));
              }}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (pressRef.current.fired) {
                  pressRef.current.fired = false;
                  return;
                }
                if (detail?.by === 'press') {
                  setDetail(null);
                  return;
                }
                onWatch(row.me || row.watched ? null : id);
              }}
            >
              <StatusIcon status={row.status} />
              <span className="prow-plate">
                <span className="prow-name display">
                  {row.seat.nickname}
                  <span className="prow-tile">{row.tile}</span>
                </span>
                <span className="prow-mini">
                  {row.dice && <DiceChips dice={row.dice} />}
                  {row.mystery && <MysteryChip rarity={row.mystery} />}
                  {row.effects.map((chip) => (
                    <EffectChipView key={chip.id} chip={chip} />
                  ))}
                  {row.card && <CardChip card={row.card} />}
                </span>
              </span>
              <Portrait piece={row.seat.piece} color={row.seat.color} badge={row.rank} />
            </button>
            {detail?.id === id && <Details row={row} players={rows.length} />}
          </li>
        );
      })}
    </ol>
  );
}
```

Create `apps/client/src/hud/YourPiece.tsx`:

```tsx
import { Fragment, useId, useState } from 'react';
import { Portrait } from '../ui/PieceIcon';
import { useMediaQuery } from '../ui/useMediaQuery';
import { EffectChipView } from './Chips';
import { PIECE_NAMES } from './labels';
import type { PlayerRow } from './model';

/** Screens shorter than this start with the panel collapsed. */
export const SHORT_SCREEN = '(max-height: 449px)';

interface YourPieceProps {
  /** My row of the player column. */
  row: PlayerRow;
  /** What changes my next roll, in the order the engine applies it (labels.nextRollMods). */
  mods: string[];
  players: number;
  boardSize: number;
}

/**
 * Bottom left (spec #2 §7.2): my tile and rank, what changes my next roll, and my effects in
 * full. Its header collapses it; it starts collapsed on short screens.
 */
export function YourPiece({ row, mods, players, boardSize }: YourPieceProps) {
  const short = useMediaQuery(SHORT_SCREEN);
  const [open, setOpen] = useState(!short);
  const bodyId = useId();
  return (
    <section className={open ? 'your-piece panel live open' : 'your-piece panel live'} aria-label="Your piece">
      <button type="button" className="yp-head" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
        <Portrait piece={row.seat.piece} color={row.seat.color} />
        <span>
          <span className="yp-name">{`Your ${PIECE_NAMES[row.seat.piece].toLowerCase()}`}</span>
          <span className="yp-sub">{`Rank ${row.rank} of ${players}`}</span>
        </span>
        <span className="yp-tile display">
          <b>{row.tile}</b>
          <small>{`/${boardSize}`}</small>
        </span>
      </button>
      {open && (
        <div id={bodyId}>
          <div className="yp-next">
            NEXT ROLL
            {mods.length === 0 ? (
              <b>No modifiers</b>
            ) : (
              mods.map((mod, i) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- the order is the meaning
                <Fragment key={i}>
                  {i > 0 && <i>then</i>}
                  <b>{mod}</b>
                </Fragment>
              ))
            )}
          </div>
          {row.effects.length === 0 ? (
            <p className="yp-empty">No effects on you right now.</p>
          ) : (
            <ul className="yp-fx" aria-label="Effects on you">
              {row.effects.map((chip) => (
                <li key={chip.id}>
                  <EffectChipView chip={chip} large />
                  <span>
                    <strong>{chip.name}</strong>
                    {chip.description}
                  </span>
                  <em>{chip.life}</em>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
```

Create `apps/client/src/hud/hud.css`:

```css
/* The match HUD panels (spec #2 §7.2): stage bar, event feed, player column, your-piece panel.
   Sizes follow the viewport height (cqh of .app) with pixel minimums; colours come from
   theme.css tokens only. */

/* ---------------------------------------------------------------- stage bar, top centre */
.stage-bar {
  position: absolute;
  left: 50%;
  top: calc(var(--safe-t) + var(--edge));
  display: flex;
  align-items: center;
  gap: max(8px, 1.4cqh);
  padding: max(4px, 0.7cqh) max(12px, 2cqh) max(4px, 0.7cqh) max(14px, 2.2cqh);
  border-radius: 999px;
  background: var(--plate);
  color: var(--white);
  white-space: nowrap;
  transform: translateX(-50%);
}

.stage-round {
  font-size: max(16px, 2.8cqh);
  line-height: 1;
}

.stage-round b {
  font-weight: 400;
  color: var(--gold);
}

.stage-sep {
  flex: none;
  width: 2px;
  height: max(16px, 2.8cqh);
  border-radius: 2px;
  background: var(--faint-on-plate);
}

.stage-steps {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stage-steps li {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: max(24px, 3.9cqh);
  min-width: max(24px, 3.9cqh);
  padding: 0 6px;
  border-radius: 999px;
  color: var(--muted-on-plate);
  font-size: max(14px, 2.2cqh);
  opacity: 0.6;
}

.stage-steps li span {
  display: none;
  font-size: max(13px, 2cqh);
  line-height: 1;
}

.stage-steps li.done {
  color: var(--done);
  opacity: 1;
}

.stage-steps li.now {
  padding: 0 11px 0 9px;
  background: var(--highlight);
  color: var(--ink);
  opacity: 1;
}

.stage-steps li.now span {
  display: inline;
}

.stage-timer {
  display: flex;
  align-items: center;
  gap: max(7px, 1.2cqh);
}

.stage-tbar {
  width: max(80px, 15cqh);
  height: max(8px, 1.4cqh);
  padding: 2px;
  border-radius: 99px;
  background: var(--faint-on-plate);
}

.stage-tbar i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: var(--highlight);
  transition: width 0.25s linear;
}

.stage-tbar.low i {
  background: var(--accent);
}

.stage-timer span {
  min-width: 2.2em;
  font-size: max(14px, 2.3cqh);
  font-variant-numeric: tabular-nums;
}

/* ---------------------------------------------------------------- event feed, top left */
.feed {
  position: absolute;
  left: calc(var(--safe-l) + var(--edge));
  top: calc(var(--safe-t) + var(--edge));
  display: flex;
  flex-direction: column;
  gap: max(4px, 0.7cqh);
  width: max(220px, 42cqh);
  margin: 0;
  padding: 0;
  list-style: none;
}

.feed-line {
  padding: max(4px, 0.7cqh) max(9px, 1.4cqh);
  border-radius: max(9px, 1.5cqh);
  background: var(--plate);
  color: var(--white);
  font: 500 max(12px, 1.9cqh) / 1.3 var(--body);
  animation: feed-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}

.feed-line.private {
  background: var(--plate-soft);
  outline: 1.5px dashed var(--empty-seat-edge);
  outline-offset: -3px;
}

.feed-line:nth-child(n + 4) {
  opacity: 0.72;
}

/* Phones (short screens) keep 3 lines (§7.2). */
@container (max-height: 500px) {
  .feed-line:nth-child(n + 4) {
    display: none;
  }
}

/* A player's name in feed-style text, tinted with their seat colour (set as --seat). */
.who {
  font-weight: 700;
  color: color-mix(in srgb, var(--seat, var(--white)) 55%, var(--white));
}

@keyframes feed-in {
  from {
    opacity: 0;
    transform: translateX(-24px);
  }
}

/* ---------------------------------------------------------------- chips */
.chip {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: none;
  width: max(18px, 2.8cqh);
  height: max(18px, 2.8cqh);
  border: 1.5px solid var(--ink);
  border-radius: 6px;
  background: var(--white);
  color: var(--ink);
  font-size: max(11px, 1.7cqh);
}

.chip > b {
  position: absolute;
  right: -5px;
  bottom: -5px;
  padding: 1px 2px;
  border-radius: 5px;
  background: var(--ink);
  color: var(--white);
  font: 400 max(8.5px, 1.3cqh) / 1 var(--display);
}

.chip.lg {
  width: max(24px, 3.8cqh);
  height: max(24px, 3.8cqh);
  border-width: 2px;
  border-radius: 8px;
  font-size: max(14px, 2.2cqh);
}

.chip-q {
  background: var(--mystery);
  color: var(--rarity-common);
  font-size: max(13px, 2.1cqh);
  line-height: 1;
  text-shadow: 0 1.5px 0 var(--ink);
}

.chip-q.rare {
  color: var(--rarity-rare);
}

.chip-q.epic {
  color: var(--rarity-epic);
}

.chip-card {
  color: var(--card-type, var(--ink));
}

.chip-card.movement {
  --card-type: var(--type-movement);
}

.chip-card.defense {
  --card-type: var(--type-defense);
}

.chip-card.attack {
  --card-type: var(--type-attack);
}

.chip-card.risky {
  --card-type: var(--type-risky);
}

.chip-card.misc {
  --card-type: var(--type-misc);
}

.chip-card.rare {
  box-shadow: 0 0 0 2px var(--rarity-rare);
}

.chip-card.epic {
  box-shadow: 0 0 0 2px var(--rarity-epic);
}

.chip-card.facedown {
  background: repeating-linear-gradient(45deg, var(--mystery) 0 4px, var(--plate-soft) 4px 8px);
  color: var(--white);
}

.chip-card > i {
  position: absolute;
  right: -5px;
  top: -5px;
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--ink);
  border-radius: 50%;
}

.chip-card > i.hit {
  background: var(--result-hit);
}

.chip-card > i.blocked {
  background: var(--result-blocked);
}

.chip-card > i.fizzled {
  background: var(--result-fizzled);
}

/* ---------------------------------------------------------------- player column, right edge */
.players {
  position: absolute;
  right: calc(var(--safe-r) + var(--edge));
  top: calc(var(--safe-t) + max(56px, 9.5cqh));
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: max(6px, 1.3cqh);
  margin: 0;
  padding: 0;
  list-style: none;
}

.players > li {
  position: relative;
}

.prow {
  display: flex;
  align-items: center;
  gap: max(5px, 1cqh);
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: right;
  cursor: pointer;
  -webkit-touch-callout: none;
}

.prow-status {
  display: grid;
  place-items: center;
  flex: none;
  width: max(22px, 3.4cqh);
  height: max(22px, 3.4cqh);
  border: 2px solid var(--white);
  border-radius: 50%;
  background: var(--plate);
  color: var(--white);
  font-size: max(11px, 1.7cqh);
}

.prow-status.turn {
  background: var(--accent);
  animation: pulse 1.1s ease-in-out infinite;
}

.prow-status.done {
  background: var(--done);
  color: var(--ink);
}

.prow-status.locked {
  background: var(--mystery);
}

.prow-status.idle {
  background: var(--plate-soft);
}

.prow-status .spinner {
  width: 0.95em;
  height: 0.95em;
  border-width: 2px;
}

.prow-plate {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: max(3px, 0.5cqh);
}

.prow-name {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 3px 3px max(8px, 1.4cqh);
  border-radius: max(8px, 1.3cqh);
  background: var(--plate);
  color: var(--white);
  font-size: max(13px, 2cqh);
  line-height: 1;
  white-space: nowrap;
}

.prow-tile {
  min-width: 2.1em;
  padding: 3px 5px 2px;
  border-radius: 6px;
  background: var(--white);
  color: var(--ink);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.prow-mini {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: max(18px, 2.8cqh);
  font-size: max(13px, 2cqh);
}

.prow-mini .die-face {
  width: 1.2em;
  height: 1.2em;
}

.prow-total {
  color: var(--white);
  text-shadow: var(--o-sm);
}

.prow.first .portrait-badge {
  background: var(--gold);
}

/* My row is larger and outlined in mint (§7.2); a watched piece's row gets a tangerine ring. */
.prow.me .prow-name {
  font-size: max(15px, 2.4cqh);
}

.prow.me .prow-tile {
  background: var(--highlight);
}

.prow.me .portrait {
  width: max(50px, 10.5cqh);
  height: max(50px, 10.5cqh);
  box-shadow: 0 0 0 3px var(--highlight);
}

.prow.watched .portrait {
  box-shadow: 0 0 0 3.5px var(--primary);
}

/* The details card: left of its row, for a long press or a mouse hover. */
.pdetail {
  position: absolute;
  right: calc(100% + 10px);
  top: 50%;
  z-index: 20;
  width: max(220px, 36cqh);
  padding: 10px 12px;
  font: 500 max(12px, 1.8cqh) / 1.3 var(--body);
  text-align: left;
  transform: translateY(-50%);
  animation: rise 0.2s ease-out;
}

.pdetail-name {
  display: block;
  font-size: 1.35em;
  line-height: 1;
}

.pdetail-sub {
  display: block;
  margin: 3px 0 8px;
  color: var(--muted-on-paper);
  font-size: 0.92em;
  font-weight: 600;
}

.pdetail-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
}

.pdetail-key {
  min-width: 44px;
  color: var(--muted-on-paper);
  font-size: 0.82em;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.pdetail-fx {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 7px;
  margin-top: 5px;
}

.pdetail-none {
  color: var(--muted-on-paper);
}

/* ---------------------------------------------------------------- your piece, bottom left */
.your-piece {
  position: absolute;
  left: calc(var(--safe-l) + var(--edge));
  bottom: calc(var(--safe-b) + var(--edge));
  width: max(230px, 39cqh);
  overflow: hidden;
}

.yp-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: max(6px, 1.1cqh) 12px;
  border: 0;
  background: var(--accent);
  color: var(--white);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.your-piece.open .yp-head {
  border-bottom: 3px solid var(--ink);
}

.yp-head .portrait {
  width: max(36px, 6cqh);
  height: max(36px, 6cqh);
  border-width: 2.5px;
}

.yp-name {
  display: block;
  font: 400 max(15px, 2.4cqh) / 1 var(--display);
  text-shadow: 0 2px 0 var(--ink);
}

.yp-sub {
  display: block;
  font-size: max(11px, 1.7cqh);
  font-weight: 600;
}

.yp-tile {
  margin-left: auto;
  font-size: max(24px, 4.2cqh);
  line-height: 1;
  text-shadow: var(--o-sm);
  font-variant-numeric: tabular-nums;
}

.yp-tile b {
  font-weight: 400;
}

.yp-tile small {
  font-size: 0.45em;
}

.yp-next {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 9px 12px 6px;
  color: var(--muted-on-paper);
  font: 700 max(11px, 1.7cqh) / 1.2 var(--body);
  letter-spacing: 0.3px;
}

.yp-next b {
  padding: 5px 7px 4px;
  border-radius: 7px;
  background: var(--paper-alt);
  color: var(--ink);
  font: 400 max(12px, 1.85cqh) / 1 var(--display);
  letter-spacing: 0;
}

.yp-next i {
  font-style: normal;
  font-weight: 500;
}

.yp-fx {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
  padding: 2px 12px 11px;
  list-style: none;
}

.yp-fx li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  font: 500 max(11px, 1.75cqh) / 1.25 var(--body);
}

.yp-fx strong {
  display: block;
  margin-bottom: 2px;
  font: 400 max(13px, 2cqh) / 1 var(--display);
}

.yp-fx em {
  color: var(--muted-on-paper);
  font-size: 0.88em;
  font-style: normal;
  font-weight: 700;
  white-space: nowrap;
}

.yp-empty {
  margin: 0;
  padding: 2px 12px 11px;
  color: var(--muted-on-paper);
  font: 500 max(11px, 1.75cqh) / 1.25 var(--body);
}

@keyframes pulse {
  50% {
    transform: scale(1.12);
  }
}
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/hud.test.tsx`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  49 passed (49)` and `Tests  356 passed (356)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): draw the stage bar, feed, player column and your-piece panel

The TFT-style player column with dice, the ? chip, effect chips and
card chips, rank badges and status icons; tap to watch, long press or
hover for details, rows that slide to their new place; the your-piece
panel with next-roll modifiers, collapsed on short screens (spec #2
§7.2, §9.2).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The dock, the popups and banners

**Files:**
- Create:
  - `apps/client/src/ui/useHotkeys.ts`;
  - in `apps/client/src/hud/`: `Dock.tsx`, `FaceOffPopup.tsx`, `CardPickPopup.tsx`, `Banner.tsx`, `popups.css`;
  - `apps/client/test/popups.test.tsx`.

**Interfaces:**
- Consumes: Tasks 6–8.
- Produces:
  - `useHotkeys(keys, enabled?)`;
  - `Dock({ model, seats, onRoll })`;
  - `FaceOffPopup({ model, seats, me, onPick })`;
  - `CardPickPopup({ model, onPick, onReroll })`;
  - `useBanner(beat, me, seats)`, `BannerView({ banner })` and `BANNER_MS`.

- [ ] **Step 1: Write the failing tests**

Create `apps/client/test/popups.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { GameEvent } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlayingBeat } from '../src/director/director';
import { presentationFromView } from '../src/director/presentation';
import { BANNER_MS, BannerView, useBanner } from '../src/hud/Banner';
import { CardPickPopup } from '../src/hud/CardPickPopup';
import { Dock } from '../src/hud/Dock';
import { FaceOffPopup } from '../src/hud/FaceOffPopup';
import { cardInfo } from '../src/hud/labels';
import type { CardPickModel, DockModel, FaceOffModel } from '../src/hud/model';
import { SEATS, openingUpdate } from './support/fixtures';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const press = (key: string) => fireEvent.keyDown(window, { key });

describe('Dock (spec #2 §7.2)', () => {
  it('rolls once per dice window, by tap or by Space', () => {
    const onRoll = vi.fn();
    const { rerender } = render(<Dock model={{ kind: 'roll', windowId: 3 }} seats={SEATS} onRoll={onRoll} />);
    fireEvent.click(screen.getByRole('button', { name: 'ROLL' }));
    expect(onRoll).toHaveBeenCalledWith(3);
    expect(screen.getByRole('button', { name: 'Rolling…' }).hasAttribute('disabled')).toBe(true);
    press(' ');
    expect(onRoll).toHaveBeenCalledTimes(1);
    rerender(<Dock model={{ kind: 'roll', windowId: 4 }} seats={SEATS} onRoll={onRoll} />);
    press(' ');
    expect(onRoll).toHaveBeenLastCalledWith(4);
    expect(onRoll).toHaveBeenCalledTimes(2);
  });

  it('names who the round waits for', () => {
    render(<Dock model={{ kind: 'wait', parts: ['Waiting for ', { player: 'p2' }, ' to roll'] }} seats={SEATS} onRoll={() => {}} />);
    expect(screen.getByRole('status').textContent).toBe('Waiting for Pip to roll');
  });

  it("captions the move with everyone's total", () => {
    const model: DockModel = { kind: 'caption', parts: ['Everyone moves'], totals: [{ player: 'p1', total: 4 }, { player: 'p3', total: 2 }] };
    render(<Dock model={model} seats={SEATS} onRoll={() => {}} />);
    expect(screen.getByRole('status').textContent).toBe('Everyone moves');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Mochi +4', 'Juno +2']);
  });

  it('lines up the cards in resolution order, stamping results and raising the one resolving', () => {
    const model: DockModel = {
      kind: 'queue',
      caption: 'Cards resolve',
      cards: [
        { caster: 'p3', cardId: 'sprint', result: 'hit', current: false },
        { caster: 'p0', cardId: 'aegis', result: null, current: true },
        { caster: 'p1', cardId: 'heavy-boots', result: null, current: false },
      ],
    };
    render(<Dock model={model} seats={SEATS} onRoll={() => {}} />);
    const cards = within(screen.getByRole('list', { name: 'Cards in resolution order' })).getAllByRole('listitem');
    expect(cards.map((c) => c.querySelector('.q-order')!.textContent)).toEqual(['1', '2', '3']);
    expect(cards[0]!.textContent).toContain('Sprint');
    expect(cards[0]!.querySelector('.stamp')!.textContent).toBe('Hit');
    expect(cards[1]!.className).toContain('now');
    expect(cards[2]!.textContent).toContain('Mochi → The leader');
  });

  it('shows nothing when there is nothing to say', () => {
    const { container } = render(<Dock model={{ kind: 'none' }} seats={SEATS} onRoll={() => {}} />);
    expect(container.textContent).toBe('');
  });
});

const faceOff = (over: Partial<FaceOffModel> = {}): FaceOffModel => ({
  challengeId: 'c4',
  tile: 23,
  kind: 'rps',
  pickRound: 1,
  choices: [
    { choice: 'rock', label: 'Rock' },
    { choice: 'paper', label: 'Paper' },
    { choice: 'scissors', label: 'Scissors' },
  ],
  fighters: [
    { player: 'p0', locked: false, pick: null, out: false },
    { player: 'p1', locked: true, pick: null, out: false },
  ],
  myPick: null,
  canPick: true,
  result: null,
  ...over,
});

describe('FaceOffPopup (spec #2 §7.2)', () => {
  it('shows both fighters with their lock states, and picks by tap or by 1–3, once', () => {
    const onPick = vi.fn();
    render(<FaceOffPopup model={faceOff()} seats={SEATS} me="p0" onPick={onPick} />);
    const dialog = screen.getByRole('dialog', { name: 'FACE-OFF!' });
    expect(dialog.textContent).toContain('Tile 23');
    expect(dialog.textContent).toContain('knocked back 3');
    const fighters = within(dialog).getAllByRole('group');
    expect(fighters.map((f) => f.getAttribute('aria-label'))).toEqual(['You: Your pick', 'Mochi: Pick locked']);
    press('2');
    expect(onPick).toHaveBeenCalledWith('paper');
    fireEvent.click(screen.getByRole('button', { name: /Rock/ }));
    press('3');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('uses the Minority theme for 3 or 4 players, with keys 1–2 only', () => {
    const onPick = vi.fn();
    const model = faceOff({
      kind: 'minority',
      choices: [
        { choice: 'A', label: 'Sun' },
        { choice: 'B', label: 'Moon' },
      ],
      fighters: ['p0', 'p1', 'p2'].map((player) => ({ player, locked: false, pick: null, out: false })),
    });
    render(<FaceOffPopup model={model} seats={SEATS} me="p0" onPick={onPick} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['1Sun', '2Moon']);
    press('3');
    expect(onPick).not.toHaveBeenCalled();
    press('1');
    expect(onPick).toHaveBeenCalledWith('A');
  });

  it("reveals everyone's pick and the winner, with the buttons off", () => {
    const onPick = vi.fn();
    const model = faceOff({
      canPick: false,
      myPick: 'rock',
      fighters: [
        { player: 'p0', locked: true, pick: 'rock', out: false },
        { player: 'p1', locked: true, pick: 'paper', out: false },
      ],
      result: { winner: 'p1' },
    });
    render(<FaceOffPopup model={model} seats={SEATS} me="p0" onPick={onPick} />);
    expect(screen.getAllByRole('group').map((f) => f.getAttribute('aria-label'))).toEqual(['You: Rock', 'Mochi: Paper']);
    expect(screen.getByRole('dialog').textContent).toContain('Mochi wins the face-off');
    expect(screen.getAllByRole('button').every((b) => b.hasAttribute('disabled'))).toBe(true);
    press('1');
    expect(onPick).not.toHaveBeenCalled();
  });
});

const offer = (over: Partial<CardPickModel> = {}): CardPickModel => ({
  rarity: 'epic',
  tile: 9,
  rerollsLeft: 2,
  slots: ['aegis', 'switcheroo', 'jackpot'].map((id, slot) => ({
    slot,
    info: cardInfo(id),
    warning: id === 'switcheroo' ? 'Nobody is ahead of you right now. If that holds, it fizzles.' : null,
    rerolled: false,
    canReroll: true,
  })),
  ...over,
});

describe('CardPickPopup (spec #2 §7.2)', () => {
  it('offers three cards with type, rules, target line and fizzle warning, and picks one at once', () => {
    const onPick = vi.fn();
    render(<CardPickPopup model={offer()} onPick={onPick} onReroll={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Choose One' });
    expect(dialog.textContent).toContain('Epic ? square');
    expect(dialog.textContent).toContain('2 rerolls left');
    const switcheroo = screen.getByRole('button', { name: /^Switcheroo/ });
    expect(switcheroo.textContent).toContain('ATTACK');
    expect(switcheroo.textContent).toContain('Furthest player ahead');
    expect(switcheroo.textContent).toContain('it fizzles');
    fireEvent.click(switcheroo);
    expect(onPick).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: /^Aegis/ }));
    press('3');
    expect(onPick).toHaveBeenCalledTimes(1);
  });

  it('rerolls a card once, and disables rerolls that are used or run out', () => {
    const onReroll = vi.fn();
    const model = offer({ rerollsLeft: 1, slots: offer().slots.map((s) => ({ ...s, rerolled: s.slot === 0, canReroll: s.slot !== 0 })) });
    render(<CardPickPopup model={model} onPick={() => {}} onReroll={onReroll} />);
    expect(screen.getByRole('button', { name: 'Reroll Aegis' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reroll Jackpot' }));
    expect(onReroll).toHaveBeenCalledWith(2);
    expect(screen.getByRole('button', { name: 'Reroll Jackpot' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('dialog').textContent).toContain('1 reroll left');
  });

  it('peeks at the board and comes back, and picks by 1–3', () => {
    const onPick = vi.fn();
    render(<CardPickPopup model={offer()} onPick={onPick} onReroll={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Peek at the board' }));
    expect(screen.queryByRole('button', { name: /^Aegis/ })).toBeNull();
    press('1');
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the cards' }));
    press('3');
    expect(onPick).toHaveBeenCalledWith(2);
  });
});

describe('banners (spec #2 §5.1)', () => {
  const after = presentationFromView(openingUpdate().view);
  const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c4', tile: 23, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' };
  const beat = (startedAt: number): PlayingBeat => ({ kind: 'faceOff', durationMs: 500, events: [started], after, startedAt });

  function Harness({ playing }: { playing: PlayingBeat | null }) {
    return <BannerView banner={useBanner(playing, 'p0', SEATS)} />;
  }

  it('shows a beat’s banner for a while, even after the beat is over', () => {
    vi.useFakeTimers();
    const { rerender } = render(<Harness playing={beat(1000)} />);
    expect(screen.getByText('FACE-OFF!').className).toBe('banner bad');
    rerender(<Harness playing={null} />);
    act(() => vi.advanceTimersByTime(BANNER_MS - 1));
    expect(screen.getByText('FACE-OFF!')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('FACE-OFF!')).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/popups.test.tsx`
Expected: FAIL with `Failed to resolve import "../src/hud/Banner"`.

- [ ] **Step 3: Build the dock, the popups and the banner**

Create `apps/client/src/ui/useHotkeys.ts`:

```ts
import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Desktop extras (spec #2 §7.3): keys mapped to actions, e.g. { Space: roll, '1': pickFirst }.
 * Never required: every action also has a button. Ignored while typing, with modifier keys,
 * and on key repeat.
 */
export function useHotkeys(keys: Readonly<Record<string, () => void>>, enabled = true): void {
  const keysRef = useRef(keys);
  useLayoutEffect(() => {
    keysRef.current = keys;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const action = keysRef.current[e.key === ' ' ? 'Space' : e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
```

Create `apps/client/src/hud/Dock.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { SeatInfo } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { useHotkeys } from '../ui/useHotkeys';
import { RESULT_NAMES } from './Chips';
import { cardInfo } from './labels';
import type { DockModel, QueueCard } from './model';
import { Parts } from './Parts';

interface DockProps {
  model: DockModel;
  seats: readonly SeatInfo[];
  onRoll: (windowId: number) => void;
}

/**
 * Bottom centre (spec #2 §7.2): the ROLL button in my dice window (Space on desktop), else the
 * waiting pill, the move caption with everyone's totals, or the card resolution queue.
 */
export function Dock({ model, seats, onRoll }: DockProps) {
  const [rolledIn, setRolledIn] = useState<number | null>(null);
  const canRoll = model.kind === 'roll' && rolledIn !== model.windowId;
  const roll = () => {
    if (model.kind !== 'roll' || rolledIn === model.windowId) return;
    setRolledIn(model.windowId);
    onRoll(model.windowId);
  };
  useHotkeys({ Space: roll }, canRoll);

  switch (model.kind) {
    case 'roll':
      return (
        <div className="dock live">
          <button type="button" className="btn primary roll-btn" disabled={!canRoll} onClick={roll}>
            <Icon name="die" />
            {canRoll ? 'ROLL' : 'Rolling…'}
          </button>
          <p className="pill dock-hint desktop-only">
            <kbd>Space</kbd> Everyone rolls one die at the same time.
          </p>
        </div>
      );
    case 'wait':
      return (
        <div className="dock">
          <p className="pill" role="status">
            <span className="spinner" />
            <span>
              <Parts parts={model.parts} seats={seats} />
            </span>
          </p>
        </div>
      );
    case 'caption':
      return (
        <div className="dock">
          <p className="pill" role="status">
            <span>
              <Parts parts={model.parts} seats={seats} />
            </span>
          </p>
          {model.totals && (
            <ul className="totals" aria-label="This round's totals">
              {model.totals.map(({ player, total }) => {
                const seat = seats.find((s) => s.playerId === player);
                return (
                  <li key={player} className="tchip" style={seat ? ({ '--seat': seat.color } as CSSProperties) : undefined}>
                    {seat?.nickname ?? player} <b>{`+${total}`}</b>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    case 'queue':
      return (
        <div className="dock">
          <p className="pill" role="status">
            {model.caption}
          </p>
          <ol className="queue" aria-label="Cards in resolution order">
            {model.cards.map((card, i) => (
              <QueueItem key={card.caster} card={card} order={i + 1} seats={seats} />
            ))}
          </ol>
        </div>
      );
    case 'none':
      return null;
  }
}

/** A numbered mini card: type, rarity, name, who plays it on whom, and its stamp once resolved. */
function QueueItem({ card, order, seats }: { card: QueueCard; order: number; seats: readonly SeatInfo[] }) {
  const info = cardInfo(card.cardId);
  const caster = seats.find((s) => s.playerId === card.caster)?.nickname ?? card.caster;
  const who = info.targetLine === 'You' ? `${caster} · on themself` : `${caster} → ${info.targetLine}`;
  const classes = ['q-card', info.type, card.current ? 'now' : '', card.result ? 'done' : ''].filter(Boolean).join(' ');
  return (
    <li className={classes}>
      <span className="q-order display">{order}</span>
      <span className="q-top display">
        <span>{info.type.toUpperCase()}</span>
        <span className={`gem ${info.rarity}`}>{info.rarity.toUpperCase()}</span>
      </span>
      <span className="q-body">
        <Icon name={info.icon} />
        <span>
          <b className="display">{info.name}</b>
          <small>{who}</small>
        </span>
      </span>
      {card.result && <em className={`stamp display ${card.result}`}>{RESULT_NAMES[card.result]}</em>}
    </li>
  );
}
```

Create `apps/client/src/hud/FaceOffPopup.tsx`:

```tsx
import type { ChallengeChoice, PlayerId } from '@laddorious/core';
import { Fragment, useId, useState } from 'react';
import type { SeatInfo } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { Portrait } from '../ui/PieceIcon';
import { useHotkeys } from '../ui/useHotkeys';
import { KNOCKBACK, type FaceOffModel, type Fighter } from './model';

interface FaceOffPopupProps {
  model: FaceOffModel;
  seats: readonly SeatInfo[];
  me: PlayerId;
  onPick: (choice: ChallengeChoice) => void;
}

const RPS = new Set<ChallengeChoice>(['rock', 'paper', 'scissors']);

/**
 * The face-off (spec #2 §7.2, C11): centred over a dimmed board, no panel, only for its players.
 * Portraits with lock states and revealed picks; Rock / Paper / Scissors, or the Minority
 * theme's two choices. Tap a choice or press 1–3; one pick per pick round.
 */
export function FaceOffPopup({ model, seats, me, onPick }: FaceOffPopupProps) {
  const titleId = useId();
  const round = `${model.challengeId}:${model.pickRound}`;
  const [sentIn, setSentIn] = useState<string | null>(null);
  const canPick = model.canPick && sentIn !== round;
  const pick = (choice: ChallengeChoice) => {
    if (!canPick) return;
    setSentIn(round);
    onPick(choice);
  };
  useHotkeys(Object.fromEntries(model.choices.map((c, i) => [String(i + 1), () => pick(c.choice)])), canPick);

  const seat = (id: PlayerId) => seats.find((s) => s.playerId === id);
  const labelOf = (choice: ChallengeChoice | null) => model.choices.find((c) => c.choice === choice)?.label ?? 'No pick';
  const sent = sentIn === round || model.myPick !== null;
  const stateOf = (f: Fighter): string => {
    if (model.result) return labelOf(f.pick);
    if (f.out) return 'Out';
    if (f.locked || (f.player === me && sent)) return 'Pick locked';
    if (f.player === me) return canPick ? 'Your pick' : 'Get ready…';
    return 'Picking…';
  };
  const winner = model.result?.winner ?? null;
  const hint = model.result
    ? winner === null
      ? 'A tie! The face-off goes again.'
      : `${winner === me ? 'You win' : `${seat(winner)?.nickname ?? winner} wins`} the face-off. The loser is knocked back ${KNOCKBACK}.`
    : canPick
      ? 'Only the players in this face-off see this. Picks stay secret until everyone has locked. No pick in time counts as a loss.'
      : sent
        ? 'Waiting for the reveal…'
        : 'Get ready to pick…';

  return (
    <div className="popup live" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="backdrop" />
      <div className="popup-content">
        <h2 id={titleId} className="popup-title display">
          FACE-OFF!
        </h2>
        <p className="popup-sub">
          {`Tile ${model.tile} · ${model.kind === 'rps' ? 'Rock paper scissors' : 'Minority: the odd one out wins'} · pick round ${model.pickRound} · the loser is knocked back ${KNOCKBACK}`}
        </p>
        <div className="fighters">
          {model.fighters.map((f, i) => {
            const s = seat(f.player);
            const state = stateOf(f);
            return (
              <Fragment key={f.player}>
                {i > 0 && model.fighters.length === 2 && <span className="vs display">VS</span>}
                <div
                  className={['fighter', f.player === me ? 'me' : '', f.out ? 'out' : '', winner === f.player ? 'winner' : ''].filter(Boolean).join(' ')}
                  role="group"
                  aria-label={`${s?.nickname ?? f.player}: ${state}`}
                >
                  {s && <Portrait piece={s.piece} color={s.color} className="fighter-portrait" />}
                  {model.result && f.pick && (
                    <span className="fighter-pick">{RPS.has(f.pick) ? <Icon name={f.pick as 'rock' | 'paper' | 'scissors'} /> : <b className="display">{labelOf(f.pick)}</b>}</span>
                  )}
                  <span className="fighter-name display">{s?.nickname ?? f.player}</span>
                  <span className="fighter-state">
                    {state === 'Pick locked' && <Icon name="lock" />}
                    {state}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="choices">
          {model.choices.map((c, i) => (
            <button key={c.choice} type="button" className={model.myPick === c.choice ? 'choice on' : 'choice'} disabled={!canPick} onClick={() => pick(c.choice)}>
              <kbd>{i + 1}</kbd>
              {RPS.has(c.choice) && <Icon name={c.choice as 'rock' | 'paper' | 'scissors'} />}
              <span className="display">{c.label}</span>
            </button>
          ))}
        </div>
        <p className="popup-hint">{hint}</p>
      </div>
    </div>
  );
}
```

Create `apps/client/src/hud/CardPickPopup.tsx`:

```tsx
import { useId, useState } from 'react';
import { Icon } from '../ui/Icon';
import { useHotkeys } from '../ui/useHotkeys';
import { RARITY_NAMES } from './Chips';
import type { CardPickModel } from './model';

interface CardPickPopupProps {
  model: CardPickModel;
  onPick: (slot: number) => void;
  onReroll: (slot: number) => void;
}

/**
 * The Mystery card pick (spec #2 §7.2), like a TFT augment: "Choose One", three tall cards
 * framed by rarity, a reroll button under each, and "Peek at the board". Tapping a card (or
 * pressing 1–3) picks it at once; only the offer's owner ever sees this.
 */
export function CardPickPopup({ model, onPick, onReroll }: CardPickPopupProps) {
  const titleId = useId();
  // The hand as shown: a pick or a reroll waits for the next view, so nothing is sent twice.
  const hand = model.slots.map((s) => `${s.info.id}:${s.rerolled}`).join(' ');
  const [picked, setPicked] = useState<{ hand: string; slot: number } | null>(null);
  const [rerolling, setRerolling] = useState<{ hand: string; slot: number } | null>(null);
  const [peeking, setPeeking] = useState(false);
  const locked = picked?.hand === hand;
  const pick = (slot: number) => {
    if (locked || peeking) return;
    setPicked({ hand, slot });
    onPick(slot);
  };
  useHotkeys({ '1': () => pick(0), '2': () => pick(1), '3': () => pick(2) }, !locked && !peeking);

  return (
    <div className={peeking ? 'popup live peeking' : 'popup live'} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {!peeking && <div className="backdrop" />}
      <div className="popup-content">
        <h2 id={titleId} className="popup-title display" hidden={peeking}>
          Choose One
        </h2>
        {!peeking && (
          <>
            <p className="popup-sub">
              {`${RARITY_NAMES[model.rarity]} ? square · only you see these cards · ${model.rerollsLeft} ${model.rerollsLeft === 1 ? 'reroll' : 'rerolls'} left, 1 per card`}
            </p>
            <div className="pick-cards">
              {model.slots.map(({ slot, info, warning, canReroll }) => (
                <div key={slot} className={['pick-slot', locked ? (picked?.slot === slot ? 'chosen' : 'gone') : ''].filter(Boolean).join(' ')}>
                  <button
                    type="button"
                    className={`pick-card ${info.rarity} ${info.type}`}
                    aria-label={`${info.name}. ${info.text}${warning ? ` ${warning}` : ''}`}
                    disabled={locked}
                    onClick={() => pick(slot)}
                  >
                    <span className="pick-inner">
                      <span className="pick-type display">{info.type.toUpperCase()}</span>
                      <span className="pick-medal">
                        <Icon name={info.icon} />
                      </span>
                      <span className="pick-name display">{info.name}</span>
                      <span className="pick-text">{info.text}</span>
                      {warning && <span className="pick-warn">{warning}</span>}
                      <span className="pick-target">
                        <Icon name="target" />
                        {info.targetLine}
                      </span>
                    </span>
                    <kbd>{slot + 1}</kbd>
                  </button>
                  <button
                    type="button"
                    className="reroll-btn"
                    aria-label={`Reroll ${info.name}`}
                    disabled={locked || !canReroll || (rerolling?.hand === hand && rerolling.slot === slot)}
                    onClick={() => {
                      setRerolling({ hand, slot });
                      onReroll(slot);
                    }}
                  >
                    <Icon name="reroll" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="popup-foot">
          <button type="button" className="btn peek-btn" onClick={() => setPeeking((p) => !p)}>
            {peeking ? 'Back to the cards' : 'Peek at the board'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

Create `apps/client/src/hud/Banner.tsx`:

```tsx
import type { PlayerId } from '@laddorious/core';
import { useEffect, useState } from 'react';
import type { PlayingBeat } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { bannerFor, type BannerModel } from './model';

/** How long a banner stays up, whatever the length of its beat. */
export const BANNER_MS = 1700;

type Shown = BannerModel & { key: number };

/** The banner for the beat on stage, kept up for BANNER_MS even when the beat is shorter. */
export function useBanner(beat: PlayingBeat | null, me: PlayerId, seats: readonly SeatInfo[]): Shown | null {
  const [seen, setSeen] = useState<number | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  if (beat && beat.startedAt !== seen) {
    setSeen(beat.startedAt);
    const banner = bannerFor(beat, me, seats);
    if (banner) setShown({ ...banner, key: beat.startedAt });
  }
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  return shown;
}

/** The big word over the board ("FACE-OFF!", "BLOCKED!", "VICTORY!"), popping in and out. */
export function BannerView({ banner }: { banner: Shown | null }) {
  if (!banner) return null;
  return (
    <div key={banner.key} className={`banner ${banner.tone}`} aria-live="polite">
      {banner.text}
    </div>
  );
}
```

Create `apps/client/src/hud/popups.css`:

```css
/* The dock, the face-off and card-pick popups, and banners (spec #2 §7.2, §5.1).
   Sizes follow the viewport height (cqh of .app) with pixel minimums; colours come from
   theme.css tokens only. */

/* Key hints are desktop extras (§7.3): hidden on touch screens. */
kbd {
  padding: 2px 5px;
  border: 1.5px solid var(--muted-on-paper);
  border-bottom-width: 3px;
  border-radius: 6px;
  background: var(--paper-alt);
  color: var(--ink);
  font: 600 11px / 1 var(--body);
  text-shadow: none;
}

@media (hover: none), (pointer: coarse) {
  kbd,
  .desktop-only {
    display: none !important;
  }
}

/* ---------------------------------------------------------------- dock, bottom centre */
.dock {
  position: absolute;
  left: 50%;
  bottom: calc(var(--safe-b) + var(--edge));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: max(6px, 1.2cqh);
  transform: translateX(-50%);
}

.dock .pill {
  margin: 0;
}

.roll-btn {
  gap: max(8px, 1.6cqh);
  padding: max(10px, 2cqh) max(30px, 5.4cqh) max(9px, 1.8cqh) max(22px, 3.8cqh);
  border-width: 4px;
  border-radius: max(18px, 3.4cqh);
  box-shadow: 0 max(5px, 1cqh) 0 var(--ink);
  font-size: max(26px, 5cqh);
}

.roll-btn .icon {
  font-size: 1.25em;
}

.roll-btn:not(:disabled):hover .icon {
  animation: spin 1s linear infinite;
}

.dock-hint {
  font-weight: 500;
}

.totals {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tchip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 2px solid var(--ink);
  border-radius: 99px;
  background: var(--white);
  color: var(--ink);
  font: 600 max(12px, 1.8cqh) / 1 var(--body);
}

.tchip::before {
  content: '';
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--ink);
  border-radius: 50%;
  background: var(--seat);
}

.tchip b {
  font: 400 max(13px, 2cqh) / 1 var(--display);
}

.queue {
  display: flex;
  gap: max(10px, 2cqh);
  margin: 0;
  padding: 4px 0 0;
  list-style: none;
}

.q-card {
  position: relative;
  width: max(120px, 22cqh);
  border: 3px solid var(--ink);
  border-radius: 14px;
  background: var(--white);
  box-shadow: 0 4px 0 var(--ink);
  color: var(--ink);
  opacity: 0.6;
  transition:
    transform 0.25s,
    opacity 0.25s;
}

.q-card.movement {
  --card-type: var(--type-movement);
}

.q-card.defense {
  --card-type: var(--type-defense);
}

.q-card.attack {
  --card-type: var(--type-attack);
}

.q-card.risky {
  --card-type: var(--type-risky);
}

.q-card.misc {
  --card-type: var(--type-misc);
}

.q-card.now {
  opacity: 1;
  transform: translateY(-6px);
  box-shadow:
    0 4px 0 var(--ink),
    0 0 0 4px var(--highlight);
}

.q-card.done {
  opacity: 1;
}

.q-order {
  position: absolute;
  top: -12px;
  left: -10px;
  z-index: 2;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--white);
  font-size: 13px;
  line-height: 26px;
  text-align: center;
}

.q-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 8px 4px 9px;
  border-bottom: 3px solid var(--ink);
  border-radius: 11px 11px 0 0;
  background: var(--card-type);
  color: var(--white);
  font-size: max(10px, 1.6cqh);
  letter-spacing: 0.8px;
  text-shadow: 0 1.5px 0 var(--ink);
}

.gem {
  padding: 3px 6px;
  border-radius: 6px;
  background: var(--white);
  color: var(--ink);
  font: 700 9.5px / 1 var(--body);
  letter-spacing: 0.4px;
  text-shadow: none;
}

.gem.rare {
  background: var(--rarity-rare);
}

.gem.epic {
  background: var(--rarity-epic);
}

.q-body {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 9px 9px;
}

.q-body .icon {
  flex: none;
  color: var(--card-type);
  font-size: max(22px, 3.6cqh);
}

.q-body b {
  display: block;
  font-size: max(13px, 2.1cqh);
  line-height: 1.05;
}

.q-body small {
  display: block;
  margin-top: 2px;
  color: var(--muted-on-paper);
  font-size: max(10px, 1.55cqh);
  font-weight: 600;
  line-height: 1.2;
}

.stamp {
  position: absolute;
  right: -10px;
  top: -13px;
  padding: 4px 7px 3px;
  border: 2px solid var(--ink);
  border-radius: 8px;
  color: var(--white);
  font-size: 13px;
  font-style: normal;
  line-height: 1;
  transform: rotate(7deg);
  animation: pop-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.5);
}

.stamp.hit {
  background: var(--result-hit);
}

.stamp.blocked {
  background: var(--result-blocked);
  color: var(--ink);
}

.stamp.fizzled {
  background: var(--result-fizzled);
  color: var(--ink);
}

/* ---------------------------------------------------------------- popups: centred over a dimmed board, no panel (C11) */
.popup {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: calc(var(--safe-t) + max(48px, 8cqh)) calc(var(--safe-r) + var(--edge)) calc(var(--safe-b) + var(--edge)) calc(var(--safe-l) + var(--edge));
}

.popup.peeking {
  align-items: flex-end;
  pointer-events: none;
}

.popup-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: max(8px, 1.6cqh);
  animation: rise 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

.popup-title {
  margin: 0;
  color: var(--white);
  font-size: max(38px, 8cqh);
  line-height: 1;
  letter-spacing: 1px;
  text-shadow: var(--o-lg);
}

.popup-sub,
.popup-hint {
  max-width: min(560px, 80cqw);
  margin: 0;
  color: var(--white);
  font: 600 max(13px, 2.1cqh) / 1.35 var(--body);
  text-align: center;
  text-shadow: 0 2px 6px var(--ink);
}

.popup-hint {
  font-weight: 500;
}

.popup-foot {
  pointer-events: auto;
}

/* The face-off */
.fighters {
  display: flex;
  align-items: center;
  gap: max(16px, 4cqh);
  margin: 4px 0;
}

.fighter {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--white);
}

.fighter.out {
  opacity: 0.45;
}

.fighter-portrait {
  width: max(72px, 15cqh);
  height: max(72px, 15cqh);
  border-width: 4px;
  box-shadow:
    0 0 0 3px var(--white),
    0 max(5px, 1.1cqh) 0 var(--ink);
}

.fighter.me .fighter-portrait {
  box-shadow:
    0 0 0 4px var(--highlight),
    0 max(5px, 1.1cqh) 0 var(--ink);
}

.fighter.winner .fighter-portrait {
  box-shadow:
    0 0 0 5px var(--gold),
    0 max(5px, 1.1cqh) 0 var(--ink);
}

.fighter-pick {
  position: absolute;
  right: -22px;
  top: -12px;
  display: grid;
  place-items: center;
  min-width: max(44px, 8.5cqh);
  height: max(44px, 8.5cqh);
  padding: 0 6px;
  border: 3px solid var(--ink);
  border-radius: 999px;
  background: var(--white);
  box-shadow: 0 4px 0 var(--ink);
  color: var(--mystery);
  font-size: max(26px, 5cqh);
  animation: pop-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.5);
}

.fighter-pick b {
  color: var(--ink);
  font-size: max(13px, 2.2cqh);
}

.fighter-name {
  font-size: max(16px, 3cqh);
  line-height: 1;
  text-shadow: var(--o-sm);
}

.fighter-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: 600 max(12px, 1.9cqh) / 1 var(--body);
  text-shadow: 0 1px 4px var(--ink);
}

.vs {
  color: var(--gold);
  font-size: max(32px, 6.5cqh);
  line-height: 1;
  text-shadow: var(--o);
}

.choices {
  display: flex;
  gap: max(14px, 3cqh);
}

.choice {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: max(76px, 15cqh);
  height: max(76px, 15cqh);
  border: 4px solid var(--ink);
  border-radius: 50%;
  background: var(--white);
  box-shadow: 0 max(4px, 0.9cqh) 0 var(--ink);
  color: var(--ink);
  font-size: max(13px, 2.1cqh);
  cursor: pointer;
  transition: transform 0.12s;
}

.choice .icon {
  color: var(--mystery);
  font-size: max(30px, 6.4cqh);
}

.choice kbd {
  position: absolute;
  top: -4px;
  right: 2px;
}

.choice:hover:not(:disabled) {
  transform: translateY(-4px) scale(1.04);
}

.choice.on {
  background: var(--accent);
  color: var(--white);
}

.choice.on .icon {
  color: var(--white);
}

.choice:disabled:not(.on) {
  opacity: 0.4;
  cursor: default;
}

/* The card pick */
.pick-cards {
  display: flex;
  align-items: flex-start;
  gap: max(14px, 3.6cqh);
}

.pick-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: max(8px, 1.8cqh);
  transition:
    opacity 0.3s,
    transform 0.3s;
}

.pick-slot.gone {
  opacity: 0.25;
  transform: scale(0.94);
}

.pick-card {
  position: relative;
  display: flex;
  width: max(150px, 30cqh);
  height: max(200px, 41cqh);
  padding: max(6px, 1.2cqh);
  border: 4px solid var(--ink);
  border-radius: max(16px, 3.2cqh);
  background: linear-gradient(160deg, var(--frame-a), var(--frame-b));
  box-shadow: 0 max(5px, 1cqh) 0 var(--ink);
  color: var(--ink);
  text-align: center;
  cursor: pointer;
  transition: transform 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}

.pick-card.common {
  --frame-a: var(--paper-alt);
  --frame-b: var(--muted-on-plate);
}

.pick-card.rare {
  --frame-a: var(--rarity-rare);
  --frame-b: var(--mystery);
}

.pick-card.epic {
  --frame-a: var(--rarity-epic);
  --frame-b: var(--primary);
}

.pick-card.movement {
  --card-type: var(--type-movement);
}

.pick-card.defense {
  --card-type: var(--type-defense);
}

.pick-card.attack {
  --card-type: var(--type-attack);
}

.pick-card.risky {
  --card-type: var(--type-risky);
}

.pick-card.misc {
  --card-type: var(--type-misc);
}

.pick-card:hover:not(:disabled) {
  transform: translateY(-10px) scale(1.03);
}

.pick-card:disabled {
  cursor: default;
}

.pick-slot.chosen .pick-card {
  transform: translateY(-14px) scale(1.06);
  box-shadow:
    0 max(5px, 1cqh) 0 var(--ink),
    0 0 0 6px var(--white);
}

.pick-card kbd {
  position: absolute;
  top: -10px;
  right: -8px;
}

.pick-inner {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: max(4px, 0.9cqh);
  min-width: 0;
  padding: max(7px, 1.4cqh) max(8px, 1.6cqh);
  border: 3px solid var(--ink);
  border-radius: max(11px, 2.2cqh);
  background: var(--paper);
}

.pick-type {
  padding: 4px 9px 3px;
  border: 2px solid var(--ink);
  border-radius: 99px;
  background: var(--card-type);
  color: var(--white);
  font-size: max(10px, 1.6cqh);
  letter-spacing: 1px;
  text-shadow: 0 1px 0 var(--ink);
}

.pick-medal {
  display: grid;
  place-items: center;
  flex: none;
  width: max(52px, 11cqh);
  height: max(52px, 11cqh);
  border: 4px solid var(--ink);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--white) 0, var(--card-type) 100%);
  box-shadow: 0 4px 0 var(--ink);
  color: var(--white);
  font-size: max(28px, 6cqh);
}

.pick-name {
  font-size: max(16px, 3cqh);
  line-height: 1.05;
}

.pick-text {
  color: var(--ink);
  font: 500 max(11px, 1.75cqh) / 1.3 var(--body);
}

.pick-warn {
  color: var(--warn-on-paper);
  font: 600 max(10px, 1.55cqh) / 1.25 var(--body);
}

.pick-target {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: auto;
  color: var(--muted-on-paper);
  font: 700 max(10px, 1.55cqh) / 1.2 var(--body);
}

.reroll-btn {
  display: grid;
  place-items: center;
  width: max(52px, 9cqh);
  height: max(44px, 7cqh);
  border: 3px solid var(--ink);
  border-radius: 12px;
  background: var(--gold);
  box-shadow: 0 4px 0 var(--ink);
  color: var(--ink);
  font-size: max(20px, 3.6cqh);
  cursor: pointer;
}

.reroll-btn:hover:not(:disabled) .icon {
  transform: rotate(-40deg);
  transition: transform 0.2s;
}

.reroll-btn:disabled {
  background: var(--paper-alt);
  opacity: 0.7;
  cursor: default;
}

.peek-btn {
  background: var(--rarity-rare);
}

/* ---------------------------------------------------------------- banners (§5.1) */
.banner {
  position: absolute;
  left: 50%;
  top: 40%;
  z-index: 25;
  color: var(--gold);
  font: 400 max(44px, 11cqh) / 1 var(--display);
  letter-spacing: 1px;
  text-shadow: var(--o-lg);
  white-space: nowrap;
  pointer-events: none;
  animation: banner-pop 1.7s cubic-bezier(0.2, 0.9, 0.3, 1.2) forwards;
}

.banner.bad {
  color: var(--accent);
}

.banner.info {
  color: var(--white);
}

.banner.cool {
  color: var(--rarity-rare);
}

@keyframes banner-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.3) rotate(-6deg);
  }

  14% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.12) rotate(2deg);
  }

  24% {
    transform: translate(-50%, -50%) scale(1) rotate(-1deg);
  }

  80% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.04);
  }
}
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/popups.test.tsx`
Expected: PASS, 12 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  50 passed (50)` and `Tests  368 passed (368)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add the dock, the face-off and card-pick popups and banners

ROLL once per dice window (Space on desktop), the waiting pill, the
move caption with totals and the card resolution queue; the face-off
(1-3) and the card pick (rerolls, Peek at the board, 1-3) as centred
popups only for the players involved; banners for my own moments
(spec #2 §5.1, §7.2, §7.3, C11).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Name tags and the match screen

**Files:**
- Create:
  - `apps/client/src/scene/tags.ts`, `apps/client/src/scene/TagProjector.tsx`;
  - `apps/client/src/hud/NameTags.tsx`, `apps/client/src/hud/DevStats.tsx`;
  - `apps/client/src/app/MatchScreen.tsx`, `apps/client/src/app/match.css`;
  - tests: `apps/client/test/support/scripted.ts`, `apps/client/test/tags.test.ts`, `apps/client/test/MatchScreen.test.tsx`.
- Modify:
  - `apps/client/src/scene/quality.ts` (`deviceEnv`), `motion.ts` (`headingOf`), `camera.ts` (overview framing) and `MatchScene.tsx` (the `tags` prop, `deviceEnv`, the camera's start);
  - tests: `apps/client/test/motion.test.ts`, `camera.test.ts` and `scene.test.tsx`.

**Interfaces:**
- Consumes: Tasks 2–9; the Phase 4 scene.
- Produces:
  - `deviceEnv()` and `headingOf(tile)`;
  - `TagRegistry`, `createTagRegistry()`, `TAG_HEIGHT`, `TAG_SIDE`, `START_STAGGER` and `tagAnchor(state, player, seat, now, size)`;
  - `TagProjector`, `NameTags({ seats, me, tags })` and `DevStats`;
  - `MatchScreen({ session, quality, reducedMotion, showStats?, onLeave, onFailed, onFinished })`;
  - `ScriptedMatchmaking` and `ScriptedSession` (test support).

- [ ] **Step 1: Write the failing tests**

Create `apps/client/test/support/scripted.ts`:

```ts
import type { InputErrorCode } from '@laddorious/core';
import { act } from '@testing-library/react';
import { vi } from 'vitest';
import type { Matchmaking, MatchmakingState, MatchSession, MatchUpdate } from '../../src/service/matchService';
import { SEATS } from './fixtures';

/** Matchmaking a component test drives by hand. */
export class ScriptedMatchmaking implements Matchmaking {
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

/** A match session a component test drives by hand: updates, rejections and failures go in through act(). */
export class ScriptedSession implements MatchSession {
  me = 'p0';
  seats = SEATS;
  send = vi.fn();
  playbackDone = vi.fn();
  pause = vi.fn();
  resume = vi.fn();
  leave = vi.fn();
  private updated: ((u: MatchUpdate) => void) | null = null;
  private rejected: ((e: { code: InputErrorCode; message: string }) => void) | null = null;
  private failed: ((e: { message: string }) => void) | null = null;

  onUpdate(cb: (u: MatchUpdate) => void): () => void {
    this.updated = cb;
    return () => {
      if (this.updated === cb) this.updated = null;
    };
  }

  onRejected(cb: (e: { code: InputErrorCode; message: string }) => void): () => void {
    this.rejected = cb;
    return () => {
      if (this.rejected === cb) this.rejected = null;
    };
  }

  onFailed(cb: (e: { message: string }) => void): () => void {
    this.failed = cb;
    return () => {
      if (this.failed === cb) this.failed = null;
    };
  }

  update(u: MatchUpdate): void {
    act(() => this.updated?.(u));
  }

  reject(code: InputErrorCode, message = code): void {
    act(() => this.rejected?.({ code, message }));
  }

  fail(message: string): void {
    act(() => this.failed?.({ message }));
  }
}
```

Create `apps/client/test/tags.test.ts`:

```ts
import type { PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { DirectorState } from '../src/director/director';
import { presentationFromView, type FaceOff } from '../src/director/presentation';
import { STACK_HEIGHT, restPose } from '../src/scene/motion';
import { TAG_HEIGHT, tagAnchor } from '../src/scene/tags';
import { openingUpdate } from './support/fixtures';

function state(positions: Record<PlayerId, number>, arrivals: PlayerId[] = ['p0', 'p1', 'p2', 'p3'], faceOffs: FaceOff[] = []): DirectorState {
  const shown = presentationFromView(openingUpdate().view);
  return { presentation: { ...shown, positions: { ...shown.positions, ...positions }, arrivals, faceOffs }, beat: null, settled: null, log: [] };
}

const anchor = (s: DirectorState, player: PlayerId) => tagAnchor(s, player, Number(player.slice(1)), 0, 100)!;

describe('name tags (spec #2 §7.2)', () => {
  it('hangs a tag above a piece standing alone', () => {
    const s = state({ p2: 9 });
    const [x, y, z] = restPose(s.presentation!, 'p2', 2).position;
    expect(anchor(s, 'p2')).toEqual([x, y + TAG_HEIGHT, z]);
  });

  it('hangs the top piece’s tag above the stack, and puts the one underneath beside it', () => {
    const s = state({ p0: 5, p1: 5 }, ['p1', 'p0', 'p2', 'p3']);
    const top = anchor(s, 'p0');
    const under = anchor(s, 'p1');
    const [x] = restPose(s.presentation!, 'p1', 1).position;
    expect(top[0]).toBeCloseTo(x);
    expect(top[1]).toBeCloseTo(STACK_HEIGHT + TAG_HEIGHT);
    expect(Math.abs(under[0] - x)).toBeGreaterThan(0.5);
    expect(under[1]).toBeLessThan(top[1]);
  });

  it('keeps face-off opponents’ tags above their own pieces', () => {
    const s = state({ p0: 6, p1: 6 }, ['p1', 'p0', 'p2', 'p3'], [{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'] }]);
    for (const p of ['p0', 'p1']) {
      const [x, y, z] = restPose(s.presentation!, p, Number(p.slice(1))).position;
      expect(anchor(s, p)).toEqual([x, y + TAG_HEIGHT, z]);
    }
  });

  it('staggers the tags on the start row, where the pieces stand close together', () => {
    const s = state({});
    const heights = ['p0', 'p1', 'p2', 'p3'].map((p) => anchor(s, p)[1]);
    expect(heights[1]! - heights[0]!).toBeGreaterThan(0.4);
    expect(heights[2]).toBeCloseTo(heights[0]!);
    expect(heights[3]).toBeCloseTo(heights[1]!);
  });

  it('has nothing to show before the first update', () => {
    expect(tagAnchor({ presentation: null, beat: null, settled: null, log: [] }, 'p0', 0, 0, 100)).toBeNull();
  });
});
```

Replace `apps/client/test/motion.test.ts` with:

```ts
import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { BEAT_MS, buildTimeline } from '../src/director/beats';
import type { PlayingBeat } from '../src/director/director';
import { presentationFromView, type PresentationState } from '../src/director/presentation';
import { tileToWorld } from '../src/scene/layout';
import { FACE_OFF_GAP, STACK_HEIGHT, beatPose, projectileAt, restPose } from '../src/scene/motion';
import { openingUpdate } from './support/fixtures';

const SIZE = 100;

function at(positions: Record<PlayerId, number> = {}): PresentationState {
  const shown = presentationFromView(openingUpdate().view);
  return { ...shown, positions: { ...shown.positions, ...positions } };
}

function moved(player: PlayerId, from: number, to: number, cause: MoveCause = 'dice', bounced = false): GameEvent {
  return { type: 'Moved', player, from, to, cause, bounced, visibility: 'public' };
}

/** The one beat these events make, started at time 0. */
function beat(events: GameEvent[], from: PresentationState): PlayingBeat {
  const [only] = buildTimeline(events, from, 'p0', SIZE);
  return { ...only!, startedAt: 0 };
}

function expectNear(actual: number[], expected: number[]) {
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 5));
}

describe('rest poses', () => {
  it('lines the pieces up on the start row, one spot per seat', () => {
    const poses = [0, 1, 2, 3].map((seat) => restPose(at(), `p${seat}`, seat));
    expect(new Set(poses.map((p) => p.position[0])).size).toBe(4);
  });

  it('faces each piece along its row, so the camera sees its profile', () => {
    expect(restPose(at({ p0: 5 }), 'p0', 0).rotation[1]).toBeCloseTo(Math.PI / 2);
    expect(restPose(at({ p0: 15 }), 'p0', 0).rotation[1]).toBeCloseTo(-Math.PI / 2);
    expect(restPose(at(), 'p0', 0).rotation[1]).toBeCloseTo(Math.PI / 2);
  });

  it('stands a later arrival on top of the stack', () => {
    const state = { ...at({ p0: 5, p1: 5 }), arrivals: ['p1', 'p0', 'p2', 'p3'] };
    expect(restPose(state, 'p0', 0).position[1] - restPose(state, 'p1', 1).position[1]).toBeCloseTo(STACK_HEIGHT);
  });

  it('stands face-off opponents side by side, facing each other', () => {
    const state = { ...at({ p0: 6, p1: 6 }), faceOffs: [{ challengeId: 'c1', tile: 6, players: ['p0', 'p1'] }] };
    const left = restPose(state, 'p0', 0);
    const right = restPose(state, 'p1', 1);
    expect(right.position[0] - left.position[0]).toBeCloseTo(FACE_OFF_GAP);
    expect(left.rotation[1]).toBeCloseTo(Math.PI / 2);
    expect(right.rotation[1]).toBeCloseTo(-Math.PI / 2);
  });
});

describe('beat poses (spec #2 §5.1)', () => {
  it('hops tile by tile on a dice move', () => {
    const from = at({ p0: 2 });
    const b = beat([moved('p0', 2, 5)], from);
    expectNear(beatPose(b, from, 'p0', 0, 0, SIZE).position, tileToWorld(2));
    expectNear(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile, SIZE).position, tileToWorld(3));
    expect(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile * 1.5, SIZE).position[1]).toBeGreaterThan(0.3);
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, tileToWorld(5));
  });

  it('walks a bounce up to the last tile and back', () => {
    const from = at({ p0: 97 });
    const b = beat([moved('p0', 97, 98, 'dice', true)], from);
    expectNear(beatPose(b, from, 'p0', 0, BEAT_MS.hopPerTile * 3, SIZE).position, tileToWorld(100));
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, tileToWorld(98));
  });

  it('rides a slide as an orb and pops out at the tail', () => {
    const from = at({ p0: 47 });
    const b = beat([moved('p0', 47, 26, 'snake')], from);
    expect(beatPose(b, from, 'p0', 0, b.durationMs / 2, SIZE).orb).toBe(true);
    const end = beatPose(b, from, 'p0', 0, b.durationMs, SIZE);
    expect(end.orb).toBe(false);
    expectNear(end.position, tileToWorld(26));
    expectNear(end.scale, [1, 1, 1]);
  });

  it('arcs a launch above both ends and lands on the ladder top', () => {
    const from = at({ p0: 4 });
    const b = beat([moved('p0', 4, 14, 'ladder')], from);
    expect(beatPose(b, from, 'p0', 0, b.durationMs / 2, SIZE).position[1]).toBeGreaterThan(1);
    expectNear(beatPose(b, from, 'p0', 0, b.durationMs, SIZE).position, tileToWorld(14));
  });

  it('eases a piece the beat does not move from its old spot to its new one', () => {
    const from = { ...at({ p0: 6, p1: 6 }), arrivals: ['p0', 'p1', 'p2', 'p3'] };
    const b = beat([{ type: 'ChallengeStarted', challengeId: 'c1', tile: 6, players: ['p0', 'p1'], kind: 'rps', theme: null, visibility: 'public' }], from);
    expectNear(beatPose(b, from, 'p1', 1, 0, SIZE).position, restPose(from, 'p1', 1).position);
    expectNear(beatPose(b, from, 'p1', 1, b.durationMs, SIZE).position, restPose(b.after, 'p1', 1).position);
  });

  it("throws a card's projectile from the caster to its target, never at the caster itself", () => {
    const from = at({ p0: 10, p1: 20 });
    const card: GameEvent = { type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p0', result: 'hit', visibility: 'public' };
    const b = beat([card], from);
    const seatOf = (id: PlayerId) => Number(id.slice(1));
    const start = projectileAt(b, from, seatOf, 0)!;
    expect(start[0]).toBeCloseTo(tileToWorld(20)[0]);
    expect(start[2]).toBeCloseTo(tileToWorld(20)[2]);
    expect(projectileAt(b, from, seatOf, b.durationMs * 0.25)![1]).toBeGreaterThan(1.5);
    expect(projectileAt(b, from, seatOf, b.durationMs * 0.6)).toBeNull();
    expect(projectileAt({ ...b, events: [{ ...card, target: 'p1' }] }, from, seatOf, 0)).toBeNull();
  });
});
```

Replace `apps/client/test/camera.test.ts` with:

```ts
import type { GameEvent, MoveCause, PlayerId } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import type { Beat } from '../src/director/beats';
import { presentationFromView } from '../src/director/presentation';
import { cameraShot, type ShotInput } from '../src/scene/camera';
import type { Vec3 } from '../src/scene/layout';
import { openingUpdate } from './support/fixtures';

const SPOTS: Record<PlayerId, Vec3> = { p0: [1, 0, 1], p1: [5, 0, -3], p2: [-4, 0, 2], p3: [0, 0, -6] };
const after = presentationFromView(openingUpdate().view);
const beatOf = (kind: Beat['kind'], events: GameEvent[]): Beat => ({ kind, durationMs: 1000, events, after });
const moved = (player: PlayerId, cause: MoveCause = 'dice'): GameEvent => ({ type: 'Moved', player, from: 1, to: 9, cause, bounced: false, visibility: 'public' });

function shot(over: Partial<ShotInput> = {}) {
  return cameraShot({ beat: null, window: 'dice', myPick: false, me: 'p0', watch: null, piece: (id) => SPOTS[id]!, reducedMotion: false, nowMs: 0, ...over });
}

describe('camera rules (spec #2 §5.3)', () => {
  it('shows the whole board while everyone rolls, framed a little toward the start row so the dock never hides it', () => {
    expect(shot()).toMatchObject({ mode: 'overview', target: [0, 0, 2.5], position: [0, 22, 24.5] });
  });

  it('drifts gently over the overview, and holds still with reduced motion', () => {
    expect(shot({ nowMs: 4000 }).position).not.toEqual(shot({ nowMs: 0 }).position);
    expect(shot({ nowMs: 4000, reducedMotion: true }).position).toEqual(shot({ nowMs: 0, reducedMotion: true }).position);
  });

  it('follows my piece while another piece moves', () => {
    expect(shot({ beat: beatOf('move', [moved('p1')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p0 });
  });

  it('follows my piece through a face-off window I am not in', () => {
    expect(shot({ window: 'challenge' })).toMatchObject({ mode: 'follow', target: SPOTS.p0 });
  });

  it("swoops in for my own slide or launch, but not for anyone else's", () => {
    expect(shot({ beat: beatOf('slide', [moved('p0', 'snake')]) }).mode).toBe('swoop');
    expect(shot({ beat: beatOf('launch', [moved('p0', 'ladder')]) }).mode).toBe('swoop');
    expect(shot({ beat: beatOf('slide', [moved('p2', 'snake')]) }).mode).toBe('follow');
  });

  it('swoops in for a face-off I am in', () => {
    const started: GameEvent = { type: 'ChallengeStarted', challengeId: 'c1', tile: 9, players: ['p0', 'p3'], kind: 'rps', theme: null, visibility: 'public' };
    expect(shot({ beat: beatOf('faceOff', [started]) }).mode).toBe('swoop');
  });

  it('swoops in for a card aimed at me', () => {
    const card: GameEvent = { type: 'CardResolved', caster: 'p1', cardId: 'shove', target: 'p0', result: 'hit', visibility: 'public' };
    expect(shot({ beat: beatOf('cardResolved', [card]) }).mode).toBe('swoop');
  });

  it('swoops in for my Mystery pick', () => {
    expect(shot({ window: 'mystery', myPick: true }).mode).toBe('swoop');
  });

  it('follows the watched piece instead of mine', () => {
    expect(shot({ watch: 'p2', beat: beatOf('slide', [moved('p0', 'snake')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p2 });
  });

  it('cuts instead of swooping with reduced motion', () => {
    expect(shot({ window: 'mystery', myPick: true, reducedMotion: true })).toMatchObject({ mode: 'swoop', cut: true });
  });

  it('swoops onto my win, and follows anyone else who wins', () => {
    const won = (winner: PlayerId): GameEvent => ({ type: 'MatchWon', winner, rankings: [], visibility: 'public' });
    expect(shot({ beat: beatOf('victory', [won('p0')]) })).toMatchObject({ mode: 'swoop', target: SPOTS.p0 });
    expect(shot({ beat: beatOf('victory', [won('p3')]) })).toMatchObject({ mode: 'follow', target: SPOTS.p3 });
  });
});
```

Replace `apps/client/test/scene.test.tsx` with:

```tsx
import type { Jump } from '@laddorious/core';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { InstancedMesh, Mesh, Vector3, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { Director } from '../src/director/director';
import { ribbonGeometry } from '../src/scene/Jumps';
import { SceneContent } from '../src/scene/MatchScene';
import type { QualityLevel } from '../src/scene/quality';
import { createTagRegistry } from '../src/scene/tags';
import { SEATS, openingUpdate } from './support/fixtures';

// The test renderer drives React through act(); React wants to know it is running in a test.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** Draw calls and triangles the scene asks for: shadow casters draw twice when shadows are on. */
function budget(root: Object3D, shadows: boolean): { calls: number; triangles: number } {
  let calls = 0;
  let triangles = 0;
  root.traverseVisible((node) => {
    if (!(node instanceof Mesh)) return;
    const geometry = node.geometry as BufferGeometry;
    const each = (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;
    const copies = node instanceof InstancedMesh ? node.count : 1;
    const passes = shadows && node.castShadow ? 2 : 1;
    calls += passes;
    triangles += each * copies * passes;
  });
  return { calls, triangles };
}

/** Render the opening of a match, on the fixture board or with these jumps instead. */
async function renderScene(level: QualityLevel, jumps?: Jump[]) {
  const director = new Director('p0', () => {});
  const opening = openingUpdate();
  director.push(jumps ? { ...opening, view: { ...opening.view, board: { ...opening.view.board, jumps } } } : opening);
  const board = director.store.getState().settled!.view.board;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneContent director={director} seats={SEATS} me="p0" board={board} level={level} watch={null} reducedMotion={false} />,
  );
  await renderer.advanceFrames(2, 1 / 60);
  return renderer.scene.instance as Object3D;
}

describe('the 3D scene (spec #2 §6)', () => {
  it('lays slide ribbons face up, so the light falls on them', () => {
    const ribbon = ribbonGeometry([new Vector3(0, 0, 0), new Vector3(1, 0, 0), new Vector3(2, 0, 1), new Vector3(2, 0, 3)], 0.6, 0.02);
    const pos = ribbon.getAttribute('position');
    const index = ribbon.index!;
    const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()];
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(pos, index.getX(i));
      b.fromBufferAttribute(pos, index.getX(i + 1));
      c.fromBufferAttribute(pos, index.getX(i + 2));
      expect(b.sub(a).cross(c.sub(a)).y).toBeGreaterThan(0);
    }
  });

  it('moves each name tag over its piece on screen (spec #2 §7.2)', async () => {
    const director = new Director('p0', () => {});
    director.push(openingUpdate());
    const board = director.store.getState().settled!.view.board;
    const tags = createTagRegistry();
    const fakes = SEATS.map((seat) => {
      const el = { style: {} as Record<string, string> };
      tags.elements.set(seat.playerId, el as unknown as HTMLElement);
      return el;
    });
    const renderer = await ReactThreeTestRenderer.create(
      <SceneContent director={director} seats={SEATS} me="p0" board={board} level="low" watch={null} reducedMotion tags={tags} />,
      { camera: { position: [0, 20, 21] } },
    );
    await renderer.advanceFrames(2, 1 / 60);
    for (const el of fakes) {
      expect(el.style.visibility).toBe('visible');
      expect(el.style.transform).toMatch(/^translate\(-?\d+(\.\d+)?px, -?\d+(\.\d+)?px\)$/);
    }
    // The four start spots stand side by side, and so do their tags.
    expect(new Set(fakes.map((el) => el.style.transform)).size).toBe(4);
  });

  it('draws the 100 tiles in one instanced draw call', async () => {
    const tiles = (await renderScene('high')).getObjectByName('tiles');
    expect(tiles).toBeInstanceOf(InstancedMesh);
    expect((tiles as InstancedMesh).count).toBe(100);
  });

  it.each(['high', 'low'] as const)('stays inside the phone budget on %s: at most 100 draw calls and 150k triangles', async (level) => {
    const { calls, triangles } = budget(await renderScene(level), level === 'high');
    expect(calls).toBeLessThanOrEqual(100);
    expect(triangles).toBeLessThanOrEqual(150_000);
  });

  it('stays inside the budget on a board crowded with 60 long slides and pads', async () => {
    const jumps = Array.from({ length: 30 }, (_, i): Jump[] => [
      { id: `s${i}`, from: 99 - i, to: 2 + i },
      { id: `l${i}`, from: 3 + i, to: 97 - i },
    ]).flat();
    const { calls, triangles } = budget(await renderScene('high', jumps), true);
    expect(calls).toBeLessThanOrEqual(100);
    expect(triangles).toBeLessThanOrEqual(150_000);
  });
});
```

Create `apps/client/test/MatchScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { PlayerView, PublicChallenge } from '@laddorious/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchScreen } from '../src/app/MatchScreen';
import { BEAT_MS } from '../src/director/beats';
import type { MatchUpdate } from '../src/service/matchService';
import { openingUpdate } from './support/fixtures';
import { ScriptedSession } from './support/scripted';

// jsdom has no WebGL: stand the 3D scene in with a labelled box that shows whose piece the camera follows.
vi.mock('../src/scene/MatchScene', async () => {
  const { createElement } = await import('react');
  return {
    MatchScene: ({ watch, setting }: { watch: string | null; setting: string }) =>
      createElement('div', { role: 'img', 'aria-label': `3D board, ${setting}, watching ${watch ?? 'my piece'}` }),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function opening(change: Partial<PlayerView> = {}, timer: MatchUpdate['timer'] = null): MatchUpdate {
  const u = openingUpdate();
  return { ...u, view: { ...u.view, ...change }, timer };
}

function start(props: { onLeave?: () => void; onFailed?: (m: string) => void; onFinished?: (r: unknown) => void } = {}) {
  const session = new ScriptedSession();
  render(
    <MatchScreen
      session={session}
      quality="auto"
      reducedMotion={false}
      onLeave={props.onLeave ?? (() => {})}
      onFailed={props.onFailed ?? (() => {})}
      onFinished={props.onFinished ?? (() => {})}
    />,
  );
  return session;
}

describe('MatchScreen (spec #2 §7.1, §7.2)', () => {
  it('shows the round, its countdown and my ROLL, and rolls', () => {
    const session = start();
    session.update(opening({}, { windowId: 1, endsAt: 12_000 }));
    expect(screen.getByText('ROUND').textContent).toBe('ROUND 1');
    expect(screen.getByRole('timer', { name: '12 seconds left' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ROLL' }));
    expect(session.send).toHaveBeenCalledWith({ type: 'roll' });
    expect(session.playbackDone).not.toHaveBeenCalled();
  });

  it('reports playback done for the window an update opens', () => {
    const session = start();
    session.update(opening());
    expect(session.playbackDone).toHaveBeenCalledWith(1);
  });

  it('opens the face-off for its players and sends the pick', () => {
    const session = start();
    const challenge: PublicChallenge = { id: 'c4', tile: 23, participants: ['p0', 'p1'], contesting: ['p0', 'p1'], kind: 'rps', theme: null, pickRound: 1, picked: [], winner: null };
    session.update(opening({ phase: { kind: 'settle', challenges: [challenge] }, awaiting: { windowId: 4, window: 'challenge', players: ['p0', 'p1'], durationMs: 8_000 } }));
    fireEvent.click(screen.getByRole('button', { name: /Scissors/ }));
    expect(session.send).toHaveBeenCalledWith({ type: 'challengePick', challengeId: 'c4', choice: 'scissors' });
  });

  it('opens the card pick for the offer’s owner and sends rerolls and the pick', () => {
    const session = start();
    session.update(
      opening({
        phase: { kind: 'mysterySelect', picked: { p0: false } },
        myOffer: { player: 'p0', tile: 9, rarity: 'rare', cards: ['aegis', 'sprint', 'jackpot'], rerolled: [false, false, false], rerollsUsed: 0, picked: null, autoPicked: false },
        awaiting: { windowId: 7, window: 'mystery', players: ['p0'], durationMs: 15_000 },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reroll Jackpot' }));
    expect(session.send).toHaveBeenCalledWith({ type: 'reroll', slot: 2 });
    fireEvent.click(screen.getByRole('button', { name: /^Sprint/ }));
    expect(session.send).toHaveBeenCalledWith({ type: 'pickCard', slot: 1 });
  });

  it('toasts a rejected action', () => {
    const session = start();
    session.update(opening());
    session.reject('STALE_INPUT');
    expect(screen.getByText('Too late, that window closed').getAttribute('role')).toBe('status');
  });

  it('watches another piece from the player column, and comes back to mine', () => {
    const session = start();
    session.update(opening());
    fireEvent.click(screen.getByRole('button', { name: /^Mochi,/ }));
    expect(screen.getByRole('img', { name: '3D board, auto, watching p1' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to my piece' }));
    expect(screen.getByRole('img', { name: '3D board, auto, watching my piece' })).toBeTruthy();
  });

  it('leaves through the leave dialog, which can also be closed', () => {
    const onLeave = vi.fn();
    const session = start({ onLeave });
    session.update(opening());
    fireEvent.click(screen.getByRole('button', { name: 'Leave match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(screen.queryByRole('dialog', { name: 'Leave match?' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Leave match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('reports a failed match', () => {
    const onFailed = vi.fn();
    const session = start({ onFailed });
    session.fail('board corrupted');
    expect(onFailed).toHaveBeenCalledWith('board corrupted');
  });

  it('hands the final rankings over once the victory has played', () => {
    const onFinished = vi.fn();
    const session = start({ onFinished });
    const rankings = [
      { player: 'p2', rank: 1, position: 100 },
      { player: 'p0', rank: 2, position: 87 },
      { player: 'p3', rank: 3, position: 60 },
      { player: 'p1', rank: 4, position: 41 },
    ];
    const { view } = openingUpdate();
    session.update({
      view: { ...view, round: 21, phase: { kind: 'finished', winner: 'p2', rankings }, awaiting: { windowId: 60, window: 'none', players: [], durationMs: 0 } },
      events: [{ type: 'MatchWon', winner: 'p2', rankings, visibility: 'public' }],
      timer: null,
    });
    expect(screen.getByText('PIP WINS!')).toBeTruthy();
    act(() => vi.advanceTimersByTime(BEAT_MS.victory - 1));
    expect(onFinished).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onFinished).toHaveBeenCalledWith(rankings);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/tags.test.ts apps/client/test/motion.test.ts apps/client/test/camera.test.ts apps/client/test/scene.test.tsx apps/client/test/MatchScreen.test.tsx`

Expected:
- `tags.test.ts` and `scene.test.tsx`: FAIL with `Cannot find module '../src/scene/tags'`.
- `MatchScreen.test.tsx`: FAIL with `Failed to resolve import "../src/app/MatchScreen"`.
- `motion.test.ts`: FAIL in "faces each piece along its row, so the camera sees its profile".
- `camera.test.ts`: FAIL in the overview test, because the framing moves toward the start row.

- [ ] **Step 3: Build the tags and the match screen**

Replace `apps/client/src/scene/quality.ts` with:

```ts
export type QualitySetting = 'auto' | 'low' | 'high';
export type QualityLevel = 'low' | 'high';

export interface QualityProfile {
  shadows: boolean;
  /** Pixel density cap. */
  dpr: number;
  antialias: boolean;
  clouds: number;
}

/** Spec #2 §6.4. */
export const QUALITY: Record<QualityLevel, QualityProfile> = {
  high: { shadows: true, dpr: 2, antialias: true, clouds: 8 },
  low: { shadows: false, dpr: 1.5, antialias: false, clouds: 4 },
};

/** Auto starts Low on phones (a coarse pointer and a short screen side under 500 px) and High elsewhere. */
export function autoStartLevel(env: { coarsePointer: boolean; shortSide: number }): QualityLevel {
  return env.coarsePointer && env.shortSide < 500 ? 'low' : 'high';
}

/** What Auto looks at: a coarse pointer and the screen's short side (spec #2 §6.4). */
export function deviceEnv(): { coarsePointer: boolean; shortSide: number } {
  const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const shortSide = typeof screen === 'undefined' ? 1000 : Math.min(screen.width, screen.height);
  return { coarsePointer, shortSide };
}

export function startLevel(setting: QualitySetting, env: { coarsePointer: boolean; shortSide: number }): QualityLevel {
  return setting === 'auto' ? autoStartLevel(env) : setting;
}

/** Auto's step-down (spec #2 §6.4): true, once, when the frame rate has averaged under `minFps` for `windowMs`. */
export class FrameRateWatch {
  private readonly frames: number[] = [];
  private total = 0;
  private fired = false;

  constructor(
    private readonly windowMs = 5000,
    private readonly minFps = 45,
  ) {}

  /** Feed one frame's length in ms. Stalls over 250 ms (a hidden tab, a long pause) don't count. */
  add(deltaMs: number): boolean {
    if (this.fired || deltaMs > 250) return false;
    this.frames.push(deltaMs);
    this.total += deltaMs;
    while (this.frames.length > 1 && this.total - this.frames[0]! >= this.windowMs) this.total -= this.frames.shift()!;
    if (this.total < this.windowMs) return false;
    if (this.frames.length / (this.total / 1000) >= this.minFps) return false;
    this.fired = true;
    return true;
  }
}
```

Replace `apps/client/src/scene/motion.ts` with:

```ts
import type { GameEvent, PlayerId } from '@laddorious/core';
import { BEAT_MS } from '../director/beats';
import type { DirectorState, PlayingBeat } from '../director/director';
import { stackOn, type PresentationState } from '../director/presentation';
import { arcPoint, slideCurve, tileCell, tilePath, tileToWorld, type Vec3 } from './layout';

/** Where a piece is and how it is turned and squashed. `orb` swaps the piece for a glowing orb (inside a slide). */
export interface Pose {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  orb: boolean;
}

/** How far a stacked piece rises, and how far apart face-off opponents stand (world units). */
export const STACK_HEIGHT = 1.05;
export const FACE_OFF_GAP = 0.85;
const HOP_HEIGHT = 0.55;
const STEP_HEIGHT = 0.15;

type MovedEvent = Extract<GameEvent, { type: 'Moved' }>;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeOutBack = (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const still = (position: Vec3, rotation: Vec3 = [0, 0, 0]): Pose => ({ position, rotation, scale: [1, 1, 1], orb: false });

/** Where a piece stands between beats: on its tile, on top of earlier arrivals, or side by side facing its opponents in a face-off. */
/**
 * Pieces face along their row, the way the serpentine runs (+X on even rows, −X on odd ones):
 * the camera looks along −Z, so it sees their profiles, which is how a knight reads (Phase 5).
 */
export function headingOf(tile: number): number {
  return tile <= 0 || tileCell(tile).row % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
}

export function restPose(state: PresentationState, player: PlayerId, seat: number): Pose {
  const tile = state.positions[player] ?? 0;
  const at = tileToWorld(tile, seat);
  const facing: Vec3 = [0, headingOf(tile), 0];
  if (tile === 0) return still(at, facing);
  const faceOff = state.faceOffs.find((f) => f.tile === tile && f.players.includes(player));
  if (faceOff) {
    const offset = (faceOff.players.indexOf(player) - (faceOff.players.length - 1) / 2) * FACE_OFF_GAP;
    return still([at[0] + offset, at[1], at[2]], [0, offset < 0 ? Math.PI / 2 : -Math.PI / 2, 0]);
  }
  const level = Math.max(0, stackOn(state, tile).indexOf(player));
  return still([at[0], at[1] + level * STACK_HEIGHT, at[2]], facing);
}

/**
 * A piece's pose `nowMs` into a beat (spec #2 §5.1). Pieces the beat moves hop, slide,
 * launch, fly back or leap; others ease from their old spot to their new one.
 */
export function beatPose(beat: PlayingBeat, from: PresentationState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Pose {
  const elapsed = Math.max(0, nowMs - beat.startedAt);
  const t = beat.durationMs > 0 ? clamp01(elapsed / beat.durationMs) : 1;
  const start = restPose(from, player, seat);
  const end = restPose(beat.after, player, seat);
  const move = beat.events.find((e): e is MovedEvent => e.type === 'Moved' && e.player === player);
  if (move) {
    switch (beat.kind) {
      case 'move':
        return hops(move, start, end, elapsed, BEAT_MS.hopPerTile, HOP_HEIGHT, boardSize, true);
      case 'stepBack':
        return hops(move, start, end, elapsed, BEAT_MS.stepBackPerTile, STEP_HEIGHT, boardSize, false);
      case 'slide':
        return slide(move, end, t);
      case 'launch':
        return flight(start, end, t, 1.6 + reach(start, end) * 0.22, -1);
      case 'knockback':
        return flight(start, end, t, 1.3, 1);
      case 'cardMove':
        return flight(start, end, t, 0.9 + reach(start, end) * 0.08, 0);
    }
  }
  if (beat.kind === 'victory' && beat.events.some((e) => e.type === 'MatchWon' && e.winner === player)) {
    return { ...end, position: [end.position[0], end.position[1] + Math.abs(Math.sin(t * Math.PI * 3)) * 0.9, end.position[2]], rotation: [0, t * Math.PI * 4, 0] };
  }
  if (beat.kind === 'cardResolved' && beat.events.some((e) => e.type === 'CardResolved' && e.target === player && e.result === 'hit')) {
    return { ...start, position: [start.position[0], start.position[1] + Math.sin(t * Math.PI) * 0.35, start.position[2]] };
  }
  const k = easeInOut(t);
  return { ...end, position: lerp3(start.position, end.position, k), rotation: lerp3(start.rotation, end.rotation, k) };
}

/** Tile-by-tile hops: each tile takes `perTile` ms, then dice moves land with a squash. */
function hops(move: MovedEvent, start: Pose, end: Pose, elapsed: number, perTile: number, height: number, boardSize: number, squash: boolean): Pose {
  const path = tilePath(move.from, move.to, move.bounced, boardSize);
  const legs = path.length - 1;
  const leg = Math.floor(elapsed / perTile);
  if (legs <= 0 || leg >= legs) {
    const since = elapsed - legs * perTile;
    const s = squash && since < BEAT_MS.landing ? 1 - 0.18 * Math.sin((since / BEAT_MS.landing) * Math.PI) : 1;
    return { ...end, scale: [2 - s, s, 2 - s] };
  }
  const f = (elapsed - leg * perTile) / perTile;
  const a = leg === 0 ? start.position : tileToWorld(path[leg]!);
  const b = leg + 1 === legs ? end.position : tileToWorld(path[leg + 1]!);
  const stretch = 1 + 0.12 * Math.sin(f * Math.PI);
  const across = 1 / Math.sqrt(stretch);
  return {
    position: [lerp(a[0], b[0], f), lerp(a[1], b[1], f) + height * 4 * f * (1 - f), lerp(a[2], b[2], f)],
    rotation: end.rotation,
    scale: [across, stretch, across],
    orb: false,
  };
}

/** The vacuum: sucked into the head, an orb rides the chute, the piece pops out at the tail. */
function slide(move: MovedEvent, end: Pose, t: number): Pose {
  const curve = slideCurve(move.from, move.to);
  if (t < 0.2) {
    const k = t / 0.2;
    const head = curve.getPoint(0);
    const s = 1 - 0.9 * k;
    return { position: [head.x, head.y, head.z], rotation: [0, k * Math.PI * 4, 0], scale: [s, s, s], orb: false };
  }
  if (t < 0.85) {
    const p = curve.getPoint((t - 0.2) / 0.65);
    return { position: [p.x, p.y + 0.25, p.z], rotation: [0, 0, 0], scale: [1, 1, 1], orb: true };
  }
  const s = 0.1 + 0.9 * easeOutBack((t - 0.85) / 0.15);
  return { ...end, scale: [s, s, s] };
}

/** One arc through the air: launch pads somersault forward (flip −1), knockbacks backflip (+1), card leaps don't flip. */
function flight(start: Pose, end: Pose, t: number, height: number, flip: number): Pose {
  const k = easeInOut(t);
  return { position: arcPoint(start.position, end.position, k, height), rotation: [flip * Math.PI * 2 * k, end.rotation[1], 0], scale: [1, 1, 1], orb: false };
}

const reach = (a: Pose, b: Pose) => Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]);

/** A card's projectile (spec #2 §5.1): it arcs from the caster to its target over the first half of the beat. */
export function projectileAt(beat: PlayingBeat, from: PresentationState, seatOf: (player: PlayerId) => number, nowMs: number): Vec3 | null {
  if (beat.kind !== 'cardResolved') return null;
  const card = beat.events.find((e) => e.type === 'CardResolved');
  if (card?.type !== 'CardResolved' || card.target === null || card.target === card.caster) return null;
  const t = clamp01((nowMs - beat.startedAt) / (beat.durationMs / 2));
  if (t >= 1) return null;
  const a = restPose(from, card.caster, seatOf(card.caster)).position;
  const b = restPose(from, card.target, seatOf(card.target)).position;
  return arcPoint([a[0], a[1] + 1, a[2]], [b[0], b[1] + 1, b[2]], easeInOut(t), 1.5);
}

/** A piece's pose right now, from the director's state. */
export function poseAt(state: DirectorState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Pose | null {
  if (!state.presentation) return null;
  return state.beat ? beatPose(state.beat, state.presentation, player, seat, nowMs, boardSize) : restPose(state.presentation, player, seat);
}

/** Idle bob and sway (spec #2 §6.2); the scene leaves it off with reduced motion. */
export function withIdle(pose: Pose, nowMs: number, phase: number): Pose {
  return {
    ...pose,
    position: [pose.position[0], pose.position[1] + 0.035 * (1 + Math.sin(nowMs / 520 + phase)), pose.position[2]],
    rotation: [pose.rotation[0], pose.rotation[1], pose.rotation[2] + 0.045 * Math.sin(nowMs / 830 + phase)],
  };
}
```

Replace `apps/client/src/scene/camera.ts` with:

```ts
import type { PlayerId, WindowKind } from '@laddorious/core';
import type { Beat } from '../director/beats';
import type { Vec3 } from './layout';

export type ShotMode = 'overview' | 'follow' | 'swoop';

export interface Shot {
  mode: ShotMode;
  position: Vec3;
  target: Vec3;
  /** Jump straight there instead of easing (reduced motion). */
  cut: boolean;
}

export interface ShotInput {
  /** The beat on stage. */
  beat: Beat | null;
  /** The settled window, or null before the first update. */
  window: WindowKind | null;
  /** My own Mystery pick is open. */
  myPick: boolean;
  me: PlayerId;
  /** Watch mode: follow this piece instead of mine (spec #2 §5.3). */
  watch: PlayerId | null;
  /** A piece's world position right now. */
  piece: (player: PlayerId) => Vec3;
  reducedMotion: boolean;
  nowMs: number;
}

const FOLLOW: Vec3 = [0, 7.5, 8.5];
const SWOOP: Vec3 = [0, 3.4, 4.6];
const OVERVIEW_RADIUS = 22;
const OVERVIEW_HEIGHT = 22;
/** The overview looks a little toward the start row, so the bottom dock never hides it (Phase 5). */
const OVERVIEW_TARGET_Z = 2.5;

const offset = (at: Vec3, by: Vec3): Vec3 => [at[0] + by[0], at[1] + by[1], at[2] + by[2]];
const follow = (at: Vec3): Shot => ({ mode: 'follow', position: offset(at, FOLLOW), target: at, cut: false });

/** The camera rules of spec #2 §5.3. */
export function cameraShot(input: ShotInput): Shot {
  const { beat, me } = input;
  const won = beat?.kind === 'victory' ? beat.events.find((e) => e.type === 'MatchWon') : undefined;
  if (won?.type === 'MatchWon') return won.winner === me ? swoop(input.piece(me), input) : follow(input.piece(won.winner));
  if (input.watch) return follow(input.piece(input.watch));
  const mine = input.piece(me);
  if (isMyMoment(input)) return swoop(mine, input);
  const busy = beat !== null && beat.kind !== 'roll' && beat.kind !== 'info';
  if (busy || input.window === 'challenge' || input.window === 'mystery') return follow(mine);
  // Everyone rolls: the whole board, drifting gently.
  const angle = input.reducedMotion ? 0 : Math.sin(input.nowMs / 9000) * 0.12;
  return {
    mode: 'overview',
    position: [Math.sin(angle) * OVERVIEW_RADIUS, OVERVIEW_HEIGHT, Math.cos(angle) * OVERVIEW_RADIUS + OVERVIEW_TARGET_Z],
    target: [0, 0, OVERVIEW_TARGET_Z],
    cut: false,
  };
}

function swoop(at: Vec3, input: ShotInput): Shot {
  return { mode: 'swoop', position: offset(at, SWOOP), target: at, cut: input.reducedMotion };
}

/** Swoops are only for your own moments: your collision, your slide or launch, a card aimed at you, your Mystery pick. */
function isMyMoment({ beat, me, myPick, window }: ShotInput): boolean {
  if (myPick && window === 'mystery') return true;
  return (
    beat?.events.some(
      (e) =>
        (e.type === 'ChallengeStarted' && e.players.includes(me)) ||
        (e.type === 'Moved' && e.player === me && (e.cause === 'snake' || e.cause === 'ladder')) ||
        (e.type === 'CardResolved' && e.target === me),
    ) ?? false
  );
}
```

Create `apps/client/src/scene/tags.ts`:

```ts
import type { PlayerId } from '@laddorious/core';
import type { DirectorState } from '../director/director';
import { stackOn } from '../director/presentation';
import type { Vec3 } from './layout';
import { STACK_HEIGHT, poseAt } from './motion';

// In-world name tags (spec #2 §7.2): DOM elements over the canvas, moved every frame to
// their piece's place on screen, without re-rendering React.

/** How far above a piece's feet its tag hangs: pieces stand about 1.3 units tall. */
export const TAG_HEIGHT = 1.6;
/** How far beside a stack a piece underneath shows its tag. */
export const TAG_SIDE = 1.1;
/** On the start row the pieces stand close together: every other tag hangs this much higher. */
export const START_STAGGER = 0.55;

/** The tags' DOM elements by player: the HUD registers them, the scene moves them. */
export interface TagRegistry {
  elements: Map<PlayerId, HTMLElement>;
}

export function createTagRegistry(): TagRegistry {
  return { elements: new Map() };
}

/**
 * Where a piece's tag hangs in the world: above the piece, or beside the stack for a piece
 * standing under another one (face-off opponents stand apart, so theirs stay above).
 */
export function tagAnchor(state: DirectorState, player: PlayerId, seat: number, nowMs: number, boardSize: number): Vec3 | null {
  const shown = state.presentation;
  const pose = poseAt(state, player, seat, nowMs, boardSize);
  if (!shown || !pose) return null;
  const [x, y, z] = pose.position;
  const moving = state.beat?.events.some((e) => e.type === 'Moved' && e.player === player) ?? false;
  const tile = shown.positions[player] ?? 0;
  if (!moving && tile > 0 && !shown.faceOffs.some((f) => f.tile === tile && f.players.includes(player))) {
    const stack = stackOn(shown, tile);
    const level = stack.indexOf(player);
    if (level >= 0 && level < stack.length - 1) return [x + (level % 2 === 0 ? -TAG_SIDE : TAG_SIDE), y + STACK_HEIGHT * 0.55, z];
  }
  const stagger = tile === 0 && !moving && seat % 2 === 1 ? START_STAGGER : 0;
  return [x, y + TAG_HEIGHT + stagger, z];
}
```

Create `apps/client/src/scene/TagProjector.tsx`:

```tsx
import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { tagAnchor, type TagRegistry } from './tags';

/** Moves each registered name tag to its piece's place on screen, once per frame (spec #2 §7.2). */
export function TagProjector({ director, seats, boardSize, tags }: { director: Director; seats: SeatInfo[]; boardSize: number; tags: TagRegistry }) {
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const state = director.store.getState();
    const now = Date.now();
    seats.forEach((seat, index) => {
      const el = tags.elements.get(seat.playerId);
      if (!el) return;
      const at = tagAnchor(state, seat.playerId, index, now, boardSize);
      if (at) point.set(...at).project(camera);
      if (!at || point.z > 1) {
        el.style.visibility = 'hidden';
        return;
      }
      el.style.visibility = 'visible';
      el.style.transform = `translate(${(((point.x + 1) / 2) * size.width).toFixed(1)}px, ${(((1 - point.y) / 2) * size.height).toFixed(1)}px)`;
    });
  });
  return null;
}
```

Replace `apps/client/src/scene/MatchScene.tsx` with:

```tsx
import type { PlayerId, PlayerView } from '@laddorious/core';
import { Canvas } from '@react-three/fiber';
import { useCallback, useState } from 'react';
import { useStore } from 'zustand';
import type { Director } from '../director/director';
import type { SeatInfo } from '../service/matchService';
import { Board } from './Board';
import { CameraRig } from './CameraRig';
import { Jumps } from './Jumps';
import { Pieces } from './Pieces';
import { ContextLossWatch, QualityWatch, StatsProbe } from './Probes';
import { QUALITY, deviceEnv, startLevel, type QualityLevel, type QualitySetting } from './quality';
import { Surroundings } from './Surroundings';
import { TagProjector } from './TagProjector';
import type { TagRegistry } from './tags';

export const WEBGL_MESSAGE = "Your browser can't show the 3D board. Try a recent Chrome, Safari or Firefox.";

/** Can this browser draw WebGL? (spec #2 §8) */
export function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
  } catch {
    return false;
  }
}

export interface SceneContentProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  board: PlayerView['board'];
  level: QualityLevel;
  watch: PlayerId | null;
  reducedMotion: boolean;
  /** Name tags to keep over the pieces (spec #2 §7.2). */
  tags?: TagRegistry;
}

/** Everything inside the canvas: the world, the pieces and the camera (spec #2 §6). */
export function SceneContent({ director, seats, me, board, level, watch, reducedMotion, tags }: SceneContentProps) {
  const profile = QUALITY[level];
  return (
    <>
      <Surroundings shadows={profile.shadows} clouds={profile.clouds} />
      <Board board={board} director={director} />
      <Jumps director={director} />
      <Pieces director={director} seats={seats} shadows={profile.shadows} reducedMotion={reducedMotion} boardSize={board.size} />
      <CameraRig director={director} seats={seats} me={me} watch={watch} reducedMotion={reducedMotion} boardSize={board.size} />
      {tags && <TagProjector director={director} seats={seats} boardSize={board.size} tags={tags} />}
    </>
  );
}

export interface MatchSceneProps {
  director: Director;
  seats: SeatInfo[];
  me: PlayerId;
  setting: QualitySetting;
  watch?: PlayerId | null;
  reducedMotion?: boolean;
  showStats?: boolean;
  tags?: TagRegistry;
}

/**
 * The match in 3D. To change the quality setting, remount it with a new `key`:
 * antialiasing is fixed when the WebGL context is made. Auto steps down to Low live.
 */
export function MatchScene({ director, seats, me, setting, watch = null, reducedMotion = false, showStats = false, tags }: MatchSceneProps) {
  const [supported] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [level, setLevel] = useState<QualityLevel>(() => startLevel(setting, deviceEnv()));
  const board = useStore(director.store, (s) => s.settled?.view.board);
  const stepDown = useCallback(() => setLevel('low'), []);
  const loseContext = useCallback(() => setLost(true), []);
  if (!supported || lost) return <p className="webgl-message">{WEBGL_MESSAGE}</p>;
  if (!board) return null;
  const profile = QUALITY[level];
  return (
    <div className="scene-frame">
      {/* 'percentage' is PCF: three 0.186 dropped the soft PCF type R3F would pick for `true`. */}
      <Canvas shadows={profile.shadows ? 'percentage' : false} dpr={[1, profile.dpr]} gl={{ antialias: profile.antialias }} camera={{ fov: 42, near: 0.5, far: 200, position: [0, 22, 24.5] }}>
        <SceneContent director={director} seats={seats} me={me} board={board} level={level} watch={watch} reducedMotion={reducedMotion} tags={tags} />
        {showStats && <StatsProbe />}
        {setting === 'auto' && level === 'high' && <QualityWatch onStepDown={stepDown} />}
        <ContextLossWatch onLost={loseContext} />
      </Canvas>
    </div>
  );
}
```

Create `apps/client/src/hud/NameTags.tsx`:

```tsx
import type { PlayerId } from '@laddorious/core';
import type { CSSProperties } from 'react';
import type { TagRegistry } from '../scene/tags';
import type { SeatInfo } from '../service/matchService';

/**
 * In-world name tags (spec #2 §7.2): one per seat, in the seat colour, mine outlined in mint.
 * They start hidden; the scene's TagProjector places them over the pieces every frame.
 */
export function NameTags({ seats, me, tags }: { seats: readonly SeatInfo[]; me: PlayerId; tags: TagRegistry }) {
  return (
    <div className="tags" aria-hidden="true">
      {seats.map((seat) => (
        <div
          key={seat.playerId}
          ref={(el) => {
            if (el) tags.elements.set(seat.playerId, el);
            else tags.elements.delete(seat.playerId);
          }}
          className={seat.playerId === me ? 'tag me' : 'tag'}
          style={{ '--seat': seat.color, visibility: 'hidden' } as CSSProperties}
        >
          <span className="tag-name display">{seat.nickname}</span>
        </div>
      ))}
    </div>
  );
}
```

Create `apps/client/src/hud/DevStats.tsx`:

```tsx
import { useStore } from 'zustand';
import { renderStats } from '../scene/stats';

/** Frame rate, draw calls and triangles, for dev builds only (spec #2 §6.4). */
export function DevStats() {
  const { fps, calls, triangles } = useStore(renderStats);
  return <p className="dev-stats">{`${fps} fps · ${calls} draw calls · ${(triangles / 1000).toFixed(1)}k triangles`}</p>;
}
```

Create `apps/client/src/app/MatchScreen.tsx`:

```tsx
import type { PlayerId, Ranking } from '@laddorious/core';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { Director } from '../director/director';
import { BannerView, useBanner } from '../hud/Banner';
import { CardPickPopup } from '../hud/CardPickPopup';
import { DevStats } from '../hud/DevStats';
import { Dock } from '../hud/Dock';
import { EventFeed } from '../hud/EventFeed';
import { FaceOffPopup } from '../hud/FaceOffPopup';
import { feedLines } from '../hud/feed';
import { nextRollMods, rejectionText } from '../hud/labels';
import { cardPickModel, countdown, dockModel, faceOffModel, playerRows, stageFromLog, stageIndex } from '../hud/model';
import { NameTags } from '../hud/NameTags';
import { PlayerColumn } from '../hud/PlayerColumn';
import { roundRecord } from '../hud/record';
import { StageBar } from '../hud/StageBar';
import { YourPiece } from '../hud/YourPiece';
import { MatchScene } from '../scene/MatchScene';
import type { QualitySetting } from '../scene/quality';
import { createTagRegistry } from '../scene/tags';
import type { MatchSession } from '../service/matchService';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { ToastHost, showToast } from '../ui/toasts';
import { useHotkeys } from '../ui/useHotkeys';

/** How often the window countdown redraws. */
const TICK_MS = 250;

export interface MatchScreenProps {
  session: MatchSession;
  quality: QualitySetting;
  reducedMotion: boolean;
  /** The dev overlay: fps, draw calls, triangles (dev builds only). */
  showStats?: boolean;
  /** I left through the leave dialog; the session has been left. */
  onLeave: () => void;
  /** The host failed (spec #2 §8): the error screen takes over. */
  onFailed: (message: string) => void;
  /** The victory has played: the end screen takes over. */
  onFinished: (rankings: Ranking[]) => void;
}

/**
 * The match screen (spec #2 §7.1, §7.2): the 3D board with the HUD over it. It plays the
 * session's updates through a Director and sends my rolls, picks and rerolls.
 */
export function MatchScreen({ session, quality, reducedMotion, showStats = false, onLeave, onFailed, onFinished }: MatchScreenProps) {
  const { me, seats } = session;
  const [director] = useState(() => new Director(me, (windowId) => session.playbackDone(windowId)));
  const [tags] = useState(createTagRegistry);
  const [watch, setWatch] = useState<PlayerId | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const handlersRef = useRef({ onFailed, onFinished });
  useLayoutEffect(() => {
    handlersRef.current = { onFailed, onFinished };
  });

  useEffect(() => {
    const offs = [
      session.onUpdate((u) => director.push(u)),
      session.onRejected((e) => showToast(rejectionText(e.code))),
      session.onFailed((e) => handlersRef.current.onFailed(e.message)),
    ];
    return () => {
      for (const off of offs) off();
      director.dispose();
    };
  }, [session, director]);

  const settled = useStore(director.store, (s) => s.settled);
  const presentation = useStore(director.store, (s) => s.presentation);
  const beat = useStore(director.store, (s) => s.beat);
  const log = useStore(director.store, (s) => s.log);
  const banner = useBanner(beat, me, seats);
  const record = useMemo(() => roundRecord(log), [log]);
  const lines = useMemo(() => feedLines(log), [log]);

  // The countdown redraws while a window's timer runs.
  const timer = settled?.timer ?? null;
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [timer]);

  // The end screen takes over once the victory beat has played (the update has settled).
  const rankings = settled?.view.phase.kind === 'finished' ? settled.view.phase.rankings : null;
  useEffect(() => {
    if (rankings) handlersRef.current.onFinished(rankings);
  }, [rankings]);

  const backToMine = () => setWatch(null);
  useHotkeys({ Escape: backToMine }, watch !== null && !leaving);

  const view = settled?.view;
  const rows = view && presentation ? playerRows({ view, presentation, record, seats, me, watch }) : [];
  const mine = rows.find((r) => r.me);
  const faceOff = view ? faceOffModel({ beat, view, me }) : null;
  const cardPick = view ? cardPickModel(view) : null;
  const watched = seats.find((s) => s.playerId === watch);

  const leave = () => {
    setLeaving(false);
    director.dispose();
    session.leave();
    onLeave();
  };

  return (
    <div className="screen match">
      <MatchScene key={quality} director={director} seats={seats} me={me} setting={quality} watch={watch} reducedMotion={reducedMotion} showStats={showStats} tags={tags} />
      <div className="layer">
        <NameTags seats={seats} me={me} tags={tags} />
        {view && presentation && (
          <>
            <StageBar round={presentation.round} stage={stageIndex(beat, view.awaiting.window, stageFromLog(log))} timer={countdown(settled.timer, view.awaiting.durationMs, now)} />
            <EventFeed lines={lines} seats={seats} />
            <PlayerColumn rows={rows} onWatch={setWatch} reducedMotion={reducedMotion} />
            {mine && <YourPiece row={mine} mods={nextRollMods(presentation.effects, me)} players={rows.length} boardSize={view.board.size} />}
            <Dock model={dockModel({ beat, view, record, me })} seats={seats} onRoll={() => session.send({ type: 'roll' })} />
          </>
        )}
        {watched && (
          <div className="watch-pill pill live">
            <Icon name="eye" />
            <span>
              Watching <b>{watched.nickname}</b>
            </span>
            <button type="button" className="btn" onClick={backToMine}>
              Back to my piece
            </button>
          </div>
        )}
        <button type="button" className="round-btn menu-btn live" aria-label="Leave match" onClick={() => setLeaving(true)}>
          <Icon name="menu" />
        </button>
        {showStats && <DevStats />}
        <BannerView banner={banner} />
        {faceOff && <FaceOffPopup model={faceOff} seats={seats} me={me} onPick={(choice) => session.send({ type: 'challengePick', challengeId: faceOff.challengeId, choice })} />}
        {cardPick && <CardPickPopup model={cardPick} onPick={(slot) => session.send({ type: 'pickCard', slot })} onReroll={(slot) => session.send({ type: 'reroll', slot })} />}
        {leaving && (
          <Dialog title="Leave match?" onClose={() => setLeaving(false)}>
            <p className="dialog-text">Leaving ends this match against the bots and takes you back to the menu.</p>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setLeaving(false)}>
                Keep playing
              </button>
              <button type="button" className="btn accent" onClick={leave}>
                Leave
              </button>
            </div>
          </Dialog>
        )}
        <ToastHost />
      </div>
    </div>
  );
}
```

Create `apps/client/src/app/match.css`:

```css
/* The match screen (spec #2 §7.1): the board fills the screen and the HUD sits over it.
   Colours come from theme.css tokens only. */
.screen {
  position: absolute;
  inset: 0;
}

.match .scene-frame {
  position: absolute;
  inset: 0;
  height: auto;
  margin: 0;
  border-radius: 0;
  background: none;
}

.match .webgl-message {
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: min(520px, 80cqw);
  margin: 0;
  padding: 24px;
  border-radius: 16px;
  background: var(--plate);
  color: var(--white);
  font: 600 max(15px, 2.6cqh) / 1.4 var(--body);
  text-align: center;
  transform: translate(-50%, -50%);
}

/* In-world name tags: TagProjector moves each .tag to its piece; the label hangs above that point. */
.tags {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.tag {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
}

.tag-name {
  display: block;
  padding: 4px 8px 3px;
  border: 2.5px solid var(--ink);
  border-radius: 10px;
  background: var(--seat);
  color: var(--white);
  font-size: max(12px, 2cqh);
  line-height: 1;
  text-shadow: 0 1.5px 0 var(--ink);
  white-space: nowrap;
  transform: translate(-50%, -100%);
}

.tag.me .tag-name {
  box-shadow: 0 0 0 2.5px var(--highlight);
}

.menu-btn {
  position: absolute;
  right: calc(var(--safe-r) + var(--edge));
  top: calc(var(--safe-t) + var(--edge));
}

.watch-pill {
  position: absolute;
  right: calc(var(--safe-r) + var(--edge));
  bottom: calc(var(--safe-b) + var(--edge));
  padding-right: 6px;
}

.watch-pill b {
  color: var(--highlight);
}

.watch-pill .btn {
  padding-block: 6px 5px;
  font-size: max(13px, 2.2cqh);
}

.dev-stats {
  position: absolute;
  left: 50%;
  top: calc(var(--safe-t) + max(52px, 9cqh));
  margin: 0;
  color: var(--muted-on-plate);
  font: 12px / 1 ui-monospace, monospace;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}

.dialog-text {
  margin: 0;
  font: 500 max(14px, 2.4cqh) / 1.4 var(--body);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/tags.test.ts apps/client/test/motion.test.ts apps/client/test/camera.test.ts apps/client/test/scene.test.tsx apps/client/test/MatchScreen.test.tsx`
Expected: PASS, 5 files, 41 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  52 passed (52)` and `Tests  384 passed (384)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): put the HUD over the 3D board on the match screen

In-world name tags placed by the scene every frame (beside a stack for a
piece underneath, staggered on the start row); the match screen plays
the session through a director and wires the HUD: watch mode with Back
to my piece, the leave dialog, rejection toasts and dev stats (spec #2
§7.1, §7.2, §8). Pieces now face along their row, and the overview
frames the start row clear of the dock.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The main menu

**Files:**
- Modify:
  - `apps/client/src/service/matchService.ts` (`FindOptions`), `apps/client/src/service/localMatchService.ts` (the dev seed);
  - `apps/client/test/localMatchService.test.ts`.
- Create:
  - `apps/client/src/scene/MenuScene.tsx`, `apps/client/src/app/MenuScreen.tsx`, `apps/client/src/app/menu.css`;
  - tests: `apps/client/test/menuScene.test.tsx`, `apps/client/test/MenuScreen.test.tsx`.

**Interfaces:**
- Consumes: Tasks 1, 2, 4, 7 and 10.
- Produces:
  - `FindOptions { seed? }` and `MatchService.findMatch(profile, opts?)`;
  - `MENU_CAMERA`, `MenuAnchor`, `MenuContent({ piece, level, reducedMotion, anchors })` and `MenuScene({ piece, setting, reducedMotion, anchors })`;
  - `MenuScreen({ prefs, onPlay, onSettings, showSeed? })`, `TIPS` and `TIP_MS`.

- [ ] **Step 1: Write the failing tests**

Replace `apps/client/test/localMatchService.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_SEAT_MS, LocalMatchService, SEARCH_TICK_MS } from '../src/service/localMatchService';
import type { FindOptions, MatchmakingState, Profile } from '../src/service/matchService';
import { FakeWorker } from './support/fixtures';

const ARI: Profile = { nickname: 'Ari', piece: 'meeple' };

/** A service whose workers are fakes, with every matchmaking state recorded. */
function startSearch(profile = ARI, opts?: FindOptions) {
  const workers: FakeWorker[] = [];
  const service = new LocalMatchService(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  const matchmaking = service.findMatch(profile, opts);
  const states: MatchmakingState[] = [];
  matchmaking.onState((s) => states.push(s));
  const last = () => states.at(-1)!;
  const filled = () => states.filter((s) => s.kind === 'filling').map((s) => s.seats.filter((seat) => seat !== null).length);
  return { matchmaking, states, last, filled, workers };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LocalMatchService', () => {
  it('reports searching every 250 ms with you in seat 0 and three open seats', () => {
    const { states } = startSearch();
    vi.advanceTimersByTime(4 * SEARCH_TICK_MS);
    expect(states.map((s) => (s.kind === 'searching' ? s.elapsedMs : s.kind))).toEqual([0, 250, 500, 750, 1000]);
    expect(states[0]).toEqual({
      kind: 'searching',
      elapsedMs: 0,
      seats: [{ playerId: 'p0', nickname: 'Ari', piece: 'meeple', color: '#ff5470', bot: false }, null, null, null],
    });
  });

  it('never finds a real player', () => {
    const { last, workers } = startSearch();
    vi.advanceTimersByTime(10 * 60_000);
    expect(last().kind).toBe('searching');
    expect(workers).toHaveLength(0);
  });

  it('fills the open seats with bots 420 ms apart, then finds the match', () => {
    const { matchmaking, last, filled } = startSearch();
    matchmaking.playWithBots();
    expect(filled()).toEqual([1]);
    vi.advanceTimersByTime(BOT_SEAT_MS - 1);
    expect(filled()).toEqual([1]);
    vi.advanceTimersByTime(1);
    expect(filled()).toEqual([1, 2]);
    vi.advanceTimersByTime(2 * BOT_SEAT_MS);
    expect(filled()).toEqual([1, 2, 3, 4]);
    expect(last().kind).toBe('found');
    vi.advanceTimersByTime(10_000);
    expect(last().kind).toBe('found'); // searching stopped for good
  });

  it('seats Mochi, Pip and Juno in their colours, on the pieces you did not choose, in picker order', () => {
    const { matchmaking, last } = startSearch();
    matchmaking.playWithBots();
    vi.advanceTimersByTime(3 * BOT_SEAT_MS);
    const found = last();
    if (found.kind !== 'found') throw new Error(`expected found, got ${found.kind}`);
    expect(found.session.me).toBe('p0');
    expect(found.session.seats).toEqual([
      { playerId: 'p0', nickname: 'Ari', piece: 'meeple', color: '#ff5470', bot: false },
      { playerId: 'p1', nickname: 'Mochi', piece: 'knight', color: '#3b82f6', bot: true },
      { playerId: 'p2', nickname: 'Pip', piece: 'pawn', color: '#a3e635', bot: true },
      { playerId: 'p3', nickname: 'Juno', piece: 'dragon', color: '#8b5cf6', bot: true },
    ]);
  });

  it('starts one worker with two different random seeds', () => {
    const { matchmaking, workers } = startSearch();
    matchmaking.playWithBots();
    vi.advanceTimersByTime(3 * BOT_SEAT_MS);
    expect(workers).toHaveLength(1);
    const create = workers[0]!.posted[0];
    if (create?.type !== 'create') throw new Error('expected a create message first');
    expect(create.seed).toMatch(/^[0-9a-f]{32}$/);
    expect(create.rngSeed).toMatch(/^[0-9a-f]{32}$/);
    expect(create.seed).not.toBe(create.rngSeed);
  });

  it('builds the board from a dev seed when one is given, keeping the dice seed random (spec #2 §4.4)', () => {
    const { matchmaking, workers } = startSearch(ARI, { seed: 'daily-2026-10-08' });
    matchmaking.playWithBots();
    vi.advanceTimersByTime(3 * BOT_SEAT_MS);
    const create = workers[0]!.posted[0];
    if (create?.type !== 'create') throw new Error('expected a create message first');
    expect(create.seed).toBe('daily-2026-10-08');
    expect(create.rngSeed).toMatch(/^[0-9a-f]{32}$/);
  });

  it('cancels while searching, then ignores play with bots', () => {
    const { matchmaking, states, last, workers } = startSearch();
    matchmaking.cancel();
    expect(last()).toEqual({ kind: 'cancelled' });
    const count = states.length;
    matchmaking.playWithBots();
    vi.advanceTimersByTime(10_000);
    expect(states).toHaveLength(count);
    expect(workers).toHaveLength(0);
  });

  it('ignores cancel once filling has started, and a second play with bots: one match starts', () => {
    const { matchmaking, states, workers } = startSearch();
    matchmaking.playWithBots();
    matchmaking.playWithBots();
    vi.advanceTimersByTime(BOT_SEAT_MS);
    matchmaking.cancel();
    vi.advanceTimersByTime(10 * BOT_SEAT_MS);
    expect(states.filter((s) => s.kind === 'found')).toHaveLength(1);
    expect(states.some((s) => s.kind === 'cancelled')).toBe(false);
    expect(workers).toHaveLength(1);
  });

  it('stops calling a listener that unsubscribed', () => {
    const service = new LocalMatchService(() => new FakeWorker());
    const states: MatchmakingState[] = [];
    const off = service.findMatch(ARI).onState((s) => states.push(s));
    off();
    vi.advanceTimersByTime(1000);
    expect(states).toHaveLength(1);
  });
});
```

Create `apps/client/test/menuScene.test.tsx`:

```tsx
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { InstancedMesh, Mesh, type BufferGeometry, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { PIECE_GEOMETRY } from '../src/assets/models';
import { MENU_CAMERA, MenuContent } from '../src/scene/MenuScene';
import type { QualityLevel } from '../src/scene/quality';
import { createTagRegistry } from '../src/scene/tags';
import type { PieceId } from '../src/service/matchService';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

async function renderMenu(piece: PieceId, level: QualityLevel = 'high', reducedMotion = false) {
  const anchors = createTagRegistry();
  const fakes = ['plate', 'prev', 'next'].map((key) => {
    const el = { style: {} as Record<string, string> };
    anchors.elements.set(key, el as unknown as HTMLElement);
    return el;
  });
  const renderer = await ReactThreeTestRenderer.create(<MenuContent piece={piece} level={level} reducedMotion={reducedMotion} anchors={anchors} />, {
    camera: { fov: MENU_CAMERA.fov, position: MENU_CAMERA.position },
  });
  await renderer.advanceFrames(3, 1 / 30);
  return { renderer, root: renderer.scene.instance as Object3D, fakes };
}

describe('the menu scene (spec #2 §7.1)', () => {
  it('stands the chosen piece on the podium', async () => {
    const { root, renderer } = await renderMenu('dragon');
    const piece = root.getObjectByName('menu-piece') as Mesh;
    expect(triangles(piece.geometry)).toBe(triangles(PIECE_GEOMETRY.dragon()));
    await renderer.update(<MenuContent piece="pawn" level="high" reducedMotion={false} anchors={createTagRegistry()} />);
    expect(triangles((root.getObjectByName('menu-piece') as Mesh).geometry)).toBe(triangles(PIECE_GEOMETRY.pawn()));
  });

  it('turns the piece on a turntable, and holds it still with reduced motion', async () => {
    const turning = await renderMenu('knight');
    const before = turning.root.getObjectByName('menu-turntable')!.rotation.y;
    await turning.renderer.advanceFrames(5, 1 / 30);
    expect(turning.root.getObjectByName('menu-turntable')!.rotation.y).not.toBeCloseTo(before);
    const still = await renderMenu('knight', 'high', true);
    const held = still.root.getObjectByName('menu-turntable')!.rotation.y;
    await still.renderer.advanceFrames(5, 1 / 30);
    expect(still.root.getObjectByName('menu-turntable')!.rotation.y).toBe(held);
  });

  it('places the name plate on the podium and the arrows beside it', async () => {
    const { fakes } = await renderMenu('knight');
    const xs = fakes.map((el) => Number(/translate\((-?[\d.]+)px/.exec(el.style.transform ?? '')?.[1]));
    expect(xs.every(Number.isFinite)).toBe(true);
    const [plate, prev, next] = xs as [number, number, number];
    expect(prev).toBeLessThan(plate);
    expect(next).toBeGreaterThan(plate);
  });

  it.each(['high', 'low'] as const)('stays inside the phone budget on %s', async (level) => {
    const { root } = await renderMenu('meeple', level);
    let calls = 0;
    let tris = 0;
    root.traverseVisible((node) => {
      if (!(node instanceof Mesh)) return;
      const copies = node instanceof InstancedMesh ? node.count : 1;
      const passes = level === 'high' && node.castShadow ? 2 : 1;
      calls += passes;
      tris += triangles(node.geometry as BufferGeometry) * copies * passes;
    });
    expect(calls).toBeLessThanOrEqual(100);
    expect(tris).toBeLessThanOrEqual(150_000);
  });
});
```

Create `apps/client/test/MenuScreen.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuScreen, TIPS, TIP_MS } from '../src/app/MenuScreen';
import { createPrefsStore } from '../src/app/prefs';

// jsdom has no WebGL: stand the podium scene in with a labelled box.
vi.mock('../src/scene/MenuScene', async () => {
  const { createElement } = await import('react');
  return {
    MenuScene: ({ piece, setting }: { piece: string; setting: string }) => createElement('div', { role: 'img', 'aria-label': `Podium with the ${piece}, ${setting}` }),
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function open(showSeed = false) {
  const prefs = createPrefsStore(null, { prefersReducedMotion: false, random: () => 0.5 });
  const onPlay = vi.fn();
  const onSettings = vi.fn();
  render(<MenuScreen prefs={prefs} onPlay={onPlay} onSettings={onSettings} showSeed={showSeed} />);
  return { prefs, onPlay, onSettings };
}

const rename = (to: string, key = 'Enter') => {
  fireEvent.click(screen.getByRole('button', { name: /Tap to rename/ }));
  const input = screen.getByRole('textbox', { name: 'Nickname' });
  fireEvent.change(input, { target: { value: to } });
  fireEvent.keyDown(input, { key });
};

describe('MenuScreen (spec #2 §7.1)', () => {
  it('shows my guest profile, the logo, and PLAY for a 4-player match', () => {
    const { onPlay } = open();
    expect(screen.getByRole('button', { name: /Tap to rename/ }).textContent).toContain('Guest5500');
    expect(screen.getByRole('heading').textContent).toBe('LADDORIOUSRACE TO 100');
    expect(screen.getByText('4-player match')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(onPlay).toHaveBeenCalledWith({});
  });

  it('renames me from the profile chip, and keeps my name for an empty one or Esc', () => {
    const { prefs } = open();
    rename('  Ari  ');
    expect(prefs.getState().profile.nickname).toBe('Ari');
    expect(screen.getByRole('button', { name: /Tap to rename/ }).textContent).toContain('Ari');
    rename('   ');
    expect(prefs.getState().profile.nickname).toBe('Ari');
    rename('Bob', 'Escape');
    expect(prefs.getState().profile.nickname).toBe('Ari');
    expect(screen.queryByRole('textbox', { name: 'Nickname' })).toBeNull();
  });

  it('saves the new name when I tap away', () => {
    const { prefs } = open();
    fireEvent.click(screen.getByRole('button', { name: /Tap to rename/ }));
    const input = screen.getByRole('textbox', { name: 'Nickname' });
    expect(input.getAttribute('maxlength')).toBe('16');
    fireEvent.change(input, { target: { value: 'Mika' } });
    fireEvent.blur(input);
    expect(prefs.getState().profile.nickname).toBe('Mika');
  });

  it('picks my piece from the picker or the arrows beside the podium', () => {
    const { prefs } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Dragon head' }));
    expect(prefs.getState().profile.piece).toBe('dragon');
    expect(screen.getByRole('button', { name: 'Dragon head' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('img', { name: 'Podium with the dragon, auto' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next piece' }));
    expect(prefs.getState().profile.piece).toBe('knight');
    fireEvent.click(screen.getByRole('button', { name: 'Previous piece' }));
    expect(prefs.getState().profile.piece).toBe('dragon');
  });

  it('turns over the rule tips every few seconds', () => {
    vi.useFakeTimers();
    open();
    expect(screen.getByRole('note').textContent).toContain(TIPS[0]);
    act(() => vi.advanceTimersByTime(TIP_MS));
    expect(screen.getByRole('note').textContent).toContain(TIPS[1]);
  });

  it('opens the settings from the gear', () => {
    const { onSettings } = open();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('plays a typed board seed in dev builds only', () => {
    open();
    expect(screen.queryByRole('textbox', { name: 'Board seed (dev)' })).toBeNull();
    cleanup();
    const { onPlay } = open(true);
    fireEvent.change(screen.getByRole('textbox', { name: 'Board seed (dev)' }), { target: { value: ' daily-2026-10-08 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(onPlay).toHaveBeenCalledWith({ seed: 'daily-2026-10-08' });
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/localMatchService.test.ts apps/client/test/menuScene.test.tsx apps/client/test/MenuScreen.test.tsx`

Expected:
- `localMatchService.test.ts`: FAIL in the dev seed test.
- `menuScene.test.tsx`: FAIL with `Cannot find module '../src/scene/MenuScene'`.
- `MenuScreen.test.tsx`: FAIL with `Failed to resolve import "../src/app/MenuScreen"`.

- [ ] **Step 3: Build the menu**

Replace `apps/client/src/service/matchService.ts` with:

```ts
import type { ChallengeChoice, GameEvent, InputErrorCode, PlayerId, PlayerView } from '@laddorious/core';

// The contract between the screens and a match (spec #2 §4.3). LocalMatchService
// implements it with a Web Worker; the online service (Spec #3) will implement it over the network.

export type PieceId = 'knight' | 'pawn' | 'meeple' | 'dragon';

/** Piece picker order. Bots take the pieces you didn't choose, in this order (§4.4). */
export const PIECES: readonly PieceId[] = ['knight', 'pawn', 'meeple', 'dragon'];

export interface Profile {
  nickname: string;
  piece: PieceId;
}

export interface SeatInfo {
  playerId: PlayerId;
  nickname: string;
  piece: PieceId;
  color: string;
  bot: boolean;
}

export type MatchmakingState =
  | { kind: 'searching'; elapsedMs: number; seats: Array<SeatInfo | null> } // index 0 = you
  | { kind: 'filling'; seats: Array<SeatInfo | null> } // bots taking empty seats
  | { kind: 'found'; session: MatchSession }
  | { kind: 'cancelled' };

/** Dev builds only: a board seed to reproduce a board (spec #2 §4.4). The online service ignores it. */
export interface FindOptions {
  seed?: string;
}

export interface MatchService {
  findMatch(profile: Profile, opts?: FindOptions): Matchmaking;
}

export interface Matchmaking {
  onState(cb: (s: MatchmakingState) => void): () => void;
  cancel(): void; // ignored once filling has started
  playWithBots(): void; // ignored unless searching; idempotent
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

export interface MatchSession {
  me: PlayerId;
  seats: SeatInfo[];
  onUpdate(cb: (u: MatchUpdate) => void): () => void;
  onRejected(cb: (e: { code: InputErrorCode; message: string }) => void): () => void;
  onFailed(cb: (e: { message: string }) => void): () => void;
  send(action: PlayerAction): void; // the session stamps the current windowId
  playbackDone(windowId: number): void;
  pause(): void; // local only; the online service ignores it
  resume(): void;
  leave(): void;
}
```

Replace `apps/client/src/service/localMatchService.ts` with:

```ts
import { SEAT_COLORS } from '../app/theme';
import type { HostWorker } from '../worker/protocol';
import { PIECES, type FindOptions, type Matchmaking, type MatchmakingState, type MatchService, type Profile, type SeatInfo } from './matchService';
import { WorkerMatchSession } from './workerSession';

/** How often `searching` reports the elapsed time, and the pause between bots taking seats (spec #2 §4.4). */
export const SEARCH_TICK_MS = 250;
export const BOT_SEAT_MS = 420;

const BOT_NAMES = ['Mochi', 'Pip', 'Juno'] as const;

/** Seat 0 is you; the bots take the pieces you didn't choose, in picker order. */
function seatsFor(profile: Profile): SeatInfo[] {
  const pieces = PIECES.filter((p) => p !== profile.piece);
  return [
    { playerId: 'p0', nickname: profile.nickname, piece: profile.piece, color: SEAT_COLORS.you, bot: false },
    ...BOT_NAMES.map((nickname, i) => ({
      playerId: `p${i + 1}`,
      nickname,
      piece: pieces[i]!,
      color: SEAT_COLORS.bots[i]!,
      bot: true,
    })),
  ];
}

/** 128 random bits as hex, from the platform's secure generator. */
function randomSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Matchmaking that never finds a real player; "Play with bots" fills the empty seats (spec #2 C7). */
export class LocalMatchService implements MatchService {
  constructor(private readonly createWorker: () => HostWorker) {}

  findMatch(profile: Profile, opts: FindOptions = {}): Matchmaking {
    return new LocalMatchmaking(seatsFor(profile), this.createWorker, opts.seed ?? null);
  }
}

class LocalMatchmaking implements Matchmaking {
  private readonly listeners = new Set<(s: MatchmakingState) => void>();
  private readonly startedAt = Date.now();
  private readonly table: Array<SeatInfo | null>;
  private readonly ticker: ReturnType<typeof setInterval>;
  private state: MatchmakingState;

  constructor(
    private readonly seats: SeatInfo[],
    private readonly createWorker: () => HostWorker,
    /** A dev seed for the board; the dice (rng) seed is always random and secret. */
    private readonly boardSeed: string | null,
  ) {
    this.table = [seats[0]!, null, null, null];
    this.state = this.searching();
    this.ticker = setInterval(() => this.emit(this.searching()), SEARCH_TICK_MS);
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
    if (this.state.kind !== 'searching') return;
    clearInterval(this.ticker);
    this.emit({ kind: 'cancelled' });
  }

  playWithBots(): void {
    if (this.state.kind !== 'searching') return;
    clearInterval(this.ticker);
    this.emit({ kind: 'filling', seats: [...this.table] });
    this.seatBot(1);
  }

  private seatBot(seat: number): void {
    setTimeout(() => {
      this.table[seat] = this.seats[seat]!;
      this.emit({ kind: 'filling', seats: [...this.table] });
      if (seat < this.seats.length - 1) {
        this.seatBot(seat + 1);
        return;
      }
      const session = new WorkerMatchSession(this.createWorker(), this.seats, { seed: this.boardSeed ?? randomSeed(), rngSeed: randomSeed() });
      this.emit({ kind: 'found', session });
    }, BOT_SEAT_MS);
  }

  private searching(): MatchmakingState {
    return { kind: 'searching', elapsedMs: Date.now() - this.startedAt, seats: [...this.table] };
  }

  private emit(s: MatchmakingState): void {
    this.state = s;
    for (const cb of this.listeners) cb(s);
  }
}
```

Create `apps/client/src/scene/MenuScene.tsx`:

```tsx
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Color, Fog, Object3D, Vector3, type Group, type InstancedMesh } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOARD_COLORS, PODIUM_COLORS, SEAT_COLORS, WORLD_COLORS } from '../app/theme';
import { PIECE_GEOMETRY } from '../assets/models';
import { Slot, type SlotName } from '../assets/slots';
import type { PieceId } from '../service/matchService';
import type { Vec3 } from './layout';
import { webglAvailable } from './MatchScene';
import { clamp01, easeOutBack } from './motion';
import { ContextLossWatch } from './Probes';
import { QUALITY, deviceEnv, startLevel, type QualityLevel, type QualitySetting } from './quality';
import type { TagRegistry } from './tags';
import { skyTexture } from './textures';

// The main menu's 3D backdrop (spec #2 §7.1, per the menu mockup): your piece turning on a
// podium on a little floating island, board tiles drifting behind it, a few clouds.

export const MENU_CAMERA = { fov: 35, position: [0, 1.9, 7.8] as Vec3, target: [0, 1.25, 0] as Vec3 };
const PODIUM_X = -0.6;
const TOP_Y = 0.55;
const PIECE_SCALE = 1.25;
const SWAP_MS = 380;

/** Screen anchors the menu's DOM follows: the name plate on the podium's front, the arrows beside it. */
export type MenuAnchor = 'plate' | 'prev' | 'next';
const ANCHORS: Record<MenuAnchor, Vec3> = { plate: [PODIUM_X, 0.24, 1.47], prev: [PODIUM_X - 2.05, 1.25, 0], next: [PODIUM_X + 2.05, 1.25, 0] };

const TILE_COLORS = [...BOARD_COLORS.squares, BOARD_COLORS.mystery];
const TILES = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 1.9 + 0.4;
  const r = 4.2 + (i % 4) * 1.3;
  return { x: Math.cos(a) * r + 1.2, y: -0.4 + ((i * 7) % 9) * 0.45, z: -2.2 - Math.abs(Math.sin(a)) * 4 - (i % 3), phase: i * 1.7, spin: 0.2 + (i % 5) * 0.08 };
});
/** Clouds below and behind the podium: four puffs each. */
const PUFFS = Array.from({ length: 8 }, (_, i) =>
  Array.from({ length: 4 }, (_, k) => {
    const size = 0.9 + ((k * 5 + i) % 4) * 0.25;
    return { x: -9 + i * 2.6 + (k - 1.5) * 1.3, y: -3.2 + (i % 3) * 0.6 + (k % 2) * 0.3, z: -6 - (i % 2) * 3, sx: size * 1.4, s: size };
  }),
);

interface MenuContentProps {
  piece: PieceId;
  level: QualityLevel;
  reducedMotion: boolean;
  anchors?: TagRegistry;
}

/** Everything inside the menu's canvas. */
export function MenuContent({ piece, level, reducedMotion, anchors }: MenuContentProps) {
  const profile = QUALITY[level];
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => skyTexture(WORLD_COLORS.sky), []);
  const geometry = useMemo(() => PIECE_GEOMETRY[piece](), [piece]);
  const tileGeometry = useMemo(() => new RoundedBoxGeometry(0.6, 0.14, 0.6, 2, 0.06), []);
  const turntableRef = useRef<Group>(null);
  const tilesRef = useRef<InstancedMesh>(null);
  const puffsRef = useRef<InstancedMesh>(null);
  const swapAtRef = useRef(0);
  const place = useMemo(() => new Object3D(), []);
  const point = useMemo(() => new Vector3(), []);

  useLayoutEffect(() => {
    const { background, fog } = scene;
    scene.background = sky ?? new Color(WORLD_COLORS.sky[1]);
    scene.fog = new Fog(WORLD_COLORS.fog, 14, 32);
    return () => {
      scene.background = background;
      scene.fog = fog;
    };
  }, [scene, sky]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  // A new piece pops in (spec #2 §6.2 bounce).
  useEffect(() => {
    swapAtRef.current = performance.now();
  }, [piece]);

  useLayoutEffect(() => {
    const tiles = tilesRef.current;
    if (tiles) {
      const color = new Color();
      TILES.forEach((_, i) => tiles.setColorAt(i, color.set(TILE_COLORS[i % TILE_COLORS.length]!)));
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    }
    const puffs = puffsRef.current;
    if (!puffs) return;
    const shown = PUFFS.slice(0, profile.clouds).flat();
    shown.forEach((p, i) => {
      place.position.set(p.x, p.y, p.z);
      place.rotation.set(0, 0, 0);
      place.scale.set(p.sx, p.s, p.s);
      place.updateMatrix();
      puffs.setMatrixAt(i, place.matrix);
    });
    puffs.count = shown.length;
    puffs.instanceMatrix.needsUpdate = true;
  }, [place, profile.clouds]);

  useFrame(({ camera, clock, size }, delta) => {
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const turntable = turntableRef.current;
    if (turntable) {
      if (reducedMotion) turntable.rotation.y = -0.45;
      else turntable.rotation.y += delta * 0.55;
      turntable.position.y = TOP_Y + (reducedMotion ? 0 : Math.abs(Math.sin(t * 1.8)) * 0.06);
      const pop = reducedMotion ? 1 : easeOutBack(clamp01((performance.now() - swapAtRef.current) / SWAP_MS));
      turntable.scale.setScalar(PIECE_SCALE * Math.max(0.001, pop));
    }
    const tiles = tilesRef.current;
    if (tiles) {
      TILES.forEach((d, i) => {
        place.position.set(d.x, d.y + Math.sin(t * 0.8 + d.phase) * (reducedMotion ? 0 : 0.25), d.z);
        place.rotation.set(d.phase + t * d.spin, d.phase * 0.7 + t * d.spin * 0.8, 0);
        place.scale.setScalar(1);
        place.updateMatrix();
        tiles.setMatrixAt(i, place.matrix);
      });
      tiles.instanceMatrix.needsUpdate = true;
    }
    camera.position.set(Math.sin(t * 0.3) * 0.25, MENU_CAMERA.position[1], MENU_CAMERA.position[2]);
    camera.lookAt(...MENU_CAMERA.target);
    camera.updateMatrixWorld();
    if (!anchors) return;
    for (const [key, at] of Object.entries(ANCHORS)) {
      const el = anchors.elements.get(key);
      if (!el) continue;
      point.set(...at).project(camera);
      el.style.transform = `translate(${(((point.x + 1) / 2) * size.width).toFixed(1)}px, ${(((1 - point.y) / 2) * size.height).toFixed(1)}px)`;
    }
  });

  return (
    <>
      <hemisphereLight args={[WORLD_COLORS.sky[2], WORLD_COLORS.islandRock, 1.25]} />
      <directionalLight
        position={[-4, 8, 6]}
        intensity={2.4}
        castShadow={profile.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-bias={-0.0005}
      />
      <group position-x={PODIUM_X}>
        <mesh position-y={0.38} receiveShadow castShadow={profile.shadows}>
          <cylinderGeometry args={[1.35, 1.42, 0.34, 48]} />
          <meshStandardMaterial color={PODIUM_COLORS.top} roughness={0.5} />
        </mesh>
        <mesh position-y={0.2}>
          <cylinderGeometry args={[1.46, 1.46, 0.12, 48]} />
          <meshStandardMaterial color={PODIUM_COLORS.band} metalness={0.3} roughness={0.35} />
        </mesh>
        <mesh position-y={-0.02} castShadow={profile.shadows}>
          <cylinderGeometry args={[1.5, 1.15, 0.36, 48]} />
          <meshStandardMaterial color={PODIUM_COLORS.base} roughness={0.45} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position-y={TOP_Y + 0.005}>
          <torusGeometry args={[1.18, 0.045, 10, 64]} />
          <meshStandardMaterial color={PODIUM_COLORS.ring} emissive={PODIUM_COLORS.ring} emissiveIntensity={0.7} />
        </mesh>
        <mesh rotation-x={Math.PI} position-y={-1.4}>
          <coneGeometry args={[1.55, 2.4, 7]} />
          <meshStandardMaterial color={PODIUM_COLORS.island} roughness={0.9} flatShading />
        </mesh>
        <mesh rotation-x={Math.PI} position={[0.9, -1.05, 0.5]}>
          <coneGeometry args={[0.7, 1.3, 6]} />
          <meshStandardMaterial color={PODIUM_COLORS.chunk} roughness={0.9} flatShading />
        </mesh>
        {!profile.shadows && (
          <mesh rotation-x={-Math.PI / 2} position-y={TOP_Y + 0.008}>
            <circleGeometry args={[0.62, 32]} />
            <meshBasicMaterial color={WORLD_COLORS.ink} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        )}
        <group ref={turntableRef} name="menu-turntable" position-y={TOP_Y}>
          <Slot
            name={`piece.${piece}` as SlotName}
            color={SEAT_COLORS.you}
            fallback={
              <mesh name="menu-piece" geometry={geometry} castShadow={profile.shadows}>
                <meshPhysicalMaterial color={SEAT_COLORS.you} clearcoat={0.9} clearcoatRoughness={0.15} roughness={0.3} />
              </mesh>
            }
          />
        </group>
      </group>
      <instancedMesh ref={tilesRef} args={[tileGeometry, undefined, TILES.length]}>
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={puffsRef} args={[undefined, undefined, PUFFS.flat().length]}>
        <sphereGeometry args={[1, 16, 10]} />
        <meshStandardMaterial color={WORLD_COLORS.cloud} roughness={1} emissive={WORLD_COLORS.cloud} emissiveIntensity={0.22} />
      </instancedMesh>
    </>
  );
}

interface MenuSceneProps {
  piece: PieceId;
  setting: QualitySetting;
  reducedMotion: boolean;
  anchors?: TagRegistry;
}

/** The menu's canvas. Without WebGL the menu still works over the plain sky gradient. Remount (`key`) to change quality. */
export function MenuScene({ piece, setting, reducedMotion, anchors }: MenuSceneProps) {
  const [supported] = useState(webglAvailable);
  const [lost, setLost] = useState(false);
  const [level] = useState<QualityLevel>(() => startLevel(setting, deviceEnv()));
  const loseContext = useCallback(() => setLost(true), []);
  if (!supported || lost) return null;
  const profile = QUALITY[level];
  return (
    <div className="scene-frame">
      <Canvas
        shadows={profile.shadows ? 'percentage' : false}
        dpr={[1, profile.dpr]}
        gl={{ antialias: profile.antialias }}
        camera={{ fov: MENU_CAMERA.fov, near: 0.1, far: 100, position: MENU_CAMERA.position }}
      >
        <MenuContent piece={piece} level={level} reducedMotion={reducedMotion} anchors={anchors} />
        <ContextLossWatch onLost={loseContext} />
      </Canvas>
    </div>
  );
}
```

Create `apps/client/src/app/MenuScreen.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { PIECE_NAMES } from '../hud/labels';
import { MenuScene, type MenuAnchor } from '../scene/MenuScene';
import { createTagRegistry } from '../scene/tags';
import { PIECES, type FindOptions } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { PieceIcon, Portrait } from '../ui/PieceIcon';
import { NICKNAME_MAX, type PrefsState } from './prefs';
import { SEAT_COLORS } from './theme';

/** Short rule reminders, one at a time (spec #2 §7.1). */
export const TIPS = [
  'Everyone rolls one die at the same time.',
  'Purple ? squares give you a card to play.',
  "Land on a slide's vacuum and it pulls you back down.",
  'Launch pads fling you ahead.',
  'Two pieces on one tile? Rock, paper, scissors decides who stays.',
] as const;
export const TIP_MS = 5000;

interface MenuScreenProps {
  prefs: StoreApi<PrefsState>;
  /** PLAY: start matchmaking, with a board seed in dev builds. */
  onPlay: (opts: FindOptions) => void;
  onSettings: () => void;
  /** Dev builds: the hidden board seed field (spec #2 §4.4). */
  showSeed?: boolean;
}

/**
 * The main menu (spec #2 §7.1, per the menu mockup): your piece turning on a podium with your
 * name on its plate, the profile chip (tap to rename), the logo, the settings gear, the piece
 * picker with arrows beside the podium, PLAY, and rotating rule tips.
 */
export function MenuScreen({ prefs, onPlay, onSettings, showSeed = false }: MenuScreenProps) {
  const profile = useStore(prefs, (s) => s.profile);
  const settings = useStore(prefs, (s) => s.settings);
  const [anchors] = useState(createTagRegistry);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [tip, setTip] = useState(0);
  const [seed, setSeed] = useState('');
  // Enter or Esc ends a rename once; a blur fired as the field unmounts must not save again.
  const renameDoneRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), TIP_MS);
    return () => clearInterval(id);
  }, []);

  const anchor = (key: MenuAnchor) => (el: HTMLElement | null) => {
    if (el) anchors.elements.set(key, el);
    else anchors.elements.delete(key);
  };
  const cycle = (step: number) => {
    const i = PIECES.indexOf(profile.piece);
    prefs.getState().setPiece(PIECES[(i + step + PIECES.length) % PIECES.length]!);
  };
  const finishRename = (save: boolean) => {
    if (renameDoneRef.current) return;
    renameDoneRef.current = true;
    if (save) prefs.getState().rename(draft);
    setEditing(false);
  };

  return (
    <div className="screen menu">
      <MenuScene key={settings.quality} piece={profile.piece} setting={settings.quality} reducedMotion={settings.reducedMotion} anchors={anchors} />
      <div className="layer">
        <div ref={anchor('plate')} className="menu-anchor menu-plate display">
          {profile.nickname}
        </div>
        <button ref={anchor('prev')} type="button" className="menu-anchor round-btn live" aria-label="Previous piece" onClick={() => cycle(-1)}>
          <Icon name="back" />
        </button>
        <button ref={anchor('next')} type="button" className="menu-anchor round-btn live" aria-label="Next piece" onClick={() => cycle(1)}>
          <Icon name="next" />
        </button>

        <div className="profile-chip live">
          <Portrait piece={profile.piece} color={SEAT_COLORS.you} />
          {editing ? (
            <input
              className="profile-input display"
              aria-label="Nickname"
              maxLength={NICKNAME_MAX}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finishRename(true);
                if (e.key === 'Escape') finishRename(false);
              }}
              onBlur={() => finishRename(true)}
            />
          ) : (
            <button
              type="button"
              className="profile-name"
              aria-label={`Your profile: ${profile.nickname}. Tap to rename`}
              onClick={() => {
                setDraft(profile.nickname);
                renameDoneRef.current = false;
                setEditing(true);
              }}
            >
              <span className="display">
                {profile.nickname}
                <Icon name="pencil" />
              </span>
              <small>Guest · tap to rename</small>
            </button>
          )}
        </div>

        <h1 className="logo">
          <b className="display">
            LADDOR<span>IOUS</span>
          </b>
          <small>RACE TO 100</small>
        </h1>

        <button type="button" className="round-btn gear-btn live" aria-label="Settings" onClick={onSettings}>
          <Icon name="gear" />
        </button>
        {showSeed && (
          <input className="seed-input live" aria-label="Board seed (dev)" placeholder="Board seed (dev)" value={seed} onChange={(e) => setSeed(e.target.value)} />
        )}

        <div className="picker live" role="group" aria-label="Choose your piece">
          {PIECES.map((piece) => (
            <button key={piece} type="button" className="picker-tile display" aria-pressed={piece === profile.piece} onClick={() => prefs.getState().setPiece(piece)}>
              <span className="picker-icon">
                <PieceIcon piece={piece} />
              </span>
              {PIECE_NAMES[piece]}
            </button>
          ))}
        </div>

        <div className="play-wrap live">
          <span className="pill play-caption">4-player match</span>
          <button type="button" className="btn primary play-btn" onClick={() => onPlay(seed.trim() ? { seed: seed.trim() } : {})}>
            <Icon name="play" />
            PLAY
          </button>
        </div>

        <p className="tip" role="note">
          <b className="display">TIP</b>
          <span>{TIPS[tip]}</span>
        </p>
      </div>
    </div>
  );
}
```

Create `apps/client/src/app/menu.css`:

```css
/* The main menu (spec #2 §7.1, per the menu mockup). Sizes follow the viewport height (cqh of
   .app) with pixel minimums; colours come from theme.css tokens only. */
.menu .scene-frame {
  position: absolute;
  inset: 0;
  height: auto;
  margin: 0;
  border-radius: 0;
  background: none;
}

/* The plate and arrows follow the podium on screen (MenuScene projects them); off screen until then. */
.menu-anchor {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-200px, -200px);
}

.menu-plate {
  padding: max(4px, 0.8cqh) max(12px, 2.2cqh) max(3px, 0.6cqh);
  border: 3px solid var(--ink);
  border-radius: 10px;
  background: var(--highlight);
  box-shadow: 0 3px 0 var(--ink);
  color: var(--ink);
  font-size: max(14px, 3cqh);
  line-height: 1;
  letter-spacing: 0.3px;
  white-space: nowrap;
  translate: -50% -50%;
}

.menu .menu-anchor.round-btn {
  translate: -50% -50%;
}

/* Profile chip, top left: portrait, nickname, tap to rename. */
.profile-chip {
  position: absolute;
  left: calc(var(--safe-l) + 3cqh);
  top: calc(var(--safe-t) + 3cqh);
  display: flex;
  align-items: center;
  gap: max(8px, 1.6cqh);
  min-height: 44px;
  padding: max(4px, 1cqh) max(14px, 2.6cqh) max(4px, 1cqh) max(4px, 1cqh);
  border-radius: 999px;
  background: var(--plate);
  color: var(--white);
}

.profile-name {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 44px;
  justify-content: center;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.profile-name > span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: max(15px, 3.4cqh);
  line-height: 1;
  letter-spacing: 0.3px;
}

.profile-name .icon {
  color: var(--muted-on-plate);
  font-size: max(13px, 2.4cqh);
}

.profile-name small {
  margin-top: 3px;
  color: var(--muted-on-plate);
  font: 600 max(11px, 1.9cqh) / 1.2 var(--body);
}

.profile-input {
  width: max(140px, 26cqh);
  min-height: 40px;
  padding: 4px 8px 3px;
  border: 2px solid var(--ink);
  border-radius: 9px;
  background: var(--white);
  color: var(--ink);
  font-size: max(15px, 3.4cqh);
}

/* Logo, top centre */
.logo {
  position: absolute;
  left: 50%;
  top: calc(var(--safe-t) + 2.6cqh);
  margin: 0;
  color: var(--white);
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.logo b {
  display: block;
  font-size: max(24px, 6.6cqh);
  line-height: 1;
  letter-spacing: 1px;
  text-shadow: var(--o-lg);
}

.logo b span {
  color: var(--highlight);
}

.logo small {
  display: inline-block;
  margin-top: max(5px, 1.2cqh);
  padding: max(3px, 0.7cqh) max(9px, 1.6cqh);
  border-radius: 99px;
  background: var(--plate);
  font: 600 max(11px, 2cqh) / 1 var(--body);
  letter-spacing: 0.6px;
}

.gear-btn {
  position: absolute;
  right: calc(var(--safe-r) + 3cqh);
  top: calc(var(--safe-t) + 3cqh);
}

.seed-input {
  position: absolute;
  right: calc(var(--safe-r) + 3cqh);
  top: calc(var(--safe-t) + 3cqh + max(52px, 10cqh));
  width: max(150px, 26cqh);
  min-height: 36px;
  padding: 4px 10px;
  border: 2px dashed var(--empty-seat-edge);
  border-radius: 10px;
  background: var(--plate-soft);
  color: var(--white);
  font: 500 13px / 1 ui-monospace, monospace;
}

/* Piece picker, bottom centre */
.picker {
  position: absolute;
  left: 50%;
  bottom: calc(var(--safe-b) + 3cqh);
  display: flex;
  gap: max(6px, 1.4cqh);
  padding: max(5px, 1.1cqh);
  border-radius: max(14px, 2.8cqh);
  background: var(--plate);
  transform: translateX(-50%);
}

.picker-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: max(2px, 0.4cqh);
  width: max(56px, 11.5cqh);
  height: max(60px, 13.5cqh);
  padding: max(3px, 0.6cqh) 0 0;
  border: 3px solid var(--ink);
  border-radius: max(10px, 2cqh);
  background: var(--paper);
  box-shadow: 0 max(3px, 0.6cqh) 0 var(--ink);
  color: var(--ink);
  font-size: max(10px, 1.9cqh);
  line-height: 1;
  cursor: pointer;
  transition: transform 0.15s cubic-bezier(0.2, 0.9, 0.3, 1.4);
}

.picker-tile[aria-pressed='true'] {
  background: var(--highlight);
  transform: translateY(-0.9cqh);
}

.picker-tile:hover:not([aria-pressed='true']) {
  background: var(--paper-alt);
}

.picker-icon {
  display: grid;
  place-items: center;
  width: 64%;
  aspect-ratio: 1;
  border: 2.5px solid var(--ink);
  border-radius: 50%;
  background: var(--accent);
}

.picker-icon .piece-icon {
  width: 76%;
  height: 76%;
}

/* PLAY, bottom right */
.play-wrap {
  position: absolute;
  right: calc(var(--safe-r) + 3cqh);
  bottom: calc(var(--safe-b) + 3cqh);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: max(5px, 1cqh);
}

.play-caption {
  padding: max(4px, 0.8cqh) max(10px, 1.6cqh);
  font-size: max(11px, 2cqh);
}

.play-btn {
  min-width: max(150px, 34cqh);
  height: max(56px, 14.5cqh);
  border-width: 4px;
  border-radius: max(16px, 3.4cqh);
  box-shadow: 0 max(5px, 1.2cqh) 0 var(--ink);
  font-size: max(24px, 7cqh);
  letter-spacing: 1.5px;
}

.play-btn .icon {
  font-size: 0.75em;
}

/* Rule tips, bottom left; hidden on short screens (§7.1). */
.tip {
  position: absolute;
  left: calc(var(--safe-l) + 3cqh);
  bottom: calc(var(--safe-b) + 3cqh);
  display: flex;
  align-items: flex-start;
  gap: max(7px, 1.2cqh);
  max-width: 25cqw;
  margin: 0;
  padding: max(8px, 1.4cqh) max(12px, 2cqh);
  border-radius: max(12px, 2cqh);
  background: var(--plate);
  color: var(--white);
  font: 500 max(12px, 2.3cqh) / 1.35 var(--body);
}

.tip b {
  color: var(--highlight);
  font-size: max(12px, 2.3cqh);
  line-height: 1.35;
  letter-spacing: 0.4px;
}

@container (max-height: 449px) {
  .tip {
    display: none;
  }
}
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/localMatchService.test.ts apps/client/test/menuScene.test.tsx apps/client/test/MenuScreen.test.tsx`
Expected: PASS, 3 files, 21 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  54 passed (54)` and `Tests  397 passed (397)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add the main menu with the podium

Your piece turning on a podium with your name on its plate, floating
board tiles and clouds; the profile chip (tap to rename), the logo,
the settings gear, the piece picker and arrows, PLAY for a 4-player
match, rotating rule tips and, in dev builds, a board seed field
passed to findMatch (spec #2 §4.4, §7.1).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Matchmaking, end, error and settings

**Files:**
- Create: `apps/client/src/app/MatchmakingOverlay.tsx`, `EndScreen.tsx`, `ErrorScreen.tsx`, `SettingsDialog.tsx`, `screens.css`, and `apps/client/test/screens.test.tsx`

**Interfaces:**
- Consumes: Tasks 2, 7, 9 and 10.
- Produces:
  - `MatchmakingOverlay({ matchmaking, onCancelled, onReady })`, `PLAY_WITH_BOTS_AFTER_MS` and `COUNT_MS`;
  - `EndScreen({ rankings, seats, me, onPlayAgain, onMenu })`;
  - `ErrorScreen({ message, showDetails, onMenu })`;
  - `SettingsDialog({ prefs, onClose, device? })`.

- [ ] **Step 1: Write the failing tests**

Create `apps/client/test/screens.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EndScreen } from '../src/app/EndScreen';
import { ErrorScreen } from '../src/app/ErrorScreen';
import { COUNT_MS, MatchmakingOverlay, PLAY_WITH_BOTS_AFTER_MS } from '../src/app/MatchmakingOverlay';
import { createPrefsStore } from '../src/app/prefs';
import { SettingsDialog } from '../src/app/SettingsDialog';
import { SEATS } from './support/fixtures';
import { ScriptedMatchmaking, ScriptedSession } from './support/scripted';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const you = SEATS[0]!;

describe('MatchmakingOverlay (spec #2 §7.1, C7)', () => {
  function open() {
    const matchmaking = new ScriptedMatchmaking();
    const onCancelled = vi.fn();
    const onReady = vi.fn();
    render(<MatchmakingOverlay matchmaking={matchmaking} onCancelled={onCancelled} onReady={onReady} />);
    return { matchmaking, onCancelled, onReady };
  }

  it('searches with my seat and three open ones, offering bots only after 15 s', () => {
    const { matchmaking } = open();
    matchmaking.emit({ kind: 'searching', elapsedMs: 14_000, seats: [you, null, null, null] });
    const dialog = screen.getByRole('dialog', { name: 'FINDING PLAYERS' });
    expect(within(dialog).getByRole('timer').textContent).toBe('0:14');
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['YouYOU', 'Searching', 'Searching', 'Searching']);
    expect(screen.queryByRole('button', { name: 'Play with bots' })).toBeNull();
    matchmaking.emit({ kind: 'searching', elapsedMs: PLAY_WITH_BOTS_AFTER_MS, seats: [you, null, null, null] });
    expect(dialog.textContent).toContain('Taking a while? Start now and bots take the empty seats.');
    fireEvent.click(screen.getByRole('button', { name: 'Play with bots' }));
    expect(matchmaking.playWithBots).toHaveBeenCalledTimes(1);
  });

  it('cancels with the button or Esc, and goes back when the search is cancelled', () => {
    const { matchmaking, onCancelled } = open();
    matchmaking.emit({ kind: 'searching', elapsedMs: 1_000, seats: [you, null, null, null] });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(matchmaking.cancel).toHaveBeenCalledTimes(2);
    matchmaking.emit({ kind: 'cancelled' });
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });

  it('shows the bots taking their seats, then MATCH FOUND and 3-2-1 before the match starts', () => {
    const { matchmaking, onReady } = open();
    matchmaking.emit({ kind: 'filling', seats: [you, SEATS[1]!, null, null] });
    expect(screen.getByRole('dialog', { name: 'ADDING BOTS' }).textContent).toContain('MochiBOT');
    const session = new ScriptedSession();
    matchmaking.emit({ kind: 'found', session });
    expect(screen.getByRole('dialog', { name: 'MATCH FOUND!' })).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('3');
    act(() => vi.advanceTimersByTime(COUNT_MS));
    expect(screen.getByRole('timer').textContent).toBe('2');
    act(() => vi.advanceTimersByTime(COUNT_MS));
    expect(screen.getByRole('timer').textContent).toBe('1');
    expect(onReady).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(COUNT_MS));
    expect(onReady).toHaveBeenCalledWith(session);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  });
});

describe('EndScreen (spec #2 §7.1)', () => {
  const rankings = [
    { player: 'p2', rank: 1, position: 100 },
    { player: 'p0', rank: 2, position: 87 },
    { player: 'p3', rank: 3, position: 60 },
    { player: 'p1', rank: 4, position: 41 },
  ];

  it('stands the final standings on a podium, 1st to 4th, and offers Play again and Main menu', () => {
    const onPlayAgain = vi.fn();
    const onMenu = vi.fn();
    render(<EndScreen rankings={rankings} seats={SEATS} me="p0" onPlayAgain={onPlayAgain} onMenu={onMenu} />);
    expect(screen.getByRole('heading').textContent).toBe('Pip wins!');
    const places = within(screen.getByRole('list', { name: 'Final standings' })).getAllByRole('listitem');
    expect(places.map((li) => li.getAttribute('aria-label'))).toEqual(['1st: Pip, tile 100', '2nd: You (you), tile 87', '3rd: Juno, tile 60', '4th: Mochi, tile 41']);
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('cheers when I win', () => {
    render(<EndScreen rankings={rankings.map((r) => ({ ...r, rank: r.player === 'p0' ? 1 : r.rank === 1 ? 2 : r.rank }))} seats={SEATS} me="p0" onPlayAgain={() => {}} onMenu={() => {}} />);
    expect(screen.getByRole('heading').textContent).toBe('You win!');
  });
});

describe('ErrorScreen (spec #2 §7.1, §8)', () => {
  it('says something went wrong and goes back to the menu', () => {
    const onMenu = vi.fn();
    render(<ErrorScreen message="InvariantError: bad destination 104" showDetails={false} onMenu={onMenu} />);
    expect(screen.getByRole('heading').textContent).toBe('Something went wrong in this match');
    expect(screen.queryByText(/InvariantError/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('shows the error text with a copy button in dev builds', () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<ErrorScreen message="InvariantError: bad destination 104" showDetails onMenu={() => {}} />);
    expect(screen.getByText('InvariantError: bad destination 104')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy error' }));
    expect(writeText).toHaveBeenCalledWith('InvariantError: bad destination 104');
  });
});

describe('SettingsDialog (spec #2 §7.1, §9.2)', () => {
  it('saves the graphics quality and shows its description and the level in use', () => {
    const prefs = createPrefsStore(null, { prefersReducedMotion: false });
    render(<SettingsDialog prefs={prefs} device={{ coarsePointer: false, shortSide: 900 }} onClose={() => {}} />);
    const quality = screen.getByRole('group', { name: 'Graphics quality' });
    expect(within(quality).getByRole('button', { name: 'Auto' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('dialog').textContent).toContain('Right now: High (Auto on this device)');
    fireEvent.click(within(quality).getByRole('button', { name: 'Low' }));
    expect(prefs.getState().settings.quality).toBe('low');
    expect(screen.getByRole('dialog').textContent).toContain('No live shadows and lower resolution. Best for older phones.');
    expect(screen.getByRole('dialog').textContent).toContain('Right now: Low');
  });

  it('saves Reduced motion, and closes', () => {
    const prefs = createPrefsStore(null, { prefersReducedMotion: false });
    const onClose = vi.fn();
    render(<SettingsDialog prefs={prefs} device={{ coarsePointer: true, shortSide: 390 }} onClose={onClose} />);
    const toggle = screen.getByRole('switch', { name: 'Reduced motion' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(prefs.getState().settings.reducedMotion).toBe(true);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('dialog').textContent).toContain('Right now: Low (Auto on this device)');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/screens.test.tsx`
Expected: FAIL with `Failed to resolve import` for a screen that doesn't exist yet.

- [ ] **Step 3: Build the screens**

Create `apps/client/src/app/MatchmakingOverlay.tsx`:

```tsx
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { Matchmaking, MatchmakingState, MatchSession, SeatInfo } from '../service/matchService';
import { Portrait } from '../ui/PieceIcon';
import { useHotkeys } from '../ui/useHotkeys';

/** "Play with bots" appears once a search has run this long (spec #2 C7). */
export const PLAY_WITH_BOTS_AFTER_MS = 15_000;
/** Each step of the 3-2-1 countdown after MATCH FOUND. */
export const COUNT_MS = 750;

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface MatchmakingOverlayProps {
  matchmaking: Matchmaking;
  /** The search was cancelled: back to the menu. */
  onCancelled: () => void;
  /** MATCH FOUND and the countdown are over: the match screen takes over. */
  onReady: (session: MatchSession) => void;
}

/**
 * Matchmaking, over the menu scene (spec #2 §7.1): FINDING PLAYERS with the elapsed time, my
 * seat and three searching ones, Cancel, and after 15 s "Play with bots". Then the bots take
 * their seats, MATCH FOUND!, a 3-2-1 countdown, and the match.
 */
export function MatchmakingOverlay({ matchmaking, onCancelled, onReady }: MatchmakingOverlayProps) {
  const titleId = useId();
  const [state, setState] = useState<MatchmakingState | null>(null);
  const [count, setCount] = useState(3);
  const handlersRef = useRef({ onCancelled, onReady });
  useLayoutEffect(() => {
    handlersRef.current = { onCancelled, onReady };
  });

  useEffect(() => matchmaking.onState(setState), [matchmaking]);

  useEffect(() => {
    if (state?.kind === 'cancelled') handlersRef.current.onCancelled();
  }, [state]);

  const found = state?.kind === 'found' ? state.session : null;
  useEffect(() => {
    if (!found) return;
    let left = 3;
    const id = setInterval(() => {
      left -= 1;
      if (left > 0) {
        setCount(left);
        return;
      }
      clearInterval(id);
      handlersRef.current.onReady(found);
    }, COUNT_MS);
    return () => clearInterval(id);
  }, [found]);

  useHotkeys({ Escape: () => matchmaking.cancel() }, state?.kind === 'searching');

  if (!state || state.kind === 'cancelled') return null;
  const seats = state.kind === 'found' ? found!.seats : state.seats;
  const title = state.kind === 'searching' ? 'FINDING PLAYERS' : state.kind === 'filling' ? 'ADDING BOTS' : 'MATCH FOUND!';
  const offerBots = state.kind === 'searching' && state.elapsedMs >= PLAY_WITH_BOTS_AFTER_MS;

  return (
    <div className="popup live matchmaking" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="backdrop" />
      <div className="popup-content">
        <h2 id={titleId} className={state.kind === 'found' ? 'popup-title display found' : 'popup-title display'}>
          {title}
        </h2>
        {state.kind === 'searching' && (
          <span className="mm-time display" role="timer">
            {clock(state.elapsedMs)}
          </span>
        )}
        <ol className="mm-seats">
          {seats.map((seat, i) => (
            // eslint-disable-next-line @eslint-react/no-array-index-key -- a seat's position is its identity
            <SeatSlot key={i} seat={seat} me={i === 0} />
          ))}
        </ol>
        {state.kind === 'found' ? (
          <span key={count} className="mm-count display" role="timer">
            {count}
          </span>
        ) : (
          <p className="popup-hint">
            {state.kind === 'filling'
              ? 'Get ready…'
              : offerBots
                ? 'Taking a while? Start now and bots take the empty seats.'
                : 'A 4-player match starts as soon as the seats fill.'}
          </p>
        )}
        {state.kind === 'searching' && (
          <div className="mm-buttons">
            {offerBots && (
              <button type="button" className="btn accent appear" onClick={() => matchmaking.playWithBots()}>
                Play with bots
              </button>
            )}
            <button type="button" className="btn" onClick={() => matchmaking.cancel()}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SeatSlot({ seat, me }: { seat: SeatInfo | null; me: boolean }) {
  if (!seat) {
    return (
      <li className="mm-seat empty">
        <span className="mm-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mm-name display">Searching</span>
      </li>
    );
  }
  return (
    <li className={me ? 'mm-seat me' : 'mm-seat'}>
      <Portrait piece={seat.piece} color={seat.color} className="mm-portrait" />
      <span className="mm-name display">{seat.nickname}</span>
      <span className="mm-tag">{me ? 'YOU' : 'BOT'}</span>
    </li>
  );
}
```

Create `apps/client/src/app/EndScreen.tsx`:

```tsx
import type { PlayerId, Ranking } from '@laddorious/core';
import type { SeatInfo } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { Portrait } from '../ui/PieceIcon';

const ORDINAL = ['1st', '2nd', '3rd', '4th'];

interface EndScreenProps {
  rankings: Ranking[];
  seats: readonly SeatInfo[];
  me: PlayerId;
  /** Back to matchmaking with the same profile. */
  onPlayAgain: () => void;
  onMenu: () => void;
}

/** The end screen (spec #2 §7.1): final standings on a podium, 1st to 4th, then Play again or Main menu. */
export function EndScreen({ rankings, seats, me, onPlayAgain, onMenu }: EndScreenProps) {
  const seat = (id: PlayerId) => seats.find((s) => s.playerId === id);
  const ordered = [...rankings].sort((a, b) => a.rank - b.rank);
  const winner = ordered[0];
  const title = winner?.player === me ? 'You win!' : `${seat(winner?.player ?? '')?.nickname ?? winner?.player ?? 'Nobody'} wins!`;
  return (
    <div className="screen end live">
      <div className="backdrop" />
      <div className="end-content">
        <h2 className={winner?.player === me ? 'end-title display mine' : 'end-title display'}>
          <Icon name="trophy" />
          {title}
        </h2>
        <ol className="podium" aria-label="Final standings">
          {ordered.map((r) => {
            const s = seat(r.player);
            const name = s ? (r.player === me ? `${s.nickname} (you)` : s.nickname) : r.player;
            return (
              <li key={r.player} className={`place place-${r.rank}${r.player === me ? ' me' : ''}`} aria-label={`${ORDINAL[r.rank - 1] ?? `${r.rank}th`}: ${name}, tile ${r.position}`}>
                {s && <Portrait piece={s.piece} color={s.color} className="place-portrait" />}
                <span className="place-name display">{s?.nickname ?? r.player}</span>
                <span className="place-step">
                  <b className="display">{r.rank}</b>
                  <small>{`tile ${r.position}`}</small>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="end-buttons">
          <button type="button" className="btn primary" onClick={onPlayAgain}>
            Play again
          </button>
          <button type="button" className="btn" onClick={onMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
}
```

Create `apps/client/src/app/ErrorScreen.tsx`:

```tsx
import { useState } from 'react';

interface ErrorScreenProps {
  message: string;
  /** Dev builds: show the error text with a copy button. */
  showDetails: boolean;
  onMenu: () => void;
}

/** When a match fails (spec #2 §7.1, §8): what happened, Back to menu, and in dev builds the error text. */
export function ErrorScreen({ message, showDetails, onMenu }: ErrorScreenProps) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="screen error-screen live">
      <div className="backdrop" />
      <div className="error-panel panel">
        <h2 className="display">Something went wrong in this match</h2>
        <p>The match had to stop. Your profile and settings are safe.</p>
        {showDetails && (
          <div className="error-details">
            <pre>{message}</pre>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void navigator.clipboard?.writeText(message).then(() => setCopied(true));
              }}
            >
              {copied ? 'Copied' : 'Copy error'}
            </button>
          </div>
        )}
        <button type="button" className="btn primary" onClick={onMenu}>
          Back to menu
        </button>
      </div>
    </div>
  );
}
```

Create `apps/client/src/app/SettingsDialog.tsx`:

```tsx
import { useId } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { deviceEnv, startLevel, type QualitySetting } from '../scene/quality';
import { Dialog } from '../ui/Dialog';
import type { PrefsState } from './prefs';

const QUALITY_OPTIONS: Array<{ value: QualitySetting; label: string; description: string }> = [
  { value: 'auto', label: 'Auto', description: 'Picks Low on phones and High on desktop, and steps down if the frame rate drops.' },
  { value: 'low', label: 'Low', description: 'No live shadows and lower resolution. Best for older phones.' },
  { value: 'high', label: 'High', description: 'Live shadows, antialiasing and full resolution.' },
];

interface SettingsDialogProps {
  prefs: StoreApi<PrefsState>;
  onClose: () => void;
  /** What Auto looks at; the real device by default. */
  device?: { coarsePointer: boolean; shortSide: number };
}

/**
 * Settings (spec #2 §7.1): graphics quality (Auto, Low, High, with a one-line description and
 * the level in use) and Reduced motion. Changes are saved at once.
 */
export function SettingsDialog({ prefs, onClose, device = deviceEnv() }: SettingsDialogProps) {
  const settings = useStore(prefs, (s) => s.settings);
  const qualityId = useId();
  const motionId = useId();
  const chosen = QUALITY_OPTIONS.find((o) => o.value === settings.quality)!;
  const level = startLevel(settings.quality, device);
  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="setting-row">
        <div className="setting-label">
          <b className="display" id={qualityId}>
            Graphics quality
          </b>
          <span>{chosen.description}</span>
        </div>
        <div className="segmented" role="group" aria-labelledby={qualityId}>
          {QUALITY_OPTIONS.map((o) => (
            <button key={o.value} type="button" className="display" aria-pressed={o.value === settings.quality} onClick={() => prefs.getState().setQuality(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">
          <b className="display" id={motionId}>
            Reduced motion
          </b>
          <span>Camera cuts instead of swoops, and less wobble.</span>
        </div>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={settings.reducedMotion}
          aria-labelledby={motionId}
          onClick={() => prefs.getState().setReducedMotion(!settings.reducedMotion)}
        />
      </div>
      <p className="setting-note">{`Right now: ${level === 'high' ? 'High' : 'Low'}${settings.quality === 'auto' ? ' (Auto on this device)' : ''}.`}</p>
    </Dialog>
  );
}
```

Create `apps/client/src/app/screens.css`:

```css
/* Matchmaking, end, error and settings (spec #2 §7.1). Sizes follow the viewport height (cqh of
   .app) with pixel minimums; colours come from theme.css tokens only. Popups reuse .popup from
   hud/popups.css: centred over a dimmed backdrop, no panel. */

/* ---------------------------------------------------------------- matchmaking */
.popup-title.found {
  color: var(--highlight);
}

.mm-time {
  color: var(--highlight);
  font-size: max(18px, 4.4cqh);
  line-height: 1;
  text-shadow: var(--o-sm);
  font-variant-numeric: tabular-nums;
}

.mm-seats {
  display: flex;
  gap: max(10px, 3cqh);
  margin: 0;
  padding: 0;
  list-style: none;
}

.mm-seat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: max(4px, 1cqh);
  width: max(64px, 15cqh);
}

.mm-portrait {
  width: max(52px, 13cqh);
  height: max(52px, 13cqh);
  box-shadow:
    0 0 0 2.5px var(--white),
    0 max(3px, 0.8cqh) 0 var(--ink);
  animation: pop-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.5);
}

.mm-seat.me .mm-portrait {
  box-shadow:
    0 0 0 3px var(--highlight),
    0 max(3px, 0.8cqh) 0 var(--ink);
}

.mm-seat.empty .mm-dots {
  display: grid;
  place-items: center;
  grid-auto-flow: column;
  gap: max(3px, 0.6cqh);
  width: max(52px, 13cqh);
  height: max(52px, 13cqh);
  border: 3px dashed var(--empty-seat-edge);
  border-radius: 50%;
  background: var(--empty-seat);
}

.mm-dots i {
  width: max(5px, 1.1cqh);
  height: max(5px, 1.1cqh);
  border-radius: 50%;
  background: var(--white);
  opacity: 0.3;
  animation: dot 1.2s infinite;
}

.mm-dots i:nth-child(2) {
  animation-delay: 0.2s;
}

.mm-dots i:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dot {
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.mm-name {
  color: var(--white);
  font-size: max(12px, 2.5cqh);
  line-height: 1;
  text-shadow: var(--o-sm);
  white-space: nowrap;
}

.mm-tag {
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--paper-alt);
  color: var(--muted-on-paper);
  font: 700 max(9px, 1.6cqh) / 1 var(--body);
  letter-spacing: 0.6px;
}

.mm-seat.me .mm-tag {
  background: var(--highlight);
  color: var(--ink);
}

.mm-count {
  color: var(--highlight);
  font-size: max(40px, 14cqh);
  line-height: 1;
  text-shadow: var(--o-lg);
  animation: pop-in 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.5);
}

.mm-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: max(8px, 2cqh);
}

.btn.appear {
  animation: pop-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.5);
}

/* ---------------------------------------------------------------- end screen: a podium */
.end {
  display: grid;
  place-items: center;
  z-index: 30;
}

.end-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: max(12px, 3cqh);
  animation: rise 0.35s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}

.end-title {
  display: flex;
  align-items: center;
  gap: 0.3em;
  margin: 0;
  color: var(--white);
  font-size: max(32px, 8cqh);
  line-height: 1;
  text-shadow: var(--o-lg);
}

.end-title.mine,
.end-title .icon {
  color: var(--gold);
}

.podium {
  display: flex;
  align-items: flex-end;
  gap: max(6px, 1.5cqh);
  margin: 0;
  padding: 0;
  list-style: none;
}

.place {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: max(4px, 0.9cqh);
  width: max(72px, 17cqh);
}

/* 2nd, 1st, 3rd, 4th from left to right; reading order stays 1st to 4th. */
.place-1 {
  order: 2;
}

.place-2 {
  order: 1;
}

.place-3 {
  order: 3;
}

.place-4 {
  order: 4;
}

.place-portrait {
  width: max(52px, 12cqh);
  height: max(52px, 12cqh);
  animation: pop-in 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.5);
}

.place.me .place-portrait {
  box-shadow: 0 0 0 3px var(--highlight);
}

.place-name {
  color: var(--white);
  font-size: max(13px, 2.6cqh);
  line-height: 1;
  text-shadow: var(--o-sm);
  white-space: nowrap;
}

.place-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  width: 100%;
  padding-top: max(6px, 1.2cqh);
  border: 3px solid var(--ink);
  border-radius: 12px 12px 0 0;
  background: var(--paper);
  box-shadow: 0 max(4px, 0.8cqh) 0 var(--ink);
  color: var(--ink);
}

.place-step b {
  font-size: max(22px, 5.5cqh);
  line-height: 1;
}

.place-step small {
  color: var(--muted-on-paper);
  font: 600 max(10px, 1.7cqh) / 1 var(--body);
}

.place-1 .place-step {
  height: max(96px, 24cqh);
  background: var(--gold);
}

.place-2 .place-step {
  height: max(76px, 18cqh);
  background: var(--paper-alt);
}

.place-3 .place-step {
  height: max(60px, 14cqh);
  background: var(--primary-hover);
}

.place-4 .place-step {
  height: max(44px, 9cqh);
}

.end-buttons {
  display: flex;
  gap: max(10px, 2cqh);
}

/* ---------------------------------------------------------------- error screen */
.error-screen {
  display: grid;
  place-items: center;
  z-index: 60;
}

.error-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: max(10px, 2cqh);
  width: min(92cqw, max(320px, 90cqh));
  padding: max(16px, 3.4cqh);
}

.error-panel h2 {
  margin: 0;
  font-size: max(20px, 4.6cqh);
  line-height: 1.1;
}

.error-panel p {
  margin: 0;
  color: var(--muted-on-paper);
  font: 500 max(13px, 2.4cqh) / 1.4 var(--body);
}

.error-details {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.error-details pre {
  flex: 1;
  max-height: 30cqh;
  margin: 0;
  padding: 10px;
  overflow: auto;
  border-radius: 10px;
  background: var(--ink);
  color: var(--paper);
  font: 12px / 1.4 ui-monospace, monospace;
  white-space: pre-wrap;
  user-select: text;
}

/* ---------------------------------------------------------------- settings dialog */
.setting-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: max(8px, 2cqh);
}

.setting-label b {
  display: block;
  font-size: max(15px, 3cqh);
  line-height: 1.1;
}

.setting-label span {
  display: block;
  margin-top: 3px;
  color: var(--muted-on-paper);
  font: 500 max(11px, 2.1cqh) / 1.35 var(--body);
}

.segmented {
  display: flex;
  overflow: hidden;
  border: 3px solid var(--ink);
  border-radius: 12px;
  box-shadow: 0 3px 0 var(--ink);
}

.segmented button {
  min-height: 44px;
  padding: 0 max(10px, 2cqh);
  border: 0;
  border-left: 2px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  font-size: max(13px, 2.6cqh);
  cursor: pointer;
}

.segmented button:first-child {
  border-left: 0;
}

.segmented button[aria-pressed='true'] {
  background: var(--highlight);
}

.switch {
  position: relative;
  width: max(54px, 10cqh);
  height: max(30px, 5.6cqh);
  min-height: 30px;
  padding: 0;
  border: 3px solid var(--ink);
  border-radius: 99px;
  background: var(--paper-alt);
  cursor: pointer;
}

.switch::before {
  content: '';
  position: absolute;
  inset: -8px;
}

.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(50% - 4px);
  aspect-ratio: 1;
  border: 2px solid var(--ink);
  border-radius: 50%;
  background: var(--white);
  transition: left 0.18s;
}

.switch[aria-checked='true'] {
  background: var(--highlight);
}

.switch[aria-checked='true']::after {
  left: calc(50% + 1px);
}

.setting-note {
  margin: 0;
  color: var(--muted-on-paper);
  font: 600 max(11px, 2cqh) / 1.3 var(--body);
}
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/screens.test.tsx`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  55 passed (55)` and `Tests  406 passed (406)`.

- [ ] **Step 6: Commit**

```bash
git add apps/client
git commit -m "feat(client): add matchmaking, the end podium, the error screen and settings

FINDING PLAYERS with the elapsed time and seats, Play with bots after
15 s, the bots taking their seats, MATCH FOUND and 3-2-1; final
standings on a podium with Play again and Main menu; the error screen
with the error text in dev builds; settings for quality (with the
level in use) and reduced motion (spec #2 §7.1, C7, §8).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: The app shell

**Files:**
- Create: `apps/client/src/app/fullscreen.ts`, `apps/client/src/app/App.tsx`, `apps/client/test/App.test.tsx`
- Modify: `apps/client/src/main.tsx`
- Delete: `apps/client/src/app/DevMatchPage.tsx`, `apps/client/src/app/dev.css`, `apps/client/src/app/devLog.ts`, `apps/client/test/DevMatchPage.test.tsx`, `apps/client/test/devLog.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 7–12.
- Produces: `isIOS(env)`, `wantsFullscreen(env)` and `App({ service, prefs, dev })`.

- [ ] **Step 1: Write the failing tests**

Create `apps/client/test/App.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';
import { wantsFullscreen } from '../src/app/fullscreen';
import { COUNT_MS } from '../src/app/MatchmakingOverlay';
import { createPrefsStore } from '../src/app/prefs';
import { BEAT_MS } from '../src/director/beats';
import type { MatchService } from '../src/service/matchService';
import { SEATS, openingUpdate } from './support/fixtures';
import { ScriptedMatchmaking, ScriptedSession } from './support/scripted';

const crash = vi.hoisted(() => ({ menu: false }));

// jsdom has no WebGL: stand both scenes in with labelled boxes.
vi.mock('../src/scene/MenuScene', async () => {
  const { createElement } = await import('react');
  return {
    MenuScene: ({ setting }: { setting: string }) => {
      if (crash.menu) throw new Error('menu exploded');
      return createElement('div', { role: 'img', 'aria-label': `Podium, ${setting}` });
    },
  };
});
vi.mock('../src/scene/MatchScene', async () => {
  const { createElement } = await import('react');
  return { MatchScene: () => createElement('div', { role: 'img', 'aria-label': 'Match board' }) };
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  crash.menu = false;
});

function setup(dev = false) {
  const made: ScriptedMatchmaking[] = [];
  const findMatch = vi.fn(() => {
    const matchmaking = new ScriptedMatchmaking();
    made.push(matchmaking);
    return matchmaking;
  });
  const service: MatchService = { findMatch };
  const prefs = createPrefsStore(null, { prefersReducedMotion: false, random: () => 0.5 });
  const { container } = render(<App service={service} prefs={prefs} dev={dev} />);
  return { findMatch, made, prefs, container };
}

/** PLAY, then the bots, MATCH FOUND and the countdown: the match screen with a scripted session. */
function startMatch(made: ScriptedMatchmaking[]) {
  fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
  const session = new ScriptedSession();
  made.at(-1)!.emit({ kind: 'found', session });
  act(() => vi.advanceTimersByTime(3 * COUNT_MS));
  session.update(openingUpdate());
  return session;
}

const rankings = [
  { player: 'p2', rank: 1, position: 100 },
  { player: 'p0', rank: 2, position: 87 },
  { player: 'p3', rank: 3, position: 60 },
  { player: 'p1', rank: 4, position: 41 },
];

function finish(session: ScriptedSession) {
  const { view } = openingUpdate();
  session.update({
    view: { ...view, round: 21, phase: { kind: 'finished', winner: 'p2', rankings }, awaiting: { windowId: 60, window: 'none', players: [], durationMs: 0 } },
    events: [{ type: 'MatchWon', winner: 'p2', rankings, visibility: 'public' }],
    timer: null,
  });
  act(() => vi.advanceTimersByTime(BEAT_MS.victory));
}

describe('App (spec #2 §4.1, §7.1)', () => {
  it('goes menu → matchmaking → match → end, and Play again goes back to matchmaking', () => {
    const { findMatch, made } = setup();
    expect(screen.getByRole('img', { name: 'Podium, auto' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    expect(findMatch).toHaveBeenCalledWith({ nickname: 'Guest5500', piece: 'knight' }, {});
    made[0]!.emit({ kind: 'searching', elapsedMs: 0, seats: [SEATS[0]!, null, null, null] });
    expect(screen.getByRole('dialog', { name: 'FINDING PLAYERS' })).toBeTruthy();
    const session = new ScriptedSession();
    made[0]!.emit({ kind: 'found', session });
    act(() => vi.advanceTimersByTime(3 * COUNT_MS));
    expect(screen.getByRole('img', { name: 'Match board' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: /Podium/ })).toBeNull();
    session.update(openingUpdate());
    finish(session);
    expect(screen.getByRole('heading', { name: 'Pip wins!' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(findMatch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('img', { name: 'Podium, auto' })).toBeTruthy();
  });

  it('goes back to the menu from the end screen', () => {
    const { made } = setup();
    const session = startMatch(made);
    finish(session);
    fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });

  it('returns to the menu when the search is cancelled', () => {
    const { made } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'PLAY' }));
    made[0]!.emit({ kind: 'searching', elapsedMs: 0, seats: [SEATS[0]!, null, null, null] });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(made[0]!.cancel).toHaveBeenCalled();
    made[0]!.emit({ kind: 'cancelled' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });

  it('shows the error screen when the match fails, and goes back to the menu', () => {
    const { made } = setup();
    const session = startMatch(made);
    session.fail('InvariantError: bad destination 104');
    expect(screen.getByRole('heading', { name: 'Something went wrong in this match' })).toBeTruthy();
    expect(session.leave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });

  it('leaves a match through the leave dialog', () => {
    const { made } = setup();
    const session = startMatch(made);
    fireEvent.click(screen.getByRole('button', { name: 'Leave match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(session.leave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });

  it('pauses the match while the page is hidden, and only in a match (C14)', () => {
    const { made } = setup();
    let hidden = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    const session = startMatch(made);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.pause).toHaveBeenCalledTimes(1);
    hidden = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(session.resume).toHaveBeenCalledTimes(1);
  });

  it('opens the settings from the menu, and applies quality and reduced motion', () => {
    const { container, prefs } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Low' }));
    expect(screen.getByRole('img', { name: 'Podium, low' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Reduced motion' }));
    expect(prefs.getState().settings.reducedMotion).toBe(true);
    expect(container.querySelector('.app')!.className).toContain('reduced-motion');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
  });

  it('catches a crash with the error screen, with the error text in dev builds', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    crash.menu = true;
    setup(true);
    expect(screen.getByRole('heading', { name: 'Something went wrong in this match' })).toBeTruthy();
    expect(screen.getByText(/menu exploded/)).toBeTruthy();
    crash.menu = false;
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeTruthy();
  });
});

describe('fullscreen on the first tap (spec #2 §7.3)', () => {
  const android = { pointerType: 'touch', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7)', platform: 'Linux armv8l', maxTouchPoints: 5, fullscreenEnabled: true, inFullscreen: false };

  it('asks on a touch tap where the browser supports it', () => {
    expect(wantsFullscreen(android)).toBe(true);
    expect(wantsFullscreen({ ...android, fullscreenEnabled: false })).toBe(false);
    expect(wantsFullscreen({ ...android, inFullscreen: true })).toBe(false);
  });

  it('never asks on iPhones and iPads, or for mouse clicks', () => {
    expect(wantsFullscreen({ ...android, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).toBe(false);
    expect(wantsFullscreen({ ...android, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel' })).toBe(false);
    expect(wantsFullscreen({ ...android, pointerType: 'mouse' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run apps/client/test/App.test.tsx`
Expected: FAIL with `Failed to resolve import "../src/app/App"`.

- [ ] **Step 3: Build the shell and retire the dev page**

Create `apps/client/src/app/fullscreen.ts`:

```ts
// Fullscreen on the first tap where supported (spec #2 §7.3): Android browsers, never iOS Safari.

export interface FullscreenEnv {
  /** The first tap's pointer: only touch asks; a desktop click never does. */
  pointerType: string;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  fullscreenEnabled: boolean;
  inFullscreen: boolean;
}

/** iPhones and iPods, and iPads, which report a Mac platform with touch points. */
export function isIOS(env: Pick<FullscreenEnv, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  return /iPhone|iPad|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
}

export function wantsFullscreen(env: FullscreenEnv): boolean {
  return env.pointerType === 'touch' && !isIOS(env) && env.fullscreenEnabled && !env.inFullscreen;
}
```

Create `apps/client/src/app/App.tsx`:

```tsx
import type { Ranking } from '@laddorious/core';
import { Component, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { FindOptions, Matchmaking, MatchService, MatchSession } from '../service/matchService';
import { RotateScreen } from '../ui/RotateScreen';
import { EndScreen } from './EndScreen';
import { ErrorScreen } from './ErrorScreen';
import { wantsFullscreen } from './fullscreen';
import { MatchmakingOverlay } from './MatchmakingOverlay';
import { MatchScreen } from './MatchScreen';
import { MenuScreen } from './MenuScreen';
import type { PrefsState } from './prefs';
import { SettingsDialog } from './SettingsDialog';

/** Where the player is (spec #2 §4.1): the screens and what each one holds. */
type Route =
  | { screen: 'menu' }
  | { screen: 'matchmaking'; matchmaking: Matchmaking }
  | { screen: 'match'; session: MatchSession }
  | { screen: 'end'; session: MatchSession; rankings: Ranking[] }
  | { screen: 'error'; message: string };

interface AppProps {
  service: MatchService;
  prefs: StoreApi<PrefsState>;
  /** Dev builds: the seed field, the stats overlay and error details. */
  dev: boolean;
}

/**
 * The app shell (spec #2 §4.1, §7.1): menu → matchmaking (over the menu scene) → match → end
 * (over the dimmed board), plus the error screen, the settings dialog and the rotate screen.
 * It pauses a local match while the page is hidden (C14) and asks for fullscreen on the first
 * touch where the browser allows it (§7.3).
 */
export function App({ service, prefs, dev }: AppProps) {
  const [route, setRoute] = useState<Route>({ screen: 'menu' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [crashes, setCrashes] = useState(0);
  const settings = useStore(prefs, (s) => s.settings);
  const tappedRef = useRef(false);

  // A hidden page pauses the local match, and it resumes on return (C14).
  const playing = route.screen === 'match' ? route.session : null;
  useEffect(() => {
    if (!playing) return;
    const onVisibility = () => (document.hidden ? playing.pause() : playing.resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [playing]);

  const toMenu = () => setRoute({ screen: 'menu' });
  const play = (opts: FindOptions = {}) => setRoute({ screen: 'matchmaking', matchmaking: service.findMatch(prefs.getState().profile, opts) });
  const session = route.screen === 'match' || route.screen === 'end' ? route.session : null;

  let screen: ReactNode;
  switch (route.screen) {
    case 'menu':
    case 'matchmaking':
      screen = (
        <>
          <MenuScreen prefs={prefs} onPlay={play} onSettings={() => setSettingsOpen(true)} showSeed={dev} />
          {route.screen === 'matchmaking' && (
            <MatchmakingOverlay matchmaking={route.matchmaking} onCancelled={toMenu} onReady={(s) => setRoute({ screen: 'match', session: s })} />
          )}
        </>
      );
      break;
    case 'match':
    case 'end': {
      const { session: current } = route;
      screen = (
        <>
          <MatchScreen
            session={current}
            quality={settings.quality}
            reducedMotion={settings.reducedMotion}
            showStats={dev}
            onLeave={toMenu}
            onFailed={(message) => {
              current.leave();
              setRoute({ screen: 'error', message });
            }}
            onFinished={(rankings) => setRoute({ screen: 'end', session: current, rankings })}
          />
          {route.screen === 'end' && (
            <EndScreen
              rankings={route.rankings}
              seats={current.seats}
              me={current.me}
              onPlayAgain={() => {
                current.leave();
                play();
              }}
              onMenu={() => {
                current.leave();
                toMenu();
              }}
            />
          )}
        </>
      );
      break;
    }
    case 'error':
      screen = <ErrorScreen message={route.message} showDetails={dev} onMenu={toMenu} />;
      break;
  }

  const firstTap = (e: ReactPointerEvent) => {
    if (tappedRef.current) return;
    tappedRef.current = true;
    const env = {
      pointerType: e.pointerType,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      fullscreenEnabled: document.fullscreenEnabled,
      inFullscreen: document.fullscreenElement !== null,
    };
    if (wantsFullscreen(env)) document.documentElement.requestFullscreen().catch(() => {});
  };

  return (
    <div className={settings.reducedMotion ? 'app reduced-motion' : 'app'} onPointerDownCapture={firstTap}>
      <CrashBoundary
        key={crashes}
        dev={dev}
        onMenu={() => {
          session?.leave();
          setRoute({ screen: 'menu' });
          setCrashes((c) => c + 1);
        }}
      >
        {screen}
        {settingsOpen && <SettingsDialog prefs={prefs} onClose={() => setSettingsOpen(false)} />}
      </CrashBoundary>
      <RotateScreen />
    </div>
  );
}

interface CrashBoundaryProps {
  dev: boolean;
  onMenu: () => void;
  children: ReactNode;
}

/** Any crash while drawing the screens shows the error screen (spec #2 §4.1, §8). */
class CrashBoundary extends Component<CrashBoundaryProps, { error: unknown }> {
  override state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown): { error: unknown } {
    return { error };
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    return <ErrorScreen message={message} showDetails={this.props.dev} onMenu={this.props.onMenu} />;
  }
}
```

Replace `apps/client/src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { browserStorage, createPrefsStore } from './app/prefs';
import { LocalMatchService } from './service/localMatchService';
import './app/theme.css';
import './app/base.css';
import './ui/ui.css';
import './hud/hud.css';
import './hud/popups.css';
import './app/match.css';
import './app/menu.css';
import './app/screens.css';

const service = new LocalMatchService(
  () => new Worker(new URL('./worker/host.worker.ts', import.meta.url), { type: 'module' }),
);
const prefs = createPrefsStore(browserStorage(), {
  prefersReducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App service={service} prefs={prefs} dev={import.meta.env.DEV} />
  </StrictMode>,
);
```

Delete the dev page and its files:

```bash
git rm -q apps/client/src/app/DevMatchPage.tsx apps/client/src/app/dev.css apps/client/src/app/devLog.ts apps/client/test/DevMatchPage.test.tsx apps/client/test/devLog.test.ts
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm vitest run apps/client/test/App.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 5: Run the full gate**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

Run: `pnpm test 2>&1 | grep -E "Test Files|Tests "`
Expected: `Test Files  54 passed (54)` and `Tests  406 passed (406)`.

Run: `pnpm build 2>&1 | grep -E "built|error"`
Expected: `✓ built` (a chunk-size warning for three.js is expected).

- [ ] **Step 6: Commit**

```bash
git add -A apps/client
git commit -m "feat(client): route the screens through the app shell

Menu, matchmaking over the menu scene, the match, the end podium over
the dimmed board and the error screen, with an error boundary, the
settings dialog and the rotate screen; a hidden page pauses the match,
and the first touch asks for fullscreen except on iOS (spec #2 §4.1,
§7.1, §7.3, C14). The dev page and its files are gone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Phase gate and handoff

**Files:**
- Modify: `README.md`, `docs/superpowers/HANDOFF.md`
- Local only: the project memory (`handoff.md`, `phase5-prototype-method.md`, `MEMORY.md`)

- [ ] **Step 1: Run the whole gate from a clean install**

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test 2>&1 | grep -E "Test Files|Tests "
pnpm build 2>&1 | grep -E "built|error"
git status --short
```

Expected: no errors; `Test Files  54 passed (54)` and `Tests  406 passed (406)`; `✓ built`; only `.claude/` untracked.

- [ ] **Step 2: Play the game in the browser**

Start the `client` preview entry and open http://localhost:5173. Expected:

- **Menu:**
  - the podium with your piece and your name on its plate, floating tiles and clouds;
  - the profile chip (rename works and persists after a reload), the logo, the gear, the piece picker and arrows, PLAY with "4-player match", and a TIP;
  - on a 390 px tall window, the tip is hidden.
- **Matchmaking:** FINDING PLAYERS with the time counting; Play with bots after 15 s; the bots take their seats; MATCH FOUND! and 3-2-1.
- **Match:**
  - the board with the stage bar, feed, player column, your-piece panel and ROLL, and the start row visible above the dock;
  - name tags over the pieces, which face along their row;
  - ROLL rolls once; Space rolls on desktop;
  - face-offs and Mystery picks open the popups for you; others show a waiting pill;
  - tapping a row watches that piece, and Back to my piece returns;
  - the leave dialog works.
- **End:** the podium with Play again (back to matchmaking) and Main menu.
- **Settings:** Low drops the shadows, Reduced motion stops the turntable and the drift.
- **Phone shapes:** a portrait window shows "Turn your phone sideways"; a 390 px tall landscape window keeps 3 feed lines and starts with the your-piece panel collapsed.
- **Console:** no errors, and no "presentation drifted" warning.

- [ ] **Step 3: Update the README and the handoff note**

In `README.md`, replace the `apps/client` row of the package table with:

```markdown
| `apps/client` | `@laddorious/client` | The web client (Vite, React, React Three Fiber): the main menu, matchmaking, a 4-player match against the simulator's bots in 3D with the full HUD, and the end screen. The engine and bots run in a Web Worker behind the `MatchService` interface. |
```

In `docs/superpowers/HANDOFF.md`:

1. Change the title to `# Handoff — 3D client, after Phase 5`, and add "and at the end of Phase 5" to the `**Written:**` line.
2. Change the Phase 5 row to: **done**, merged locally at the end of the phase, citing this plan and the commits listed by `git log --oneline main..client/phase-5`.
3. Give the suite size after Phase 5: `Test Files  54 passed (54)` and `Tests  406 passed (406)`. Say that `pnpm typecheck`, `pnpm lint` and `pnpm build` are clean.
4. Replace the "Next step" section with **Phase 6: end-to-end tests, CI and docs** (spec §9.3–§9.5, §10). Cover:
   - Playwright on desktop Chromium plus emulated landscape iPhone 12 and Pixel 7, using a `window.__laddoriousTest` hook (test builds only) that speeds up animations, auto-picks for the human seat and shortens windows;
   - the portrait check;
   - the ≤ 100 draw-call check, read from `src/scene/stats.ts`;
   - CI with the build and the Playwright run;
   - READMEs for the root, the client (Cloudflare Pages deploy step by step, with Netlify and Vercel notes; phone testing; asset slots; the dev overlay and seed field), `packages/core` and `packages/bots`.

   Keep the standing-order paragraph.
5. Remove the prototype paragraphs (the method, where the prototype lives, the task table). The prototype is done.
6. Under "Repository facts", add a **Screens** bullet:
   - `src/app/App.tsx` routes the screens;
   - `src/hud/model.ts` and its neighbours are the pure HUD model;
   - `test/tokens.test.ts` fails on any colour outside the theme files;
   - `test/support/scripted.ts` drives sessions in component tests.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/HANDOFF.md
git commit -m "docs: hand off after phase 5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Update the project memory**

- In `handoff.md`, set the state to: "Phases 1-5 are done and merged to `main` locally. The next step is Phase 6 (end-to-end tests, CI and docs)."
- In `phase5-prototype-method.md`, note that Phase 5 is done and the prototype was retired.
- In `MEMORY.md`, update both index lines to match.

After Task 14:

1. Self-review the whole branch against §7, §8, §9.2 and this plan's Review Focus, and say it was a self-review.
2. Merge `client/phase-5` into `main` locally (fast-forward), and confirm the suite on `main`.
3. Delete the branch, the scratch prototype's backup (`.superpowers/p5-backup/`) and the `client-proto` launch entry.
4. Start Phase 6.
