import { CARD_CATALOG, STARTER_CARDS, blockedByBoard, describeCard, fillCard, targetCandidates, type ActiveEffect, type CardDef, type CardValues, type InputErrorCode, type PlayerId, type PlayerView, type TargetRule } from '@laddorious/core';
import type { PieceId } from '../service/matchService';

// Words and icons for cards and effects (spec #2 §7.2). Cards come from the card file (2026-10-15), with the
// values the match picked, so every name, text and icon matches what the engine plays.

/** How the HUD names each piece. */
export const PIECE_NAMES: Record<PieceId, string> = { knight: 'Knight', pawn: 'Pawn', meeple: 'Meeple', dragon: 'Dragon head', rook: 'Rook', hat: 'Top hat', duck: 'Rubber duck' };

/** Icon names drawn by ui/Icon.tsx. */
export type IconName =
  | 'arrow' | 'die' | 'x2' | 'pad' | 'charm' | 'shield' | 'aegis' | 'push' | 'boot' | 'swap' | 'coin' | 'bait'
  | 'jackpot' | 'steady' | 'cleanse' | 'slide' | 'card' | 'lock' | 'check' | 'bolt' | 'eye' | 'reroll' | 'target'
  | 'qmark' | 'swords' | 'gear' | 'close' | 'play' | 'back' | 'next' | 'menu' | 'pencil' | 'trophy'
  | 'rock' | 'paper' | 'scissors' | 'speaker' | 'speaker-off' | 'expand' | 'shrink';

/** A card type's icon, for cards that don't name their own (2026-10-15). */
const TYPE_ICONS: Record<CardDef['type'], IconName> = { movement: 'arrow', defense: 'shield', attack: 'push', risky: 'coin', misc: 'card' };
/** The icons a card in the card file may name. */
const CARD_ICONS = new Set<string>(['arrow', 'die', 'x2', 'pad', 'charm', 'shield', 'aegis', 'push', 'boot', 'swap', 'coin', 'bait', 'jackpot', 'steady', 'cleanse', 'slide', 'card', 'back', 'reroll']);

let matchValues: CardValues | null = null;
let matchCards = new Map<string, CardDef>();

/** The HUD's cards for this match: the card file's, with the values the match picked (2026-10-15). */
export function setMatchCards(values: CardValues): void {
  if (values === matchValues) return;
  matchValues = values;
  matchCards = new Map(
    CARD_CATALOG.cards.map((c) => {
      const picked = Object.fromEntries(Object.entries(c.values ?? {}).map(([k, r]) => [k, values[c.id]?.[k] ?? r.min]));
      return [c.id, { ...fillCard(c, picked), text: describeCard(c, values[c.id]) }];
    }),
  );
}
setMatchCards({});

