import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { SeatInfo } from '../service/matchService';
import { Icon } from '../ui/Icon';
import { useHotkeys } from '../ui/useHotkeys';
import { RESULT_NAMES } from './Chips';
import { cardInfo } from './labels';
import type { DockModel, QueueCard } from './model';
import { Parts } from './Parts';

interface DockProps {
  model: DockModel;
  seats: readonly SeatInfo[];
  onRoll: (windowId: number) => void;
}

/**
 * Bottom centre (spec #2 §7.2): the ROLL button in my dice window (Space on desktop), else the
 * waiting pill, the move caption with everyone's totals, or the card resolution queue.
 */
export function Dock({ model, seats, onRoll }: DockProps) {
  const [rolledIn, setRolledIn] = useState<number | null>(null);
  const canRoll = model.kind === 'roll' && rolledIn !== model.windowId;
  const roll = () => {
    if (model.kind !== 'roll' || rolledIn === model.windowId) return;
    setRolledIn(model.windowId);
    onRoll(model.windowId);
  };
  useHotkeys({ Space: roll }, canRoll);

  switch (model.kind) {
    case 'roll':
      return (
        <div className="dock live">
          <button type="button" className="btn primary roll-btn" data-sound="none" disabled={!canRoll} onClick={roll}>
            <Icon name="die" />
            {canRoll ? 'ROLL' : 'Rolling…'}
          </button>
          <p className="pill dock-hint desktop-only">
            <kbd>Space</kbd> Everyone rolls one die at the same time.
          </p>
        </div>
      );
    case 'wait':
      return (
        <div className="dock">
          <p className="pill" role="status">
            <span className="spinner" />
            <span>
              <Parts parts={model.parts} seats={seats} />
            </span>
          </p>
        </div>
      );
    case 'caption':
      return (
        <div className="dock">
          <p className="pill" role="status">
            <span>
              <Parts parts={model.parts} seats={seats} />
            </span>
          </p>
          {model.totals && (
            <ul className="totals" aria-label="This round's totals">
              {model.totals.map(({ player, total }) => {
                const seat = seats.find((s) => s.playerId === player);
                return (
                  <li key={player} className="tchip" style={seat ? ({ '--seat': seat.color } as CSSProperties) : undefined}>
                    {seat?.nickname ?? player} <b>{`+${total}`}</b>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    case 'queue':
      return (
        <div className="dock">
          {model.caption && (
            <p className="pill" role="status">
              {model.caption}
            </p>
          )}
          <ol className="queue" aria-label="Cards in resolution order">
            {model.cards.map((card, i) => (
              <QueueItem key={card.caster} card={card} order={i + 1} seats={seats} />
            ))}
          </ol>
        </div>
      );
    case 'none':
      return null;
  }
}

/** A numbered mini card: type, rarity, name, who plays it on whom, and its stamp once resolved. */
function QueueItem({ card, order, seats }: { card: QueueCard; order: number; seats: readonly SeatInfo[] }) {
  const info = cardInfo(card.cardId);
  const caster = seats.find((s) => s.playerId === card.caster)?.nickname ?? card.caster;
  const who = info.targetLine === 'You' ? `${caster} · on themself` : `${caster} → ${info.targetLine}`;
  const classes = ['q-card', info.type, card.current ? 'now' : '', card.result ? 'done' : ''].filter(Boolean).join(' ');
  return (
    <li className={classes}>
      <span className="q-order display">{order}</span>
      <span className="q-top display">
        <span>{info.type.toUpperCase()}</span>
        <span className={`gem ${info.rarity}`}>{info.rarity.toUpperCase()}</span>
      </span>
      <span className="q-body">
        <Icon name={info.icon} />
        <span>
          <b className="display">{info.name}</b>
          <small>{who}</small>
        </span>
      </span>
      {/* What the card does (2026-10-16): the bubbles beside the rows show only its name. */}
      <p className="q-text">{info.text}</p>
      {card.result && <em className={`stamp display ${card.result}`}>{RESULT_NAMES[card.result]}</em>}
    </li>
  );
}
