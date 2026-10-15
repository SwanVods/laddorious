import type { CardResult, Rarity } from '@laddorious/core';
import { DieFace } from '../ui/DieFace';
import { Icon } from '../ui/Icon';
import { cardInfo, type EffectChip } from './labels';
import type { CardRecord, DiceRecord } from './record';

// The small chips of the player column, the details card and the your-piece panel (spec #2 §7.2).

export const RARITY_NAMES: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic' };
export const RESULT_NAMES: Record<CardResult, string> = { hit: 'Hit', blocked: 'Blocked', fizzled: 'Fizzled' };

/** An active effect: its icon with a short badge ("6", "×2", "−3", "2r"). */
export function EffectChipView({ chip, large = false }: { chip: EffectChip; large?: boolean }) {
  return (
    <span className={large ? 'chip lg' : 'chip'} role="img" aria-label={chip.name}>
      <Icon name={chip.icon} />
      <b>{chip.badge}</b>
    </span>
  );
}

/** On a "?" square with a card still to pick; the glyph's colour shows the rarity (§6.1). */
export function MysteryChip({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`chip chip-q display ${rarity}`} role="img" aria-label={`On a ${RARITY_NAMES[rarity]} ? square`}>
      ?
    </span>
  );
}

/** A picked card: face down until the reveal, then its type colour, rarity ring and result dot. */
export function CardChip({ card }: { card: 'facedown' | CardRecord }) {
  if (card === 'facedown') {
    return (
      <span className="chip chip-card facedown" role="img" aria-label="Card picked, face down">
        <Icon name="lock" />
      </span>
    );
  }
  const info = cardInfo(card.cardId);
  const label = card.result ? `${info.name}: ${RESULT_NAMES[card.result]}${card.roll !== undefined ? `, rolled ${card.roll}` : ''}` : info.name;
  return (
    <span className={`chip chip-card ${info.type} ${info.rarity}`} role="img" aria-label={label}>
      <Icon name={info.icon} />
      {card.result && <i className={card.result} />}
    </span>
  );
}

/** This round's dice: each face (forced ones flash), then the total when modifiers changed it. */
export function DiceChips({ dice }: { dice: DiceRecord }) {
  const sum = dice.faces.reduce((a, b) => a + b, 0);
  return (
    <>
      {dice.faces.map((face, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- a die's position is its identity
        <DieFace key={i} face={face} forced={dice.forced[i] ?? false} />
      ))}
      {dice.total !== null && (dice.faces.length > 1 || dice.total !== sum) && <span className="prow-total display">{`=${dice.total}`}</span>}
    </>
  );
}