const NO_CARD = { text: '', type: 'misc', rarity: 'common', weight: 1, target: { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' }, effects: [] } as const;

/** A card by id: the match's, else an old starter card, else just its id as a name. Never throws. */
function cardOf(id: string): CardDef {
  return matchCards.get(id) ?? STARTER_CARDS.find((c) => c.id === id) ?? { ...NO_CARD, id, name: id, target: { ...NO_CARD.target }, effects: [] };
}

function iconOf(id: string, card: CardDef): IconName {
  const own = CARD_CATALOG.cards.find((c) => c.id === id)?.icon;
  return own && CARD_ICONS.has(own) ? (own as IconName) : TYPE_ICONS[card.type];
}

export interface CardInfo {
  id: string;
  name: string;
  text: string;
  type: CardDef['type'];
  rarity: CardDef['rarity'];
  /** Who it aims at, as shown before picking: the exact target stays hidden until it resolves. */
  targetLine: string;
  icon: IconName;
  /** The card's line for its bubble: its text (2026-10-15: written from its steps). */
  summary: string;
}

/** The target line of a card (spec #2 §7.2). */
const ORDINALS = ['1st', '2nd', '3rd', '4th'];

/** "1st" to "4th" for a final place. */
export function ordinal(rank: number): string {
  return ORDINALS[rank - 1] ?? `${rank}th`;
}

export function targetLine(rule: TargetRule): string {
  if (rule.condition === 'self') return 'You';
  // EVERYONE in capitals; everyone but you is "Each opponent" (2026-10-16), so the two never read alike.
  if (rule.pick === 'all') return rule.condition === 'everyone' ? 'EVERYONE' : 'Each opponent';
  if (rule.condition === 'section') return `A player on tiles ${rule.section?.[0]}–${rule.section?.[1]}`;
  if (rule.condition === 'ahead-of-caster') return rule.pick === 'furthest' ? 'Furthest player ahead' : 'Nearest player ahead';
  if (rule.condition === 'behind-of-caster') return rule.pick === 'furthest' ? 'Furthest player behind' : 'Nearest player behind';
  if (rule.pick === 'leader') return 'The leader';
  if (rule.pick === 'last') return 'The player in last place';
  return rule.pick === 'furthest' ? 'The furthest player' : 'The nearest player';
}

export function cardInfo(id: string): CardInfo {
  const card = cardOf(id);
  return { id, name: card.name, text: card.text, type: card.type, rarity: card.rarity, targetLine: targetLine(card.target), icon: iconOf(id, card), summary: card.text };
}

/**
 * Why a card would fizzle if the board stayed as it is now, or null (spec #2 §7.2). Uses the
 * engine's own targeting rules on the view, so the warning matches what will happen.
 */
export function fizzleWarning(id: string, view: PlayerView): string | null {
  const card = cardOf(id);
  const me = view.players.find((p) => p.id === view.me);
  if (!me) return null;
  if (targetCandidates(view.players, me, card.target).length === 0) {
    if (card.target.condition === 'ahead-of-caster') return 'Nobody is ahead of you right now. If that holds, it fizzles.';
    if (card.target.condition === 'behind-of-caster') return 'Nobody is behind you right now. If that holds, it fizzles.';
    return 'Nobody it can aim at right now. If that holds, it fizzles.';
  }
  // A move-to-tile card is out while a rocket or whirlpool starts on its tile (2026-10-16).
  if (blockedByBoard([card], view.board).length > 0) return 'A rocket or whirlpool starts on its tile right now. If that holds, it fizzles.';
  // A "move to" card fizzles when its place is missing for every player it could hit (2026-10-16: every rule, and a
  // 50/50 card only when both of its places are missing), as the engine's moveToTile decides.
  const rules = moveToRules(card.effects);
  if (rules.length > 0) {
    const heads = (rocket: boolean) => view.board.jumps.filter((j) => j.to > j.from === rocket).map((j) => j.from);
    const fits = (rule: MoveToRule, from: number) =>
      rule === 'nearest-ladder-foot-ahead' ? heads(true).some((t) => t > from)
      : rule === 'snake-head-ahead' ? heads(false).some((t) => t > from)
      : rule === 'ladder-foot-behind' ? heads(true).some((t) => t < from)
      : heads(false).some((t) => t !== from);
    const targets = targetCandidates(view.players, me, card.target);
    if (!targets.some((t) => rules.some((r) => fits(r, t.position)))) {
      return `${MISSING_PLACE[rules[0]!].replace('{who}', card.target.condition === 'self' ? 'you' : 'them')} If that holds, it fizzles.`;
    }
  }
  return null;
}

type MoveToRule = 'nearest-ladder-foot-ahead' | 'snake-head-ahead' | 'ladder-foot-behind' | 'nearest-snake-head';
const MISSING_PLACE: Record<MoveToRule, string> = {
  'nearest-ladder-foot-ahead': 'No rocket ahead of {who} right now.',
  'snake-head-ahead': 'No whirlpool ahead of {who} right now.',
  'ladder-foot-behind': 'No rocket behind {who} right now.',
  'nearest-snake-head': 'No whirlpool on the board right now.',
};

/** The board-place "move to" rules in a card's steps, a gamble's outcomes included. */
function moveToRules(ops: CardDef['effects']): MoveToRule[] {
  return ops.flatMap((op): MoveToRule[] => {
    if (op.op === 'moveTo') return op.rule in MISSING_PLACE ? [op.rule as MoveToRule] : [];
    if (op.op === 'gamble') return op.outcomes.flatMap((o) => moveToRules(o.ops));
    return [];
  });
}

export interface EffectChip {
  id: string;
  icon: IconName;
  /** Short badge on the chip: "6", "×2", "−3", "=4", or the rounds left. */
  badge: string;
  name: string;
  /** What it does, written out (the your-piece panel and the details card). */
  description: string;
  /** How long it lasts. */
  life: string;
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

function lifeOf(effect: ActiveEffect): string {
  if (effect.lifetime === 'permanent') return 'Permanent';
  const parts: string[] = [];
  if (effect.lifetime.charges !== undefined) parts.push(effect.lifetime.charges === 1 ? '1 use' : `${effect.lifetime.charges} uses`);
  if (effect.lifetime.rounds !== undefined) parts.push(`until round ${effect.createdRound + effect.lifetime.rounds}`);
  return parts.join(' · ');
}

/** The chip for an active effect (spec #2 §7.2): icon, badge and words. */
export function effectChip(effect: ActiveEffect, names: ReadonlyMap<PlayerId, string>): EffectChip {
  const from = effect.sourcePlayer !== effect.owner ? `, from ${names.get(effect.sourcePlayer) ?? effect.sourcePlayer}` : '';
  const name = cardOf(effect.sourceCard).name;
  const p = effect.params;
  const base = { id: effect.id, name, life: lifeOf(effect) };
  switch (p.hook) {
    case 'diceFace':
      return { ...base, icon: 'die', badge: String(p.set), description: `${p.die === 'each' ? 'Every die' : 'Next die'} shows ${p.set}${from}` };
    case 'diceTotal':
      if (p.op === 'multiply') return { ...base, icon: 'x2', badge: `×${p.value}`, description: `Next dice total ×${p.value}${from}` };
      if (p.op === 'replace') return { ...base, icon: 'steady', badge: `=${p.value}`, description: `Next dice total becomes ${p.value}${from}` };
      return { ...base, icon: p.value < 0 ? 'boot' : 'arrow', badge: signed(p.value), description: `Next dice total ${signed(p.value)}${from}` };
    case 'beforeSnake':
      return { ...base, icon: 'charm', badge: roundsBadge(effect), description: `Ignores the next whirlpool${from}` };
    case 'beforeAttack':
      return { ...base, icon: 'shield', badge: roundsBadge(effect), description: `Blocks the next attack${from}` };
    case 'beforeSnakeOrAttack':
      return { ...base, icon: 'aegis', badge: roundsBadge(effect), description: `Blocks the next whirlpool or attack${from}` };
    case 'jumpsOff':
      return { ...base, icon: 'slide', badge: roundsBadge(effect), description: 'Rockets and whirlpools do nothing, for everyone' };
    case 'rollCheck': {
      const w = p.when === 'over3' ? 'over 3' : p.when;
      const then = 'multiply' in p.then ? `it's ×${p.then.multiply}` : 'shield' in p.then ? 'block a whirlpool or attack' : `go to the nearest rocket${p.otherwise === 'stay' ? ', else stay put' : ''}`;
      return { ...base, icon: 'multiply' in p.then ? 'x2' : 'shield' in p.then ? 'aegis' : 'pad', badge: w, description: `If the next roll is ${w}: ${then}${from}` };
    }
    case 'extraRoll':
      return { ...base, icon: 'die', badge: '+1', description: `Rolls again this round${from}` };
    case 'moreRerolls':
      return { ...base, icon: 'reroll', badge: '+1', description: `Next card hand: one more reroll on each card${from}` };
    case 'guardTile':
      return { ...base, icon: 'target', badge: roundsBadge(effect), description: `Anyone who lands on your tile is knocked back${from}` };
    case 'loseForward':
      return { ...base, icon: 'swords', badge: roundsBadge(effect), description: `Lose a face-off: move forward instead${from}` };
    case 'skipRoll':
      return { ...base, icon: 'lock', badge: roundsBadge(effect), description: `Skips the next roll${from}` };
    case 'reverseRoll':
      return { ...base, icon: 'back', badge: '←', description: `Next roll moves back${from}` };
    case 'afterMove':
      // "When" effects (2026-10-16): after a launch too, and moving each opponent.
      if (p.who === 'others') {
        const climb = p.condition === 'climbedLadder';
        return { ...base, icon: climb ? 'pad' : 'slide', badge: signed(p.amount), description: `When you ${climb ? 'ride a rocket' : 'hit a whirlpool'}, each opponent moves ${signed(p.amount)}${from}` };
      }
      if (p.condition === 'climbedLadder') return { ...base, icon: 'pad', badge: signed(p.amount), description: `After your next launch, you move ${signed(p.amount)}${from}` };
      return { ...base, icon: 'bait', badge: signed(p.amount), description: `Landing in a whirlpool moves you ${signed(p.amount)} after sliding${from}` };
  }
}

function roundsBadge(effect: ActiveEffect): string {
  if (effect.lifetime === 'permanent') return '∞';
  return effect.lifetime.charges !== undefined ? `×${effect.lifetime.charges}` : `${effect.lifetime.rounds ?? ''}r`;
}

/**
 * What changes my next roll, in the order the engine applies it (spec #1 §5.6): die faces,
 * then the newest Replace, then Multiply, then Add.
 */
export function nextRollMods(effects: ActiveEffect[], me: PlayerId): string[] {
  const mine = effects.filter((e) => e.owner === me).sort((a, b) => a.seq - b.seq);
  const out: string[] = [];
  // A skip and a backward roll (2026-10-16): the skip comes first, the turn backwards last.
  if (mine.some((e) => e.params.hook === 'skipRoll')) out.push('Skip');
  for (const e of mine) if (e.params.hook === 'diceFace') out.push(`Die = ${e.params.set}`);
  const totals = mine.flatMap((e) => (e.params.hook === 'diceTotal' ? [e.params] : []));
  const replace = totals.filter((t) => t.op === 'replace').at(-1);
  if (replace) out.push(`Total = ${replace.value}`);
  for (const t of totals) if (t.op === 'multiply') out.push(`Total ×${t.value}`);
  for (const t of totals) if (t.op === 'add') out.push(`Total ${signed(t.value)}`);
  for (const e of mine) {
    if (e.params.hook !== 'rollCheck') continue;
    const w = e.params.when === 'over3' ? 'over 3' : e.params.when;
    const then = e.params.then;
    out.push(`If ${w} ${'multiply' in then ? `×${then.multiply}` : 'shield' in then ? 'shield' : 'rocket'}`);
  }
  if (mine.some((e) => e.params.hook === 'reverseRoll')) out.push('Backward');
  return out;
}

/** A toast for an action the match turned down (spec #2 §8): usually a late or doubled tap. */
export function rejectionText(code: InputErrorCode): string {
  switch (code) {
    case 'STALE_INPUT':
    case 'STALE_TIMEOUT':
    case 'NOT_AWAITED':
    case 'WRONG_PHASE':
      return 'Too late, that window closed';
    case 'ALREADY_PICKED':
      return 'You already picked';
    case 'REROLL_LIMIT':
      return 'No rerolls left';
    case 'SLOT_ALREADY_REROLLED':
      return 'That card was already rerolled';
    case 'MATCH_FINISHED':
      return 'The match is over';
    default:
      return "That didn't work. Try again.";
  }
}
