import { STARTER_CARDS, cardById, targetCandidates, type ActiveEffect, type CardDef, type InputErrorCode, type PlayerId, type PlayerView, type TargetRule } from '@laddorious/core';
import type { PieceId } from '../service/matchService';

// Words and icons for cards and effects (spec #2 §7.2). The engine plays the starter set, so
// the client reads names, texts and targets from it.

/** How the HUD names each piece. */
export const PIECE_NAMES: Record<PieceId, string> = { knight: 'Knight', pawn: 'Pawn', meeple: 'Meeple', dragon: 'Dragon head' };

/** Icon names drawn by ui/Icon.tsx. */
export type IconName =
  | 'arrow' | 'die' | 'x2' | 'pad' | 'charm' | 'shield' | 'aegis' | 'push' | 'boot' | 'swap' | 'coin' | 'bait'
  | 'jackpot' | 'steady' | 'cleanse' | 'slide' | 'card' | 'lock' | 'check' | 'bolt' | 'eye' | 'reroll' | 'target'
  | 'qmark' | 'swords' | 'gear' | 'close' | 'play' | 'back' | 'next' | 'menu' | 'pencil' | 'trophy'
  | 'rock' | 'paper' | 'scissors' | 'speaker' | 'speaker-off';

const CARD_ICONS: Record<string, IconName> = {
  sprint: 'arrow',
  'loaded-die': 'die',
  overdrive: 'x2',
  'ladder-warp': 'pad',
  'snake-charm': 'charm',
  shield: 'shield',
  aegis: 'aegis',
  shove: 'push',
  'heavy-boots': 'boot',
  switcheroo: 'swap',
  'coin-flip': 'coin',
  'snake-bait': 'bait',
  jackpot: 'jackpot',
  'steady-hand': 'steady',
  cleanse: 'cleanse',
  'snake-pit': 'slide',
  'ladder-drop': 'pad',
};

/** One line per card for its bubble beside the player column (polish pass): the gist, not the rules text. */
const CARD_SUMMARIES: Record<string, string> = {
  sprint: 'Move forward 3',
  'loaded-die': 'Next die shows 6',
  overdrive: 'Next dice total ×2',
  'ladder-warp': 'Jump to the next ladder',
  'steady-hand': 'Next dice total is exactly 4',
  'snake-charm': 'Ignore the next snake',
  shield: 'Block the next attack',
  aegis: 'Block attacks and snakes, 2 rounds',
  shove: 'Nearest player ahead goes back 3',
  'heavy-boots': "Leader's next total −3",
  switcheroo: 'Swap with the furthest ahead',
  'coin-flip': '50/50: forward 4 or back 4',
  jackpot: '40%: forward 15 · 60%: back 8',
  'snake-bait': 'Land on a snake head? Forward 8 after',
  cleanse: "Remove others' effects on you",
  'snake-pit': 'New snake ahead of the leader',
  'ladder-drop': 'New ladder ahead of you',
};

export interface CardInfo {
  id: string;
  name: string;
  text: string;
  type: CardDef['type'];
  rarity: CardDef['rarity'];
  /** Who it aims at, as shown before picking: the exact target stays hidden until it resolves. */
  targetLine: string;
  icon: IconName;
  /** One line for the card's bubble; falls back to the full text for a card without one. */
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
  if (rule.condition === 'section') return `A player on tiles ${rule.section?.[0]}–${rule.section?.[1]}`;
  if (rule.condition === 'ahead-of-caster') return rule.pick === 'furthest' ? 'Furthest player ahead' : 'Nearest player ahead';
  if (rule.condition === 'behind-of-caster') return rule.pick === 'furthest' ? 'Furthest player behind' : 'Nearest player behind';
  if (rule.pick === 'leader') return 'The leader';
  if (rule.pick === 'last') return 'The player in last place';
  return rule.pick === 'furthest' ? 'The furthest player' : 'The nearest player';
}

export function cardInfo(id: string): CardInfo {
  const card = cardById(STARTER_CARDS, id);
  return { id, name: card.name, text: card.text, type: card.type, rarity: card.rarity, targetLine: targetLine(card.target), icon: CARD_ICONS[id] ?? 'card', summary: CARD_SUMMARIES[id] ?? card.text };
}

/**
 * Why a card would fizzle if the board stayed as it is now, or null (spec #2 §7.2). Uses the
 * engine's own targeting rules on the view, so the warning matches what will happen.
 */
export function fizzleWarning(id: string, view: PlayerView): string | null {
  const card = cardById(STARTER_CARDS, id);
  const me = view.players.find((p) => p.id === view.me);
  if (!me) return null;
  if (targetCandidates(view.players, me, card.target).length === 0) {
    if (card.target.condition === 'ahead-of-caster') return 'Nobody is ahead of you right now. If that holds, it fizzles.';
    if (card.target.condition === 'behind-of-caster') return 'Nobody is behind you right now. If that holds, it fizzles.';
    return 'Nobody it can aim at right now. If that holds, it fizzles.';
  }
  const needsLadderAhead = card.effects.some((op) => op.op === 'moveTo' && op.rule === 'nearest-ladder-foot-ahead');
  if (needsLadderAhead && !view.board.jumps.some((j) => j.to > j.from && j.from > me.position)) {
    return 'No launch pad ahead of you right now. If that holds, it fizzles.';
  }
  return null;
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
  const name = cardById(STARTER_CARDS, effect.sourceCard).name;
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
      return { ...base, icon: 'charm', badge: roundsBadge(effect), description: `Ignores the next slide${from}` };
    case 'beforeAttack':
      return { ...base, icon: 'shield', badge: roundsBadge(effect), description: `Blocks the next attack${from}` };
    case 'afterMove':
      return { ...base, icon: 'bait', badge: signed(p.amount), description: `Landing on a slide's vacuum moves you ${signed(p.amount)} after sliding${from}` };
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
  for (const e of mine) if (e.params.hook === 'diceFace') out.push(`Die = ${e.params.set}`);
  const totals = mine.flatMap((e) => (e.params.hook === 'diceTotal' ? [e.params] : []));
  const replace = totals.filter((t) => t.op === 'replace').at(-1);
  if (replace) out.push(`Total = ${replace.value}`);
  for (const t of totals) if (t.op === 'multiply') out.push(`Total ×${t.value}`);
  for (const t of totals) if (t.op === 'add') out.push(`Total ${signed(t.value)}`);
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
