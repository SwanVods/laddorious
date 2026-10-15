import {
  STARTER_CARDS,
  createStream,
  nextInt,
  type CardDef,
  type ChallengeChoice,
  type EffectOp,
  type Input,
  type PlayerSeat,
  type PlayerView,
  type RngStream,
} from '@laddorious/core';

/** A bot sees only its own PlayerView (spec §8.1). 'idle' = do nothing this window. */
export interface Bot {
  decide(view: PlayerView): Input | 'idle';
}

const RPS: ChallengeChoice[] = ['rock', 'paper', 'scissors'];
const MINORITY: ChallengeChoice[] = ['A', 'B'];

function pendingChallenge(view: PlayerView) {
  if (view.phase.kind !== 'settle') return undefined;
  return view.phase.challenges.find(
    (c) => c.winner === null && c.contesting.includes(view.me) && view.myPicks[c.id] === undefined,
  );
}

function challengeInput(view: PlayerView, rng: RngStream): Input | 'idle' {
  const ch = pendingChallenge(view);
  if (!ch) return 'idle';
  const options = ch.kind === 'rps' ? RPS : MINORITY;
  return { type: 'challengePick', player: view.me, challengeId: ch.id, choice: options[nextInt(rng, options.length)]!, windowId: view.awaiting.windowId };
}

/** Uniformly random legal actions; idles for a whole window with probability afkPercent%. */
export class RandomBot implements Bot {
  private idleWindow = -1;
  private decidedWindow = -1;

  constructor(
    private readonly rng: RngStream,
    private readonly afkPercent = 0,
  ) {}

  decide(view: PlayerView): Input | 'idle' {
    const windowId = view.awaiting.windowId;
    if (windowId !== this.decidedWindow) {
      this.decidedWindow = windowId;
      if (this.afkPercent > 0 && nextInt(this.rng, 100) < this.afkPercent) this.idleWindow = windowId;
    }
    if (this.idleWindow === windowId) return 'idle';
    const me = view.me;
    const phase = view.phase;
    if (phase.kind === 'dice') {
      return phase.seqs[me]?.status === 'ready' ? { type: 'roll', player: me, windowId: view.awaiting.windowId } : 'idle';
    }
    if (phase.kind === 'settle') return challengeInput(view, this.rng);
    if (phase.kind === 'mysterySelect' && view.myOffer && view.myOffer.picked === null) {
      const offer = view.myOffer;
      const free = [0, 1, 2].filter((i) => !offer.rerolled[i]);
      if (offer.rerollsUsed < 2 && free.length > 0 && nextInt(this.rng, 10) < 3) {
        return { type: 'reroll', player: me, slot: free[nextInt(this.rng, free.length)]!, windowId: view.awaiting.windowId };
      }
      return { type: 'pickCard', player: me, slot: nextInt(this.rng, 3), windowId: view.awaiting.windowId };
    }
    return 'idle';
  }
}

/** Rough tile value of a card for the caster (spec §8.1 heuristic). */
export function scoreCard(card: CardDef, view: PlayerView): number {
  const me = view.players.find((p) => p.id === view.me)!;
  const selfTarget = card.target.condition === 'self';
  const value = (op: EffectOp): number => {
    switch (op.op) {
      case 'moveRelative':
        return selfTarget ? op.amount : -op.amount * 0.8;
      case 'moveTo':
        return 6;
      case 'swap': {
        const ahead = view.players.filter((p) => p.position > me.position).map((p) => p.position - me.position);
        return ahead.length > 0 ? Math.max(...ahead) : 0;
      }
      case 'addEffect': {
        const p = op.template.params;
        if (p.hook === 'diceFace') return 3;
        if (p.hook === 'diceTotal') {
          if (p.op === 'multiply') return 4 * (p.value - 1);
          if (p.op === 'replace') return p.value - 4;
          return selfTarget ? p.value : -p.value;
        }
        return 2;
      }
      case 'removeEffects':
        return view.effects.some((e) => e.owner === view.me && e.sourcePlayer !== view.me) ? 3 : 0;
      case 'boardEdit':
        return 2;
      case 'gamble': {
        const total = op.outcomes.reduce((a, o) => a + o.weight, 0);
        return op.outcomes.reduce((a, o) => a + (o.weight / total) * o.ops.reduce((b, x) => b + value(x), 0), 0);
      }
      case 'conditional':
        return 1;
    }
  };
  return card.effects.reduce((a, op) => a + value(op), 0);
}

/** Rolls when asked, plays face-offs by challengeInput, and picks its card at random (2026-10-15). */
export class HeuristicBot implements Bot {
  constructor(
    private readonly rng: RngStream,
    private readonly cards: readonly CardDef[],
    private readonly rerollBelow = 1,
  ) {}

  decide(view: PlayerView): Input | 'idle' {
    const me = view.me;
    const phase = view.phase;
    if (phase.kind === 'dice') {
      return phase.seqs[me]?.status === 'ready' ? { type: 'roll', player: me, windowId: view.awaiting.windowId } : 'idle';
    }
    if (phase.kind === 'settle') return challengeInput(view, this.rng);
    if (phase.kind === 'mysterySelect' && view.myOffer && view.myOffer.picked === null) {
      // A card at random, never rerolling (the user, 2026-10-15): scored picks never took a Risky card.
      return { type: 'pickCard', player: me, slot: nextInt(this.rng, view.myOffer.cards.length), windowId: view.awaiting.windowId };
    }
    return 'idle';
  }
}

export type PolicyName = 'random' | 'heuristic';

/** One bot per seat, each with its own seeded stream so batches are reproducible. */
export function makeBots(seats: PlayerSeat[], policy: PolicyName, seed: string, afkPercent: number): Record<string, Bot> {
  const bots: Record<string, Bot> = {};
  for (const seat of seats) {
    const rng = createStream(`${seed}|bot|${seat.id}`);
    bots[seat.id] = policy === 'random' ? new RandomBot(rng, afkPercent) : new HeuristicBot(rng, STARTER_CARDS);
  }
  return bots;
}
