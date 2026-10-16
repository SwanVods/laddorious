import { useId, useState } from 'react';
import { Icon } from '../ui/Icon';
import { useHotkeys } from '../ui/useHotkeys';
import { RARITY_NAMES } from './Chips';
import type { CardPickModel } from './model';

interface CardPickPopupProps {
  model: CardPickModel;
  onPick: (slot: number) => void;
  onReroll: (slot: number) => void;
  /** Peeking at the board: the camera shows all of it (2026-10-14). */
  onPeek?: (peeking: boolean) => void;
}

/**
 * The Mystery card pick (spec #2 §7.2), like a TFT augment: "Choose One", three tall cards
 * framed by rarity, a reroll button under each, and "Peek at the board". Tapping a card (or
 * pressing 1–3) picks it at once; only the offer's owner ever sees this.
 */
export function CardPickPopup({ model, onPick, onReroll, onPeek }: CardPickPopupProps) {
  const titleId = useId();
  // The hand as shown: a pick or a reroll waits for the next view, so nothing is sent twice.
  const hand = model.slots.map((s) => `${s.info.id}:${s.rerolled}`).join(' ');
  const [picked, setPicked] = useState<{ hand: string; slot: number } | null>(null);
  const [rerolling, setRerolling] = useState<{ hand: string; slot: number } | null>(null);
  const [peeking, setPeeking] = useState(false);
  const locked = picked?.hand === hand;
  const pick = (slot: number) => {
    if (locked || peeking) return;
    setPicked({ hand, slot });
    onPick(slot);
  };
  useHotkeys({ '1': () => pick(0), '2': () => pick(1), '3': () => pick(2) }, !locked && !peeking);

  return (
    <div className={peeking ? 'popup card-pick live peeking' : 'popup card-pick live'} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {!peeking && <div className="backdrop" />}
      <div className="popup-content">
        <h2 id={titleId} className="popup-title display" hidden={peeking}>
          Choose One
        </h2>
        {!peeking && (
          <>
            <p className="popup-sub">
              {`${RARITY_NAMES[model.rarity]} ? square · only you see these cards · ${model.rerollsLeft} ${model.rerollsLeft === 1 ? 'reroll' : 'rerolls'} left, ${model.perSlot} per card`}
            </p>
            <div className="pick-cards">
              {model.slots.map(({ slot, info, warning, canReroll }) => (
                <div key={slot} className={['pick-slot', locked ? (picked?.slot === slot ? 'chosen' : 'gone') : ''].filter(Boolean).join(' ')}>
                  <button
                    type="button"
                    className={`pick-card ${info.rarity} ${info.type}`}
                    data-sound="C3"
                    aria-label={`${info.name}. ${info.text}${warning ? ` ${warning}` : ''}`}
                    disabled={locked}
                    onClick={() => pick(slot)}
                  >
                    <span className="pick-inner">
                      <span className="pick-type display">{info.type.toUpperCase()}</span>
                      <span className="pick-medal">
                        <Icon name={info.icon} />
                      </span>
                      <span className="pick-name display">{info.name}</span>
                      <span className="pick-text">{info.text}</span>
                      {warning && <span className="pick-warn">{warning}</span>}
                      <span className="pick-target">
                        <Icon name="target" />
                        {info.targetLine}
                      </span>
                    </span>
                    <kbd>{slot + 1}</kbd>
                  </button>
                  <button
                    type="button"
                    className="reroll-btn"
                    data-sound="C2"
                    aria-label={`Reroll ${info.name}`}
                    disabled={locked || !canReroll || (rerolling?.hand === hand && rerolling.slot === slot)}
                    onClick={() => {
                      setRerolling({ hand, slot });
                      onReroll(slot);
                    }}
                  >
                    <Icon name="reroll" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="popup-foot">
          <button type="button" className="btn peek-btn" onClick={() => {
              setPeeking(!peeking);
              onPeek?.(!peeking);
            }}>
            {peeking ? 'Back to the cards' : 'Peek at the board'}
          </button>
        </div>
      </div>
    </div>
  );
}
