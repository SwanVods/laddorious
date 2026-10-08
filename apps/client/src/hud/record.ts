import type { CardResult, PlayerId } from '@laddorious/core';
import type { LoggedEvent } from '../director/director';

// This round, as the HUD has shown it so far: everyone's dice and cards (spec #2 §7.2).

export interface DiceRecord {
  faces: number[];
  /** Per face: a card set it (forced faces flash, §5.1). */
  forced: boolean[];
  /** The total after modifiers, once the dice phase has closed. */
  total: number | null;
}

export interface CardRecord {
  cardId: string;
  /** Hit, Blocked or Fizzled once the card has resolved. */
  result: CardResult | null;
}

export interface RoundRecord {
  round: number | null;
  dice: Record<PlayerId, DiceRecord>;
  /** Cards revealed this round, by caster, in reveal order. */
  cards: Record<PlayerId, CardRecord>;
}

/** Everything logged since the latest RoundStarted (or since the start, in round 1). */
export function roundRecord(log: readonly LoggedEvent[]): RoundRecord {
  let start = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i]!.event.type === 'RoundStarted') {
      start = i;
      break;
    }
  }
  const record: RoundRecord = { round: null, dice: {}, cards: {} };
  for (const { event: e } of log.slice(start)) {
    switch (e.type) {
      case 'RoundStarted':
        record.round = e.round;
        break;
      case 'DieRolled': {
        const dice = (record.dice[e.player] ??= { faces: [], forced: [], total: null });
        dice.faces.push(e.face);
        dice.forced.push(e.forced);
        break;
      }
      case 'DiceTotaled':
        record.dice[e.player] = { faces: [...e.faces], forced: record.dice[e.player]?.forced ?? e.faces.map(() => false), total: e.total };
        break;
      case 'CardSelected':
        record.cards[e.player] = { cardId: e.cardId, result: null };
        break;
      case 'CardResolved': {
        const card = record.cards[e.caster];
        if (card && card.cardId === e.cardId) card.result = e.result;
        break;
      }
    }
  }
  return record;
}
