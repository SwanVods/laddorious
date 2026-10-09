# Sound design (Spec #3) — design

**Status:** approved in conversation 2026-10-09; this file awaits the user's review.
**Comes after:** Spec #2 and its polish pass. **Comes before:** Spec #4 (multiplayer server), then Spec #5 (Blender art). The roadmap was renumbered on 2026-10-08 (spec #2 §1.2).
**Approved sounds:** the sound board artifact (<https://claude.ai/artifact/LNFAcQrDMtGxDvzTJDxfBt>), kept in the repo as [`2026-10-09-sound-board.html`](2026-10-09-sound-board.html). Its recipes, level trims and songs are the reference for this spec. The user listened and approved them as they are.

---

## 1. What this delivers

Sound effects and music for the whole client: the menu, matchmaking, every moment of a match, and the end screen. Claude made every sound in code; nothing is recorded.

Success means:

- every important moment has a sound that says what happened, even when you are looking at another part of the screen;
- your own moments stand out, and other players' are softer;
- nothing becomes annoying over a 20-round match;
- it works on phones (audio starts on the first tap), never breaks the game, and can be muted at once.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| A1 | Sounds are synthesised in code. There are no audio files. | User's choice: one consistent toy palette, a tiny download, tweakable numbers. |
| A2 | **Tone.js 15.1.22** for synths, effects and the music transport. | User's choice over plain Web Audio, for faster development. |
| A3 | Tone loads as its own chunk on the first tap (dynamic `import('tone')`). | Phones allow audio only after a tap anyway, and startup stays as light as today (~100 KB compressed kept out of the first load). |
| A4 | Effects plus a light music loop: the menu loop and a calmer match loop. Music has its own volume and ducks under big moments. | User's choice. |
| A5 | Mood: a toy box with cartoon accents. Marimba, wood knocks, a dice rattle and felt thumps; a slide whistle into snakes, a boing on launch pads, chime fanfares. | User's choice; it matches the board-game pieces. |
| A6 | Your own moments play at full level. Other players' moments go through a bus 7 dB lower. | So your moments stand out in a four-player match. |
| A7 | Each sound plays on its own short-lived Tone instruments, cleaned up a few seconds after the sound's start time. | Tone refuses a note scheduled before one it has already scheduled, so instruments shared across sounds scheduled ahead (hop knocks) would throw. Found while building the board. |
| A8 | Each sound has a level trim, measured offline, so sounds sit in tiers by their loudest 300 ms: big moments about −20 dBFS, core feedback −24, prompts −26, buttons and other players' small sounds −28 to −30. A −1 dB limiter guards the output. | Measured on the board: before trimming, prompts were 20 dB quieter than the launch pad. |

## 3. Architecture (`apps/client/src/audio/`)

| File | What it does |
|---|---|
| `engine.ts` | `AudioEngine`. Loads Tone on `start()` (only once, through an injectable loader so tests use a fake). Builds the buses: output → limiter (−1 dB) → reverb (decay 1.4 s, wet 0.16) → effects bus and music bus; the "others" bus is 7 dB under the effects bus. Exposes `play(cue)`, `music(song \| null)`, `duck(seconds)`, `setSound(settings)`, `suspend()` / `resume()`, and `stats()` (started, played, errors). Before `start()`, while muted, or if Tone failed to load, every call does nothing. Each play is wrapped: an error is counted, warned once in dev builds, and never thrown. |
| `sounds.ts` | The 42 recipes from the board as typed functions `(tone, out, t, arg?) => seconds`, with the `SoundId` union, the instrument helpers (wood, click, marimba, bell, thump, noise, glide, metal) and `TRIM`. It imports Tone's types only, so it loads in tests without Tone. |
| `music.ts` | The two songs as data (bpm, chords per bar, arpeggio, bass, tune, kick) and the player: one `Tone.Part` looping on the transport, a 0.8 s fade in, switching songs by stopping and rebuilding the part, and ducking by ramping the music bus. |
| `cues.ts` | Pure mapping from what happened to sounds: `cuesForBeat(beat, ctx)` and `cuesForLog(entries, ctx)` return `Cue[]`, where `Cue = { id: SoundId; atMs: number; soft: boolean; arg?: number }`. `ctx` holds `me`, `timeScale` and my last face. Fully unit-tested. |
| `SoundProvider.tsx` | React context holding the engine; `useSound()` returns it. It also wires the first-tap unlock (pointerdown or keydown, once), suspends while the page is hidden, applies the sound settings, and plays the default button click (§5). |
| `useMatchSound.ts` | Subscribes to the director store (beats and new log entries), turns them into cues, and plays each at `now + atMs × timeScale`. It also handles the dice-window prompt (D1) and the last-seconds ticks (D4). |

`main.tsx` creates one `AudioEngine` and wraps `<App>` in `<SoundProvider>`. Screens call `useSound()` for their own moments (popups opening, the piece picker, matchmaking steps).

## 4. Settings

- `Settings` gains `sound: { muted: boolean; effects: number; music: number }`. Volumes run 0 to 1. Defaults: `{ muted: false, effects: 0.8, music: 0.6 }`. They persist with the other settings, and bad stored values fall back to the defaults.
- Volume to level: `level dB = 20·log10(v)`, floored at −60 dB for 0. The effects bus sits at −2 dB plus that level, the music bus at −4 dB plus that level (the board's tuned defaults at volume 1).
- **Settings dialog:** a new "Sound" group with a **Mute** switch and **Effects** and **Music** sliders (range inputs with visible labels, 44 px tall).
- **In a match:** a speaker button beside the menu button toggles mute (`aria-label` "Mute sound" / "Turn sound on", 44 px). Its icon is a new `speaker` / `speaker-off` pair in the icon set.
- While muted, Tone is not loaded at all. Unmuting after the first tap loads it.

## 5. What plays when

"Soft" means the other players' bus (A6): the sound is about someone who is neither me, the caster nor the target. Times scale with the director's time scale.

**Menu, buttons and matchmaking**

| When | Sound |
|---|---|
| Any button tap | **U1**. `SoundProvider` listens for clicks on buttons and plays U1, unless the button has `data-sound="none"` or names another sound in `data-sound` (the buttons below that have their own). |
| Choosing a piece (picker or arrows) | **U2** with the piece's note (knight C5, pawn E5, meeple G5, dragon C6) |
| A settings switch | **U3**: on, or off |
| A refused action (the rejection toast) | **U4** |
| A bot takes a seat | **Q1**, pitched for seat 1, 2 or 3 |
| MATCH FOUND | **Q2** |
| The 3-2-1 countdown starts | **Q3** (it plays all three ticks and the whoosh in time with the 750 ms count) |

**Dice**

| When | Sound |
|---|---|
| A dice window opens for me and its countdown starts | **D1** |
| `roll` beat, my `DieRolled` | **D2**; if `forced`, **D5** at the landing (+0.85 s) |
| `roll` beat, another player's `DieRolled` | **D3**, soft, staggered 60 ms apart |
| The last 3 seconds of a window that awaits me and where I haven't acted | **D4**, one tick per second |
| My `DiceTotaled` total differs from my face | **D6** if larger, **D7** if smaller |

**Moving** (one cue set per beat; several movers share one knock per step)

| Beat | Sound |
|---|---|
| `move` | **H1** knocks per tile step at `hopPerTile`, rising, for the longest move; then **H2** at the end. **H3** instead of H2 when a mover ends on top of another piece. Soft when I'm not moving. |
| `cardMove` | The same knocks, spread over the beat (rising forward, falling backward), then **H2** |
| `slide` | **S1** (soft unless it's my piece) |
| `launch` | **L1** |
| `knockback` | **K1** |
| `stepBack` | **B1**, one knock per tile |
| `snakeBlocked` | **B2** |
| My `MysteryOffered` (from the log) | **B3** |

**Face-offs**

| When | Sound |
|---|---|
| `faceOff` beat | **F1**, and the music ducks for 1.2 s |
| I lock a pick | **F2** (the choice buttons' own sound) |
| `faceOffResult`: I win | **F3** |
| `faceOffResult`: I lose | **F4** |
| `faceOffResult`: a replay that includes me | **F5** |
| `faceOffResult` I'm not in | nothing; the feed and banner cover it |

**Cards**

| When | Sound |
|---|---|
| My card pick opens | **C1** |
| Reroll / pick | **C2** / **C3** (the buttons' own sounds) |
| `cardReveal` beat | **C4**, one flip per revealed card |
| `cardResolved`: hit / blocked / fizzled | **C5** / **B2** / **C6**; soft unless I'm the caster or the target |
| `clash` beat | **C7** |
| `boardEdit` beat: created / expired | **C8** / **C9** |
| An `EffectAdded` on me | **C10** |

**Finish**

| When | Sound |
|---|---|
| `victory` beat, I won | **W1**; the music fades out over 1 s |
| `victory` beat, someone else won | **W2**; the music fades out |
| `ranks` beat | **W3**: one pop per badge, at the badges' own delays, pitched by rank (4th C5, 3rd E5, 2nd G5) |
| The end screen appears | **W4** |

## 6. Music

- **Menu loop** (menu and matchmaking): 104 bpm, C–Am–F–G twice over 8 bars. A marimba arpeggio in eighths, a triangle bass on beats 1 and 3, a soft kick on 1 and 3, a shaker on the off-beats, and a short bell tune.
- **Match loop** (in a match): 88 bpm, Fmaj7–Em7–Dm7–G7 twice. A sparse marimba, a soft pad, bass, a very soft shaker, and no kick.
- Crossfade between them over 0.8 s. The music ducks 12 dB under F1 and fades out at the win. After the end screen it resumes with the next screen (menu, or matchmaking after Play again).

## 7. Phones, pausing and errors

- **First tap:** the first pointerdown or keydown anywhere starts the engine (when not muted). Cues before that are dropped, not queued.
- **Hidden page:** the audio context suspends while the page is hidden and resumes when it is shown, alongside the match pause the app already does.
- **Errors:** if Tone fails to load, sound stays off for the session and the game runs on. A recipe error is caught, counted and never reaches React.
- **Reduced motion** doesn't change sound; mute is separate.
- **E2e builds:** sound stays on. The test hook gains `soundStats()`, and the Playwright match test asserts the engine started, played sounds and recorded no errors.

## 8. Testing

- **`cues.test.ts`:** every row of §5, with timings, soft flags, the merged knocks for several movers, the stacked landing, the timeScale, the ranks delays and the log-driven cues (B3, D6/D7, C10).
- **`engine.test.ts`** (with a fake Tone loader):
  - start loads Tone once;
  - nothing plays before start or while muted;
  - settings map to the right dB;
  - suspend and resume follow the page's visibility;
  - a throwing recipe is counted, not thrown;
  - a failed load leaves sound off.
- **`sounds.test.ts`:** every `SoundId` has a recipe and a trim, and the codes match the board's.
- **`music.test.ts`:** the event list each song builds (bars, steps, times), without Tone.
- **Prefs and dialog tests:** the defaults, persistence, rejecting bad stored values, the mute switch and sliders.
- **Screen tests:** the speaker button toggles mute; C1 when the card pick opens; U4 on a rejection; W4 on the end screen; the buttons' `data-sound` overrides.
- **E2e:** `soundStats()` after a whole match: started, played > 0, errors 0.
- **Build:** the main chunk doesn't grow by Tone; Tone is its own chunk.

## 9. Out of scope

- Recorded samples, voice lines and spatial (left/right) panning.
- A unique sound per card (cards share the C-group sounds).
- Haptics on phones, and sound for the menu podium's idle spin.
- Per-player music or a music track selector.
