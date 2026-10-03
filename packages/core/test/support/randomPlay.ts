import { awaiting, createMatch, step, type GameEvent, type Input, type MatchState } from '../../src/index';

/** A legal input chosen by `choice` (any non-negative integer), or a timeout. */
export function chooseInput(s: MatchState, choice: number): Input {
  const aw = awaiting(s);
  const slot = choice % (aw.players.length + 1);
  if (slot === aw.players.length) return { type: 'timeout', windowId: aw.windowId };
  const player = aw.players[slot]!;
  const phase = s.phase;
  const bit = Math.floor(choice / 7);
  switch (phase.kind) {
    case 'dice':
      return phase.seqs[player]!.status === 'ready'
        ? { type: 'roll', player }
        : { type: 'bonusChoice', player, rollAgain: bit % 2 === 0 };
    case 'settle': {
      const ch = phase.ctx.challenges.find((c) => c.winner === null && c.contesting.includes(player) && c.picks[player] === undefined)!;
      const options = ch.kind === 'rps' ? (['rock', 'paper', 'scissors'] as const) : (['A', 'B'] as const);
      return { type: 'challengePick', player, challengeId: ch.id, choice: options[bit % options.length]! };
    }
    case 'mysterySelect': {
      const offer = phase.offers[player]!;
      const freeSlot = [0, 1, 2].find((i) => !offer.rerolled[i]);
      if (bit % 4 === 3 && offer.rerollsUsed < s.config.mystery.maxRerolls && freeSlot !== undefined) {
        return { type: 'reroll', player, slot: freeSlot };
      }
      return { type: 'pickCard', player, slot: bit % 3 };
    }
    case 'finished':
      throw new Error('match is finished');
  }
}

export interface RandomRun {
  state: MatchState;
  inputs: Input[];
  events: GameEvent[];
}

/** Play a whole match with choices drawn cyclically from `choices`. Throws on any rejected input. */
export function playRandom(seed: string, players: number, choices: number[], maxSteps = 20_000): RandomRun {
  const seats = Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}` }));
  let s = createMatch({ seed }, seats);
  const inputs: Input[] = [];
  const events: GameEvent[] = [];
  for (let i = 0; s.phase.kind !== 'finished'; i++) {
    if (i >= maxSteps) throw new Error(`no winner after ${maxSteps} steps`);
    const input = chooseInput(s, choices[i % choices.length]!);
    const r = step(s, input);
    if (!r.ok) throw new Error(`rejected ${JSON.stringify(input)}: ${r.error.code}`);
    s = r.state;
    inputs.push(input);
    events.push(...r.events);
  }
  return { state: s, inputs, events };
}
