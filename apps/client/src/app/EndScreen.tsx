import type { PlayerId, Ranking } from '@laddorious/core';
import { ordinal } from '../hud/labels';
import type { SeatInfo } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { Portrait } from '../ui/PieceIcon';

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
              <li key={r.player} className={`place place-${r.rank}${r.player === me ? ' me' : ''}`} aria-label={`${ordinal(r.rank)}: ${name}, tile ${r.position}`}>
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
