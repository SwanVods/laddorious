import { useSound } from '../audio/SoundProvider';
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
  useEffect(() => {
    if (!found) return;
    sound.playNow('Q2');
    sound.playNow('Q3');
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
  }, [found, sound]);

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
