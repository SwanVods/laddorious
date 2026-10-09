import type { PlayerId } from '@laddorious/core';
import { useEffect } from 'react';
import type { Director } from '../director/director';
import { cuesForBeat, cuesForLog } from './cues';
import type { Cue } from './engine';
import { useSound } from './SoundProvider';

/** The last seconds of a window that waits for me tick once a second (spec #3 §5). */
export const TICK_WINDOW_S = 3;

/**
 * A match's sounds (spec #3 §5): each beat's cues as it starts, the log's zero-length events,
 * the dice-window chime, and the last-seconds ticks. Times follow the director's time scale.
 */
export function useMatchSound(director: Director, me: PlayerId, boardSize: number, timeScale: number): void {
  const engine = useSound();
  useEffect(() => {
    let myFace: number | null = null;
    let chimed = -1;
    let tickWindow = -1;
    let lastTick = 0;
    const scaled = (c: Cue): Cue => ({ ...c, atMs: c.atMs * timeScale, ...(c.duck === undefined ? {} : { duck: c.duck * timeScale }) });

    const off = director.store.subscribe((state, prev) => {
      if (state.beat && state.beat !== prev.beat) {
        for (const e of state.beat.events) if (e.type === 'DieRolled' && e.player === me) myFace = e.face;
        for (const c of cuesForBeat(state.beat, { me, boardSize })) engine.play(scaled(c));
      }
      if (state.log !== prev.log) {
        const after = prev.log.at(-1)?.seq ?? 0;
        for (const c of cuesForLog(state.log.filter((l) => l.seq > after), me, myFace)) engine.play(scaled(c));
      }
      const timer = state.settled?.timer;
      const aw = state.settled?.view.awaiting;
      if (timer && aw?.window === 'dice' && aw.players.includes(me) && timer.windowId !== chimed) {
        chimed = timer.windowId;
        engine.playNow('D1');
      }
    });

    const ticker = setInterval(() => {
      const settled = director.store.getState().settled;
      const timer = settled?.timer;
      const aw = settled?.view.awaiting;
      if (!timer || !aw || !aw.players.includes(me)) return;
      if (timer.windowId !== tickWindow) {
        tickWindow = timer.windowId;
        lastTick = 0;
      }
      const left = Math.ceil((timer.endsAt - Date.now()) / 1000);
      if (left >= 1 && left <= TICK_WINDOW_S && left !== lastTick) {
        lastTick = left;
        engine.playNow('D4');
      }
    }, 200);

    return () => {
      off();
      clearInterval(ticker);
    };
  }, [director, engine, me, boardSize, timeScale]);
}
