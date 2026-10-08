import type { PlayerId } from '@laddorious/core';
import { useEffect, useRef, useState } from 'react';
import type { Director } from '../director/director';
import { DieFace } from '../ui/DieFace';

/** How long my roll stays in the centre, and how fast it tumbles (polish spec §4.2). Times scale with the director. */
export const CENTER_DIE = { holdMs: 1600, fadeMs: 250, moveMs: 1200, tumbleStepMs: 80 } as const;

interface Roll {
  face: number;
  forced: boolean;
  startedAt: number;
  rollMs: number;
}

/**
 * My own roll, big in the centre of the screen (polish spec §4.2): it tumbles for the roll beat,
 * lands on my face, holds, then fades. When a card makes my total differ from the face (Overdrive,
 * extra dice), "Move N" shows once the total arrives, which may be a later update than the roll.
 * Other players' dice stay above their pieces.
 */
export function CenterDie({ director, me, reducedMotion, timeScale = 1 }: { director: Director; me: PlayerId; reducedMotion: boolean; timeScale?: number }) {
  const [roll, setRoll] = useState<Roll | null>(null);
  const [move, setMove] = useState<{ total: number; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const faceRef = useRef<number | null>(null);

  useEffect(
    () =>
      director.store.subscribe((state, prev) => {
        // The roll has a beat of its own; the total comes in an instant beat, which only reaches the log.
        const beat = state.beat;
        if (beat && beat !== prev.beat) {
          const mine = beat.events.find((e) => e.type === 'DieRolled' && e.player === me);
          if (mine?.type === 'DieRolled') {
            faceRef.current = mine.face;
            setRoll({ face: mine.face, forced: mine.forced, startedAt: beat.startedAt, rollMs: beat.durationMs });
            setMove(null);
            setNow(Date.now());
          }
        }
        if (state.log === prev.log) return;
        const after = prev.log.at(-1)?.seq ?? 0;
        for (const { seq, event } of state.log) {
          if (seq > after && event.type === 'DiceTotaled' && event.player === me && event.total !== faceRef.current) {
            setMove({ total: event.total, at: Date.now() });
            setNow(Date.now());
          }
        }
      }),
    [director, me],
  );

  const dieEnds = roll ? roll.startedAt + (CENTER_DIE.holdMs + CENTER_DIE.fadeMs) * timeScale : 0;
  const moveEnds = move ? move.at + CENTER_DIE.moveMs * timeScale : 0;
  const ends = Math.max(dieEnds, moveEnds);

  // Tick while anything is up: the tumble's faces, the fade, and the exits.
  useEffect(() => {
    if (ends === 0) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= ends) {
        setRoll(null);
        setMove(null);
      }
    }, CENTER_DIE.tumbleStepMs);
    return () => clearInterval(id);
  }, [ends]);

  const shown = roll !== null && now < dieEnds ? roll : null;
  const note = move !== null && now < moveEnds ? move : null;
  if (!shown && !note) return null;

  const tumbling = shown !== null && !reducedMotion && now < shown.startedAt + shown.rollMs;
  const leaving = shown !== null && note === null && now >= shown.startedAt + CENTER_DIE.holdMs * timeScale;
  const step = shown ? Math.max(0, Math.floor((now - shown.startedAt) / CENTER_DIE.tumbleStepMs)) : 0;
  const face = shown ? (tumbling ? ((shown.face + step) % 6) + 1 : shown.face) : 0;

  return (
    <div className={leaving ? 'center-die leaving' : 'center-die'} role="status" aria-label={shown ? `You rolled ${shown.face}` : `Move ${note?.total ?? 0}`}>
      {shown && <DieFace face={face} forced={shown.forced && !tumbling} className={tumbling ? 'tumbling' : 'landed'} />}
      {shown?.forced && !tumbling && <span className="center-die-badge display">Forced</span>}
      {note && <span className="center-die-move display">Move {note.total}</span>}
    </div>
  );
}
