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
  /** The card's own die, once it has rolled (2026-10-15). */
  roll?: number;
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
        if (card && card.cardId === e.cardId) {
          card.result = e.result;
          if (e.roll !== undefined) card.roll = e.roll;
        }
        break;
      }
    }
  }
  return record;
}

/**
 * The round whose cards the card list shows (the user, 2026-10-16): this round's once it has any; until then
 * last round's, through the break and the next round's dice window, so the players can see what was played,
 * until everyone's dice are in (bots roll the moment the window opens, so one die roll would be too soon).
 */
export function cardListRecord(log: readonly LoggedEvent[]): RoundRecord {
  const current = roundRecord(log);
  if (Object.keys(current.cards).length > 0) return current;
  let start = -1;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i]!.event.type === 'RoundStarted') {
      start = i;
      break;
    }
  }
  if (start <= 0 || log.slice(start).some((e) => e.event.type === 'DiceTotaled')) return current;
  return roundRecord(log.slice(0, start));
}
