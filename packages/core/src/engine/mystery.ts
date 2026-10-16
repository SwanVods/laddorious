import { cardById, drawCard } from '../cards/catalog';
import { selectTarget } from '../cards/targeting';
import { nextInt } from '../rng/stream';
import { inputError } from './dice';
import { InvariantError } from './errors';
import { groupPendingCards, resolveGroup } from './resolve';
import { startDicePhase } from './dice';
import { effectsOn, spendCharge } from './effects';
import { endRound } from './round';
import type { Rarity } from '../board/types';
import type { GameEvent, InputError, MatchState, Offer, PendingCard, PlayerId } from './types';
import { getPlayer, openWindow, priv, pub } from './util';

type SelectPhase = Extract<MatchState['phase'], { kind: 'mysterySelect' }>;

/**
 * After the dice settle (spec §4.8): players who moved this round and stand on
 * a Mystery tile get 3 private cards; otherwise the round ends.
 */
export function startMysteryOrEndRound(s: MatchState, ev: GameEvent[]): void {
  const offers: Record<PlayerId, Offer> = {};
  for (const p of s.players) {
    const rarity = s.board.mystery[p.position];
    if (rarity === undefined || !s.movedThisRound.includes(p.id)) continue;
    const stream = s.rng.cards[p.seat]!;
    // Three different cards: each slot's draw excludes the cards dealt before it (polish spec §3.2).
    const dealt: string[] = [];
    for (let i = 0; i < 3; i++) dealt.push(drawCard(s.config.cards, rarity, s.config.mystery.typeWeights, stream, dealt) ?? noCardLeft(rarity));
    const offer: Offer = {
      player: p.id,
      tile: p.position,
      rarity,
      cards: [dealt[0]!, dealt[1]!, dealt[2]!],
      rerolled: [false, false, false],
      rerollsUsed: 0,
      seen: [...dealt],
      picked: null,
      autoPicked: false,
    };
    // Second Thoughts (2026-10-16): one more reroll on each card for every one held, three more in all; spent here.
    const more = effectsOn(s, p.id, 'moreRerolls');
    if (more.length > 0) {
      offer.perSlot = 1 + more.length;
      offer.maxRerolls = s.config.mystery.maxRerolls + 3 * more.length;
      offer.slotRerolls = [0, 0, 0];
      for (const e of more) spendCharge(s, ev, e);
    }
    offers[p.id] = offer;
    ev.push(priv(p.id, { type: 'MysteryOffered', player: p.id, tile: p.position, rarity, cards: [...offer.cards] }));
  }
  const players = Object.keys(offers);
  if (players.length === 0) {
    endRoundOrEncore(s, ev);
    return;
  }
  s.phase = { kind: 'mysterySelect', offers };
  openWindow(s, ev, 'mystery', players);
}

/** validateCards keeps at least one card per (type, rarity), so every rarity has 5 or more. */
function noCardLeft(rarity: Rarity): never {
  throw new InvariantError(`no ${rarity} card left to draw`);
}

function offerFor(s: MatchState, player: PlayerId): Offer | InputError {
  if (s.phase.kind !== 'mysterySelect') return inputError('WRONG_PHASE', 'not in Mystery selection');
  const offer = s.phase.offers[player];
  if (!offer) return inputError('NOT_AWAITED', `${player} has no Mystery encounter`);
  if (offer.picked !== null) return inputError('ALREADY_PICKED', `${player} already picked`);
  return offer;
}

function isSlot(slot: number): slot is 0 | 1 | 2 {
  return slot === 0 || slot === 1 || slot === 2;
}

