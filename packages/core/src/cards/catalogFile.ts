import { RARITIES, type Rarity } from '../board/types';
import { ConfigError } from '../engine/errors';
import { validateCardDef } from '../engine/validation';
import { nextInt, type RngStream } from '../rng/stream';
import { CARD_TYPES, type CardDef, type CardType, type EffectOp, type TargetRule } from './types';

// The card file (2026-10-15): every card the game knows, switched on, off or still a draft, with numbers
// that may be named values picked when a match starts. The engine plays the cards fillCard makes from it.

/** A number on a card: fixed, or a named value of the card, picked when the match starts. */
export type Amount = number | { value: string; negate?: boolean };

/** `T` with any number allowed to be an Amount. */
export type Templated<T> = T extends number
  ? Amount
  : T extends readonly (infer U)[]
    ? Templated<U>[]
    : T extends object
      ? { [K in keyof T]: Templated<T[K]> }
      : T;

export type CardStatus = 'on' | 'off' | 'draft';

export interface ValueRange {
  min: number;
  max: number;
}

export interface CatalogCard {
  id: string;
  name: string;
  type: CardType;
  rarity: Rarity;
  /** Missing means on. Only on cards are dealt; a draft waits for a building block. */
  status?: CardStatus;
  weight: number;
  /** The HUD icon; the card type's icon when missing. */
  icon?: string;
  /** The designer's note (the Excel's Indonesian original). */
  note?: string;
  /** Hand-written effect text; generated from the steps when missing. */
  text?: string;
  /** A draft's plan: what it should do, in plain words. */
  plan?: string;
  target: TargetRule;
  /** Named values, each picked from its range when a match starts. */
  values?: Record<string, ValueRange>;
  effects: Templated<EffectOp>[];
}

export interface CatalogOdds {
  /** Which rarity a "?" square holds. */
  rarityWeights: Record<Rarity, number>;
  /** How likely each card type is when a card is dealt. */
  typeWeights: Record<CardType, number>;
  /** Rerolls per Mystery hand. */
  maxRerolls: number;
}

export interface CardCatalog {
  version: 1;
  odds: CatalogOdds;
  cards: CatalogCard[];
}

/** The values picked for one match, by card id, then value name. */
export type CardValues = Record<string, Record<string, number>>;

export const statusOf = (card: CatalogCard): CardStatus => card.status ?? 'on';

/** Pick every on card's values, in card order and value-name order, so a seed always picks the same. */
export function pickCardValues(cards: readonly CatalogCard[], stream: RngStream): CardValues {
  const out: CardValues = {};
  for (const card of cards) {
    if (statusOf(card) !== 'on' || !card.values) continue;
    const picked: Record<string, number> = {};
    for (const name of Object.keys(card.values).sort()) {
      const { min, max } = card.values[name]!;
      picked[name] = min + nextInt(stream, max - min + 1);
    }
    out[card.id] = picked;
  }
  return out;
}

const isValueRef = (x: unknown): x is { value: string; negate?: boolean } =>
  typeof x === 'object' && x !== null && !Array.isArray(x) && typeof (x as { value?: unknown }).value === 'string' && Object.keys(x).every((k) => k === 'value' || k === 'negate');

/** The names of the values a card's steps use. */
export function valueNames(card: CatalogCard): string[] {
  const names = new Set<string>();
  const walk = (x: unknown): void => {
    if (isValueRef(x)) names.add(x.value);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (typeof x === 'object' && x !== null) Object.values(x).forEach(walk);
  };
  walk(card.effects);
  return [...names];
}

/** The engine's card: every value filled in. The text is the card's own, or empty (config fills it in). */
export function fillCard(card: CatalogCard, values: Record<string, number> = {}): CardDef {
  const fill = (x: unknown): unknown => {
    if (isValueRef(x)) {
      const v = values[x.value];
      if (v === undefined) throw new ConfigError(`card ${card.id}: no value named ${x.value}`);
      return x.negate ? -v : v;
    }
    if (Array.isArray(x)) return x.map(fill);
    if (typeof x === 'object' && x !== null) return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, fill(v)]));
    return x;
  };
  return { id: card.id, name: card.name, text: card.text ?? '', type: card.type, rarity: card.rarity, weight: card.weight, target: card.target, effects: fill(card.effects) as EffectOp[] };
}

