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