export function rerollInput(s: MatchState, ev: GameEvent[], player: PlayerId, slot: number): InputError | null {
  const offer = offerFor(s, player);
  if ('code' in offer) return offer;
  if (!isSlot(slot)) return inputError('INVALID_SLOT', `slot must be 0, 1 or 2, got ${slot}`);
  if (offer.rerollsUsed >= (offer.maxRerolls ?? s.config.mystery.maxRerolls)) return inputError('REROLL_LIMIT', 'no rerolls left');
  if (offer.rerolled[slot]) return inputError('SLOT_ALREADY_REROLLED', `slot ${slot} was already rerolled`);
  const from = offer.cards[slot];
  // Never a card in the hand; a card already seen in it only once the rarity has run out (polish spec §3.2).
  const stream = s.rng.cards[getPlayer(s, player).seat]!;
  const draw = (exclude: readonly string[]) => drawCard(s.config.cards, offer.rarity, s.config.mystery.typeWeights, stream, exclude);
  const to = draw([...offer.cards, ...offer.seen]) ?? draw(offer.cards) ?? noCardLeft(offer.rarity);
  offer.cards[slot] = to;
  offer.seen.push(to);
  if (offer.slotRerolls) offer.slotRerolls[slot] += 1;
  offer.rerolled[slot] = !offer.slotRerolls || offer.slotRerolls[slot] >= (offer.perSlot ?? 1);
  offer.rerollsUsed += 1;
  ev.push(priv(player, { type: 'CardRerolled', player, slot, from, to }));
  return null;
}

export function pickCardInput(s: MatchState, ev: GameEvent[], player: PlayerId, slot: number): InputError | null {
  const offer = offerFor(s, player);
  if ('code' in offer) return offer;
  if (!isSlot(slot)) return inputError('INVALID_SLOT', `slot must be 0, 1 or 2, got ${slot}`);
  offer.picked = slot;
  return null;
}

/** Mystery window expiry: a random displayed card for everyone who has not picked. */
export function mysteryTimeout(s: MatchState): void {
  const phase = s.phase as SelectPhase;
  for (const offer of Object.values(phase.offers)) {
    if (offer.picked === null) {
      offer.picked = nextInt(s.rng.cards[getPlayer(s, offer.player).seat]!, 3);
      offer.autoPicked = true;
    }
  }
}

export function mysteryAwaited(phase: SelectPhase): PlayerId[] {
  return Object.values(phase.offers).filter((o) => o.picked === null).map((o) => o.player);
}

/**
 * All picks are in: lock hidden targets in seat order (D21), then reveal the picks together in the
 * order they resolve, last place first, and resolve them one at a time (2026-10-14).
 */
export function beginResolution(s: MatchState, ev: GameEvent[]): void {
  const phase = s.phase as SelectPhase;
  const pending: PendingCard[] = [];
  for (const p of s.players) {
    const offer = phase.offers[p.id];
    if (!offer) continue;
    const cardId = offer.cards[offer.picked!]!;
    const card = cardById(s.config.cards, cardId);
    pending.push({ caster: p.id, cardId, target: selectTarget(s.players, p, card.target, s.rng.misc) });
  }
  s.resolution = groupPendingCards(s.players, pending);
  // The reveal lists the cards in the order they will resolve.
  for (const [pc] of s.resolution) {
    const card = cardById(s.config.cards, pc!.cardId);
    ev.push(pub({ type: 'CardSelected', player: pc!.caster, cardId: pc!.cardId, cardType: card.type, rarity: card.rarity, auto: phase.offers[pc!.caster]!.autoPicked }));
  }
  continueResolution(s, ev);
}

/** Resolve groups until one needs a settle, or end the round when none remain. */
export function continueResolution(s: MatchState, ev: GameEvent[]): void {
  while (s.resolution && s.resolution.length > 0) {
    const group = s.resolution.shift()!;
    const movers = resolveGroup(s, ev, group);
    if (movers.length > 0) {
      s.phase = { kind: 'settle', ctx: { movers, wave: 0, challenges: [] }, after: 'resolveGroups' };
      return;
    }
  }
  s.resolution = null;
  endRoundOrEncore(s, ev);
}

/**
 * The round has played out (2026-10-16): players holding an Encore roll again first, in a window of their own,
 * and only they can land on a card; the round ends once nobody holds one.
 */
function endRoundOrEncore(s: MatchState, ev: GameEvent[]): void {
  const again = s.players.filter((p) => effectsOn(s, p.id, 'extraRoll').length > 0).map((p) => p.id);
  if (again.length === 0) {
    endRound(s, ev);
    return;
  }
  for (const id of again) spendCharge(s, ev, effectsOn(s, id, 'extraRoll')[0]!);
  ev.push(pub({ type: 'ExtraRoll', players: again }));
  s.movedThisRound = [];
  startDicePhase(s, ev, again);
}