export interface CardProblem {
  /** The card at fault, or null for the whole list. */
  cardId: string | null;
  message: string;
}

const isInt = (v: unknown): v is number => Number.isInteger(v);
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Everything wrong with one card, in plain words. */
function problemsOf(card: CatalogCard): string[] {
  const out: string[] = [];
  if (!ID.test(card.id)) out.push('Its id may only use lowercase letters, digits and dashes.');
  if (typeof card.name !== 'string' || card.name.trim() === '') out.push('It needs a name.');
  if (!CARD_TYPES.includes(card.type)) out.push(`Its type must be one of ${CARD_TYPES.join(', ')}.`);
  if (!RARITIES.includes(card.rarity)) out.push(`Its rarity must be one of ${RARITIES.join(', ')}.`);
  if (!['on', 'off', 'draft'].includes(statusOf(card))) out.push('Its status must be on, off or draft.');
  if (!isInt(card.weight) || card.weight < 1) out.push('Its weight must be a whole number, 1 or more.');
  if (statusOf(card) === 'draft') {
    if (!card.plan || card.plan.trim() === '') out.push('A draft needs a plan: say in plain words what it should do.');
    return out;
  }
  for (const [name, r] of Object.entries(card.values ?? {})) {
    if (!isInt(r.min) || !isInt(r.max)) out.push(`Value ${name}: the lowest and highest must be whole numbers.`);
    else if (r.min > r.max) out.push(`Value ${name}: the lowest (${r.min}) is above the highest (${r.max}).`);
  }
  for (const name of valueNames(card)) {
    if (!card.values?.[name]) out.push(`It uses a value named ${name}, but the card has no value with that name.`);
  }
  if (card.effects.length === 0) out.push('It has no steps. Add a step, or make it a draft.');
  if (out.length > 0) return out;
  // The engine's own checks, at every value's lowest and at its highest.
  for (const end of ['min', 'max'] as const) {
    const values = Object.fromEntries(Object.entries(card.values ?? {}).map(([k, r]) => [k, r[end]]));
    try {
      validateCardDef(fillCard(card, values));
    } catch (e) {
      const at = Object.entries(values).map(([k, v]) => `${k} = ${v}`).join(', ');
      out.push(`${e instanceof Error ? e.message : String(e)}${at ? ` (with ${at})` : ''}`);
      break;
    }
  }
  return out;
}

/** Every problem in a list of cards: each card's own, shared ids, and rarities with nothing switched on. */
export function cardProblems(cards: readonly CatalogCard[]): CardProblem[] {
  const out: CardProblem[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    for (const message of problemsOf(card)) out.push({ cardId: card.id, message });
    if (seen.has(card.id)) out.push({ cardId: card.id, message: `Another card already uses the id "${card.id}".` });
    seen.add(card.id);
  }
  for (const rarity of RARITIES) {
    if (!cards.some((c) => c.rarity === rarity && statusOf(c) === 'on')) {
      out.push({ cardId: null, message: `No ${rarity} card is switched on. Every rarity needs at least one.` });
    }
  }
  return out;
}

/** Every problem in the card file: the odds, then the cards. */
export function catalogProblems(catalog: CardCatalog): CardProblem[] {
  const out: CardProblem[] = [];
  const weights = (w: Record<string, number>, keys: readonly string[]) => keys.every((k) => isInt(w?.[k]) && w[k]! >= 0) && keys.some((k) => w[k]! > 0);
  if (catalog.version !== 1) out.push({ cardId: null, message: 'The card file must say "version": 1.' });
  if (!weights(catalog.odds?.rarityWeights, RARITIES)) out.push({ cardId: null, message: 'The "?" square odds must be whole numbers, 0 or more, and not all 0.' });
  if (!weights(catalog.odds?.typeWeights, CARD_TYPES)) out.push({ cardId: null, message: 'The card type odds must be whole numbers, 0 or more, and not all 0.' });
  if (!isInt(catalog.odds?.maxRerolls) || catalog.odds.maxRerolls < 0 || catalog.odds.maxRerolls > 3) out.push({ cardId: null, message: 'Rerolls per hand must be 0 to 3.' });
  return [...out, ...cardProblems(catalog.cards ?? [])];
}
