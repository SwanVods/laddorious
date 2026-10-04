import type { PlayerId } from '@laddorious/core';
import { useEffect, useState } from 'react';
import type { Matchmaking, MatchmakingState, MatchService, MatchSession, MatchUpdate, Profile, SeatInfo } from '../service/matchService';
import { formatEvent } from './devLog';

/** "Play with bots" appears once a search has run this long (spec #2 C7). */
export const PLAY_WITH_BOTS_AFTER_MS = 15_000;

const PROFILE: Profile = { nickname: 'You', piece: 'knight' };
const LOG_TAIL = 40;

/**
 * Phase 2's dev page: matchmaking, then a bot match shown as a live text log with the
 * window timer and the final rankings. Later phases replace it with the board and the real screens.
 */
export function DevMatchPage({ service }: { service: MatchService }) {
  const [matchmaking, setMatchmaking] = useState<Matchmaking | null>(null);
  const [mm, setMm] = useState<MatchmakingState | null>(null);
  const [latest, setLatest] = useState<MatchUpdate | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const session = mm?.kind === 'found' ? mm.session : null;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // A hidden page pauses the local match (C14).
  useEffect(() => {
    if (!session) return;
    const onVisibility = () => (document.hidden ? session.pause() : session.resume());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  function findMatch() {
    setLatest(null);
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
    match.onUpdate((u) => {
      setNow(Date.now());
      setLatest(u);
      append(u.events.map((e) => formatEvent(e, names)));
      // Nothing animates yet, so playback is done as soon as an update arrives (Phase 3 plays beats first).
      if (u.timer === null && u.view.awaiting.window !== 'none') match.playbackDone(u.view.awaiting.windowId);
    });
    match.onRejected((e) => append([`REJECTED ${e.code}: ${e.message}`]));
    match.onFailed((e) => append([`FAILED ${e.message}`]));
  }

  function leave() {
    session?.leave();
    setMatchmaking(null);
    setMm(null);
  }

  const phase = latest?.view.phase;

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
      {session && (
        <section className="plate">
          <Seats seats={session.seats} />
          {latest && <p className="status">{statusLine(latest, session.seats, now)}</p>}
          {phase?.kind === 'finished' && (
            <ol className="rankings">
              {phase.rankings.map((r) => (
                <li key={r.player}>{`${r.rank}. ${nickname(session.seats, r.player)} — tile ${r.position}`}</li>
              ))}
            </ol>
          )}
          <button type="button" onClick={leave}>
            Leave
          </button>
        </section>
      )}
      {log.length > 0 && <pre className="log">{log.slice(-LOG_TAIL).join('\n')}</pre>}
    </main>
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
  const time = u.timer ? `${Math.max(0, Math.ceil((u.timer.endsAt - now) / 1000))} s` : 'waiting for playback';
  return `Round ${round} · ${aw.window} window · waiting for ${who} · ${time}`;
}

function nickname(seats: SeatInfo[], id: PlayerId): string {
  return seats.find((s) => s.playerId === id)?.nickname ?? id;
}
