import { useSound } from '../audio/SoundProvider';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { Matchmaking, MatchmakingState, MatchSession, SeatInfo } from '../service/matchService';
import { Portrait } from '../ui/PieceIcon';
import { useHotkeys } from '../ui/useHotkeys';
import { useOncePer } from './once';

/** "Play with bots" appears once a search has run this long (spec #2 C7). */
export const PLAY_WITH_BOTS_AFTER_MS = 15_000;
/** Each step of the 3-2-1 countdown after MATCH FOUND. */
export const COUNT_MS = 750;

/** The link that opens the game straight into a room (2026-10-16). */
export function roomLink(code: string, page: { origin: string; pathname: string } = location): string {
  return `${page.origin}${page.pathname}?room=${code}`;
}

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
  /** Online: ask the server again after it couldn't be reached (spec #4 §3.3). */
  onRetry?: () => void;
  /** Online: play offline with bots instead. */
  onOffline?: () => void;
}

/**
 * Matchmaking, over the menu scene (spec #2 §7.1): FINDING PLAYERS with the elapsed time, my
 * seat and three searching ones, Cancel, and after 15 s "Play with bots". Then the bots take
 * their seats, MATCH FOUND!, a 3-2-1 countdown, and the match. A private room (2026-10-16) shows its
 * code and a link to copy instead of the clock, and its host starts it.
 */
export function MatchmakingOverlay({ matchmaking, onCancelled, onReady, onRetry, onOffline }: MatchmakingOverlayProps) {
  const titleId = useId();
  const [state, setState] = useState<MatchmakingState | null>(null);
  const [count, setCount] = useState(3);
  const handlersRef = useRef({ onCancelled, onReady });
  useLayoutEffect(() => {
    handlersRef.current = { onCancelled, onReady };
  });

  useEffect(() => matchmaking.onState(setState), [matchmaking]);

  // A pop per bot taking a seat, then MATCH FOUND and the countdown (spec #3 §5).
  const sound = useSound();
  const filled = state && (state.kind === 'searching' || state.kind === 'filling') ? state.seats.filter(Boolean).length : 0;
  const seatedRef = useRef(1);
  useEffect(() => {
    if (state?.kind === 'filling' && filled > seatedRef.current) sound.playNow('Q1', filled - 2);
    seatedRef.current = Math.max(seatedRef.current, filled);
  }, [state, filled, sound]);

  useEffect(() => {
    if (state?.kind === 'cancelled') handlersRef.current.onCancelled();
  }, [state]);

  const found = state?.kind === 'found' ? state.session : null;
  // MATCH FOUND and the countdown's start, once per match found (StrictMode runs effects twice in dev, 2026-10-15).
  useOncePer(found, () => {
    sound.playNow('Q2');
    sound.playNow('Q3');
  });
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

  useHotkeys({ Escape: () => matchmaking.cancel() }, state?.kind === 'searching' || state?.kind === 'unreachable' || state?.kind === 'roomError');

  if (!state || state.kind === 'cancelled') return null;
  if (state.kind === 'unreachable') {
    return (
      <div className="popup live matchmaking" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="backdrop" />
        <div className="popup-content">
          <h2 id={titleId} className="popup-title display">
            {"CAN'T CONNECT"}
          </h2>
          <p className="popup-hint">{state.message}</p>
          <div className="mm-buttons">
            {onRetry && (
              <button type="button" className="btn accent" onClick={onRetry}>
                Try again
              </button>
            )}
            {onOffline && (
              <button type="button" className="btn" onClick={onOffline}>
                Play offline with bots
              </button>
            )}
            <button type="button" className="btn" onClick={() => matchmaking.cancel()}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (state.kind === 'roomError') {
    return (
      <div className="popup live matchmaking" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="backdrop" />
        <div className="popup-content">
          <h2 id={titleId} className="popup-title display">
            {"CAN'T JOIN"}
          </h2>
          <p className="popup-hint">{state.message}</p>
          <div className="mm-buttons">
            <button type="button" className="btn accent" onClick={() => matchmaking.cancel()}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }
  const seats = state.kind === 'found' ? found!.seats : state.seats;
  const room = state.kind === 'searching' || state.kind === 'filling' ? state.room : undefined;
  const title = state.kind === 'searching' ? (room ? (room.host ? 'YOUR ROOM' : "FRIEND'S ROOM") : 'FINDING PLAYERS') : state.kind === 'filling' ? 'ADDING BOTS' : 'MATCH FOUND!';
  const offerBots = state.kind === 'searching' && !room && state.elapsedMs >= PLAY_WITH_BOTS_AFTER_MS;

  return (
    <div className="popup live matchmaking" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="backdrop" />
      <div className="popup-content">
        <h2 id={titleId} className={state.kind === 'found' ? 'popup-title display found' : 'popup-title display'}>
          {title}
        </h2>
        {state.kind === 'searching' && !room && (
          <span className="mm-time display" role="timer">
            {clock(state.elapsedMs)}
          </span>
        )}
        {state.kind === 'searching' && room && (
          <div className="mm-room">
            <span className="mm-code display" aria-label="Room code">
              {room.code}
            </span>
            <CopyLink code={room.code} />
          </div>
        )}
        <ol className="mm-seats">
          {seats.map((seat, i) => (
            // eslint-disable-next-line @eslint-react/no-array-index-key -- a seat's position is its identity
            <SeatSlot key={i} seat={seat} me={i === 0} open={room !== undefined} />
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
              : room
                ? room.host
                  ? "Share the code with friends. Start when you're ready: empty seats get bots."
                  : 'Waiting for the host to start. Empty seats get bots.'
                : offerBots
                ? 'Taking a while? Start now and bots take the empty seats.'
                : 'A 4-player match starts as soon as the seats fill.'}
          </p>
        )}
        {state.kind === 'searching' && room && (
          <div className="mm-buttons">
            {room.host && (
              <button type="button" className="btn accent" onClick={() => matchmaking.startRoom?.()}>
                Start
              </button>
            )}
            <button type="button" className="btn" onClick={() => matchmaking.cancel()}>
              Leave room
            </button>
          </div>
        )}
        {state.kind === 'searching' && !room && (
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

/** Copies the room's link; it says so for a moment. Clipboard access can be refused: then the code is still on screen. */
function CopyLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <button
      type="button"
      className="btn mm-copy"
      aria-label="Copy link"
      onClick={() => {
        navigator.clipboard?.writeText(roomLink(code)).then(
          () => setCopied(true),
          () => {},
        );
      }}
    >
      {copied ? 'Copied!' : 'Copy link'}
    </button>
  );
}

/** A seat at the table: a player, or an empty one ("Searching" in quick match, "Open" in a room). */
function SeatSlot({ seat, me, open }: { seat: SeatInfo | null; me: boolean; open: boolean }) {
  if (!seat) {
    return (
      <li className="mm-seat empty">
        <span className="mm-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="mm-name display">{open ? 'Open' : 'Searching'}</span>
      </li>
    );
  }
  return (
    <li className={me ? 'mm-seat me' : 'mm-seat'}>
      <Portrait piece={seat.piece} color={seat.color} className="mm-portrait" />
      <span className="mm-name display">{seat.nickname}</span>
      {(me || seat.bot) && <span className="mm-tag">{me ? 'YOU' : 'BOT'}</span>}
    </li>
  );
}
