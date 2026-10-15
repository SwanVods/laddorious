import type { CSSProperties } from 'react';
import type { SeatInfo } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { RESULT_NAMES } from './Chips';
import { cardInfo } from './labels';
import type { QueueCard } from './model';

/**
 * This round's cards as a compact list under the action log (the user, 2026-10-15): on landscape phones it
 * stands in for the card bubbles and the bottom queue, which covered the board. Each card is a little card
 * bubble as wide as the "Your piece" panel (2026-10-15), in the order they resolve: its type's colour and
 * icon, who plays it and the card on top, what it does underneath, and its result once known; the card
 * resolving now is marked.
 */
export function CardList({ cards, seats }: { cards: readonly QueueCard[]; seats: readonly SeatInfo[] }) {
  if (cards.length === 0) return null;
  return (
    <ol className="card-list" aria-label="Cards this round">
      {cards.map((card) => {
        const info = cardInfo(card.cardId);
        const seat = seats.find((s) => s.playerId === card.caster);
        return (
          <li key={card.caster} className={`card-line card-bubble ${info.type}${card.current ? ' now' : ''}`} aria-current={card.current ? 'true' : undefined}>
            <span className="card-line-chip" aria-hidden="true">
              <Icon name={info.icon} />
            </span>
            <span className="card-line-text">
              <span className="card-line-title">
                <b className="who" style={{ '--seat': seat?.color } as CSSProperties}>
                  {seat?.nickname ?? card.caster}
                </b>{' '}
                <b>{info.name}</b>
              </span>
              <small className="card-line-gist">{info.summary}</small>
            </span>
            {card.result && <em className={`card-line-result ${card.result}`}>{RESULT_NAMES[card.result]}</em>}
          </li>
        );
      })}
    </ol>
  );
}
