import type { PlayerId } from '@laddorious/core';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { Director } from '../director/director';
import { MatchScene } from '../scene/MatchScene';
import type { QualitySetting } from '../scene/quality';
import { renderStats } from '../scene/stats';
import type { Matchmaking, MatchmakingState, MatchService, MatchSession, MatchUpdate, Profile, SeatInfo } from '../service/matchService';
import { formatEvent } from './devLog';

/** "Play with bots" appears once a search has run this long (spec #2 C7). */
export const PLAY_WITH_BOTS_AFTER_MS = 15_000;

const PROFILE: Profile = { nickname: 'You', piece: 'knight' };
const LOG_TAIL = 40;

/**
 * The dev page: matchmaking, then a bot match played in 3D with a minimal ROLL button,
 * the event log, the window timer and the final rankings. Phase 5 replaces it with the real screens.
 */
export function DevMatchPage({ service }: { service: MatchService }) {
  const [matchmaking, setMatchmaking] = useState<Matchmaking | null>(null);
  const [mm, setMm] = useState<MatchmakingState | null>(null);
  const [director, setDirector] = useState<Director | null>(null);
  const [quality, setQuality] = useState<QualitySetting>('auto');
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
          <div className="row">
            <RollButton director={director} session={session} />
            <label className="quality">
              Quality
              <select value={quality} onChange={(e) => setQuality(e.target.value as QualitySetting)}>
                <option value="auto">Auto</option>
                <option value="low">Low</option>
                <option value="high">High</option>
              </select>
            </label>
            <button type="button" onClick={leave}>
              Leave
            </button>
          </div>
          {import.meta.env.DEV && <DevStats />}
        </section>
      )}
      {session && director && <MatchScene key={quality} director={director} seats={session.seats} me={session.me} setting={quality} showStats={import.meta.env.DEV} />}
      {log.length > 0 && <pre className="log">{log.slice(-LOG_TAIL).join('\n')}</pre>}
    </main>
  );
}

/** A minimal ROLL button: shown in my dice window, pressed once per window. */
function RollButton({ director, session }: { director: Director; session: MatchSession }) {
  const settled = useStore(director.store, (s) => s.settled);
  const [rolledIn, setRolledIn] = useState(-1);
  const aw = settled?.view.awaiting;
  if (!aw || aw.window !== 'dice' || !aw.players.includes(session.me) || rolledIn === aw.windowId) return null;
  return (
    <button
      type="button"
      className="primary roll"
      onClick={() => {
        session.send({ type: 'roll' });
        setRolledIn(aw.windowId);
      }}
    >
      ROLL
    </button>
  );
}

/** Frame rate, draw calls and triangles (dev builds only, spec #2 §6.4). */
function DevStats() {
  const { fps, calls, triangles } = useStore(renderStats);
  return <p className="dev-stats">{`${fps} fps · ${calls} draw calls · ${(triangles / 1000).toFixed(1)}k triangles`}</p>;
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
