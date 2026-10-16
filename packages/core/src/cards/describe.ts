import type { Amount, CatalogCard, Templated } from './catalogFile';
import { isDie, usesDie, type DieAmount, type EffectOp, type Lifetime, type TargetRule } from './types';

// A card's effect text, written from its steps (2026-10-15), so a buff or nerf keeps the text true.

type Op = Templated<EffectOp>;

/** Who a card hits, as the subject of a sentence; null for the caster. */
function subject(t: TargetRule): string | null {
  if (t.condition === 'self') return null;
  if (t.pick === 'all') return t.condition === 'everyone' ? 'Everyone' : 'Everyone else';
  if (t.condition === 'section') return `A player on tiles ${t.section?.[0]}–${t.section?.[1]}`;
  if (t.pick === 'leader') return 'The leader';
  if (t.pick === 'last') return 'The player in last place';
  if (t.condition === 'ahead-of-caster') return t.pick === 'furthest' ? 'The furthest player ahead' : 'The player just ahead of you';
  if (t.condition === 'behind-of-caster') return t.pick === 'furthest' ? 'The furthest player behind' : 'The player just behind you';
  return t.pick === 'furthest' ? 'The furthest player' : 'The nearest player';
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function describeCard(card: CatalogCard, values?: Record<string, number>): string {
  if (card.text) return card.text;
  const who = subject(card.target);
  /** A number as shown: fixed, picked, or the value's range. `sign` -1 shows it as a positive distance back. */
  const num = (a: Amount | DieAmount, sign = 1): string => {
    if (typeof a === 'number') return String(a * sign);
    if (isDie(a)) return 'that many';
    const picked = values?.[a.value];
    const neg = (a.negate ? -1 : 1) * sign;
    if (picked !== undefined) return String(picked * neg);
    const r = card.values?.[a.value];
    return r ? `${r.min}–${r.max}` : a.value;
  };
  const isBack = (a: Amount | DieAmount) => (typeof a === 'number' ? a < 0 : !!a.negate);
  /** "Your next roll", "The leader's next roll", "The next roll of the player just ahead of you". */
  const nextRoll = (what = 'next roll'): string => {
    if (!who) return `Your ${what}`;
    return who.includes(' of ') ? `The ${what} of ${lower(who)}` : `${who}'s ${what}`;
  };
  const life = (l: Templated<Lifetime>, shield: boolean): string => {
    if (l === 'permanent') return ' for the rest of the match';
    if (l.rounds !== undefined) return ` (${num(l.rounds)} round${l.rounds === 1 ? '' : 's'})`;
    return shield ? ', any time this match' : '';
  };
  /** A "when" effect (2026-10-16): after a slide or a climb, you move on, or everyone else moves. */
  const when = (condition: string, amount: Amount, who: string | undefined, l: Templated<Lifetime>): string => {
    const back = isBack(amount);
    const dist = num(amount, back ? -1 : 1);
    const dir = back ? 'back' : 'forward';
    if (who === 'others') {
      const happens = condition === 'climbedLadder' ? 'climb a ladder' : 'hit a snake';
      const rounds = l !== 'permanent' && l.charges === undefined && l.rounds !== undefined ? l.rounds : undefined;
      const head = rounds !== undefined ? `For ${num(rounds)} round${rounds === 1 ? '' : 's'}: if you ${happens}` : `Next time you ${happens}`;
      return `${head}, everyone else moves ${dir} ${dist}.`;
    }
    if (condition === 'climbedLadder') return `Next time you climb a ladder, move ${dir} ${dist} more.`;
    return `Next time you land on a snake head, move ${dir} ${dist} after sliding.`;
  };
  const sentence = (op: Op): string => {
    switch (op.op) {
      case 'moveRelative': {
        const dist = num(op.amount, isBack(op.amount) ? -1 : 1);
        const dir = isBack(op.amount) ? 'back' : 'forward';
        return who ? `${who} moves ${dir} ${dist}.` : `Move ${dir} ${dist}.`;
      }
      case 'moveTo':
        return who ? `${who} moves to the nearest ladder ahead.` : 'Move to the nearest ladder ahead of you.';
      case 'swap':
        return `Swap places with ${lower(who ?? 'yourself')}.`;
      case 'addEffect': {
        const p = op.template.params;
        const l = op.template.lifetime;
        const charges = l !== 'permanent' && typeof l.charges === 'number' ? l.charges : 1;
        switch (p.hook) {
          case 'diceFace':
            return `${nextRoll('next die')} shows ${num(p.set)}${life(l, false)}.`;
          case 'diceTotal':
            if (p.op === 'multiply') {
              const x = num(p.value);
              return `${nextRoll()} is ${x === '2' ? 'doubled' : x === '3' ? 'tripled' : `×${x}`}${life(l, false)}.`;
            }
            if (p.op === 'replace') return `${nextRoll()} is exactly ${num(p.value)}${life(l, false)}.`;
            if (isDie(p.value)) {
              // The card's die (2026-10-15): "that much"; a rounds-only effect lowers every roll till it ends.
              const rounds = l !== 'permanent' && l.charges === undefined && l.rounds !== undefined;
              if (!p.value.negate) return who ? `${nextRoll()} gets that much more${life(l, false)}.` : `Add it to your next roll${life(l, false)}.`;
              return rounds ? `${nextRoll('rolls')} are lower by that much${life(l, false)}.` : `${nextRoll()} is lower by that much${life(l, false)}.`;
            }
            return `${nextRoll()} gets ${isBack(p.value) ? '−' + num(p.value, -1) : '+' + num(p.value)}${life(l, false)}.`;
          case 'beforeAttack':
            return `Block the next ${charges > 1 ? `${charges} attacks` : 'attack'} on ${who ? lower(who) : 'you'}${life(l, true)}.`;
          case 'beforeSnake':
            return `Ignore the next ${charges > 1 ? `${charges} snakes` : 'snake'} you land on${life(l, true)}.`;
          case 'beforeSnakeOrAttack':
            return charges > 1 ? `Block the next ${charges} snakes or attacks${life(l, true)}.` : `Block the next snake or attack, whichever comes first${life(l, true)}.`;
          case 'jumpsOff':
            if (l === 'permanent' || l.rounds === undefined) return 'Snakes and ladders do nothing for the rest of the match.';
            return `Snakes and ladders do nothing for ${num(l.rounds)} round${l.rounds === 1 ? '' : 's'}.`;
          case 'rollCheck': {
            const w = p.when === 'over3' ? 'over 3' : p.when;
            const head = `If ${lower(nextRoll())} is ${w}`;
            const then = p.then;
            if ('multiply' in then) {
              const x = num(then.multiply);
              return `${head}, it is ${x === '2' ? 'doubled' : x === '3' ? 'tripled' : `×${x}`}.`;
            }
            if ('shield' in then) {
              const n = then.shield.charges;
              const what = n === 1 ? 'snake or attack' : `${num(n)} snakes or attacks`;
              const rounds = then.shield.rounds;
              return `${head}, block the next ${what}${rounds === undefined ? ', any time this match' : ` (${num(rounds)} round${rounds === 1 ? '' : 's'})`}.`;
            }
            return `${head}, go to the nearest ladder.${p.otherwise === 'stay' ? ' If not, stay put.' : ''}`;
          }
          case 'skipRoll': {
            const rolls = charges > 1 ? `next ${charges} rolls` : 'next roll';
            return who ? `${who} skips their ${rolls}.` : `Skip your ${rolls}.`;
          }
          case 'reverseRoll':
            return `${nextRoll()} moves ${who ? 'them' : 'you'} back.`;
          case 'afterMove':
            return when(p.condition, p.amount, p.who, l);
        }
        return '';
      }
      case 'removeEffects':
        return op.filter.createdByOthers ? 'Remove every effect other players put on you.' : `Remove ${op.count === 'all' ? 'all' : num(op.count)} of your effects.`;
      case 'boardEdit': {
        const where = who ? lower(who) : 'you';
        const rounds = op.lifetime === 'permanent' ? ' for the rest of the match' : ` (${num(op.lifetime.rounds)} round${op.lifetime.rounds === 1 ? '' : 's'})`;
        if (op.action === 'create') return `A new ${op.kind}, ${num(op.length)} tiles long, appears ${num(op.minAhead)}–${num(op.maxAhead)} tiles ahead of ${where}${rounds}.`;
        if (op.action === 'remove') return `The nearest ${op.kind} ahead of ${where} disappears${rounds}.`;
        if (op.action === 'move') return `The nearest ${op.kind} moves ${num(op.minAhead)}–${num(op.maxAhead)} tiles ahead of ${where}${rounds}.`;
        return `The nearest ${op.kind} gets ${num(op.lengthDelta)} tiles longer${rounds}.`;
      }
      case 'gamble': {
        const total = op.outcomes.reduce((sum, o) => sum + (typeof o.weight === 'number' ? o.weight : 1), 0);
        return op.outcomes
          .map((o) => `${Math.round(((typeof o.weight === 'number' ? o.weight : 1) / total) * 100)}%: ${o.ops.map((x) => lower(sentence(x))).join(' ')}`)
          .join(' ');
      }
      case 'conditional':
        return when(op.trigger.condition, op.amount, op.who, op.lifetime);
    }
  };
  const text = card.effects.map(sentence).join(' ');
  return usesDie(card) ? `Roll a die: ${lower(text)}` : upper(text);
}
