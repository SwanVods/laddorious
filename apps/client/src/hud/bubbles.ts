import type { PlayerId } from '@laddorious/core';
import { useEffect, useState } from 'react';
import type { Director, PlayingBeat } from '../director/director';

// Card bubbles (polish spec §4.4): when the cards flip, a one-line bubble with the card's gist
// pops out beside each caster's row in the player column and stays until their card has played out.

/** How long a bubble lingers after its card's beat ends, before the director's time scale. */
export const BUBBLE_LINGER_MS = 800;

export interface Bubble {
  cardId: string;
  /** When it leaves; null while its card is still to resolve. */
  leaveAt: number | null;
}

export type Bubbles = Readonly<Record<PlayerId, Bubble>>;

/** The bubbles after a new beat starts, or after the timeline ends (`beat` null). */
export function bubbleStep(bubbles: Bubbles, beat: PlayingBeat | null, nowMs: number, timeScale: number): Bubbles {
  const linger = BUBBLE_LINGER_MS * timeScale;
  if (!beat) {
    // The timeline is over: anything still waiting (a resolution that never played) goes too.
    return Object.fromEntries(Object.entries(bubbles).map(([id, b]) => [id, b.leaveAt === null ? { ...b, leaveAt: nowMs + linger } : b]));
  }
  if (beat.kind === 'victory') return {};
  const next: Record<PlayerId, Bubble> = { ...bubbles };
  for (const e of beat.events) {
    if (beat.kind === 'cardReveal' && e.type === 'CardSelected') next[e.player] = { cardId: e.cardId, leaveAt: null };
    if (beat.kind === 'cardResolved' && e.type === 'CardResolved' && next[e.caster]) {
      next[e.caster] = { ...next[e.caster]!, leaveAt: beat.startedAt + beat.durationMs + linger };
    }
  }
  return next;
}

/** The bubbles still up at `nowMs`. */
export function visibleBubbles(bubbles: Bubbles, nowMs: number): Bubbles {
  return Object.fromEntries(Object.entries(bubbles).filter(([, b]) => b.leaveAt === null || nowMs < b.leaveAt));
}

/** The bubbles up right now, following the director's beats. */
export function useCardBubbles(director: Director, timeScale: number): Bubbles {
  const [bubbles, setBubbles] = useState<Bubbles>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(
    () =>
      director.store.subscribe((state, prev) => {
        if (state.beat === prev.beat) return;
        const t = Date.now();
        setBubbles((b) => bubbleStep(b, state.beat, t, timeScale));
        setNow(t);
      }),
    [director, timeScale],
  );

  // Wake up when the next bubble is due to leave.
  const next = Math.min(...Object.values(bubbles).map((b) => b.leaveAt ?? Infinity));
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const id = setTimeout(() => {
      setNow(Date.now());
      setBubbles((b) => visibleBubbles(b, Date.now()));
    }, Math.max(0, next - Date.now()));
    return () => clearTimeout(id);
  }, [next]);

  return visibleBubbles(bubbles, now);
}
