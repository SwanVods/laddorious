import {
  CARD_TYPES,
  STARTER_CARDS,
  createMatch,
  scriptedStream,
  step,
  type Board,
  type CardDef,
  type GameEvent,
  type Input,
  type MatchConfigInput,
  type MatchState,
  type Rarity,
} from '../../src/index';

export function makeBoard(size: number, jumps: Array<[number, number]> = [], mystery: Record<number, Rarity> = {}): Board {
  return {
    size,
    jumps: jumps.map(([from, to], i) => ({ id: `t${i + 1}`, from, to })),
    mystery,
    seed: 'test',
    generatorVersion: 1,
  };
}

/** Scripted dice stream: faces are 1..6. */
export function dice(...faces: number[]) {
  return scriptedStream(faces.map((f) => f - 1));
}

export interface Setup {
  board?: Board;
  players?: number;
  positions?: number[];
  dice?: number[][];
  misc?: number[];
  cards?: number[][];
  config?: Omit<MatchConfigInput, 'seed'>;
}

/** A match in round 1's dice window with a hand-built board and optional scripted streams. */
export function setup(opts: Setup = {}): MatchState {
  const n = opts.players ?? 2;
  const seats = Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}` }));
  const s = createMatch({ seed: 'test', ...opts.config }, seats, opts.board ?? makeBoard(100));
  opts.positions?.forEach((pos, i) => {
    s.players[i]!.position = pos;
  });
  opts.dice?.forEach((faces, i) => {
    s.rng.dice[i] = dice(...faces);
  });
  if (opts.misc) s.rng.misc = scriptedStream(opts.misc);
  opts.cards?.forEach((vals, i) => {
    s.rng.cards[i] = scriptedStream(vals);
  });
  return s;
}

/** Apply inputs in order; throws if any is rejected. */
export function play(s: MatchState, inputs: Array<Input | ((cur: MatchState) => Input)>): { state: MatchState; events: GameEvent[] } {
  let cur = s;
  const events: GameEvent[] = [];
  for (const item of inputs) {
    const input = typeof item === 'function' ? item(cur) : item;
    const r = step(cur, input);
    if (!r.ok) throw new Error(`${JSON.stringify(input)} rejected: ${r.error.code} ${r.error.message}`);
    cur = r.state;
    events.push(...r.events);
  }
  return { state: cur, events };
}

// Player inputs carry the window they answer; these helpers stamp the current one when applied.
export const roll = (player: string) => (cur: MatchState): Input => ({ type: 'roll', player, windowId: cur.windowId });
export const pick = (player: string, slot: number) => (cur: MatchState): Input => ({ type: 'pickCard', player, slot, windowId: cur.windowId });
export const reroll = (player: string, slot: number) => (cur: MatchState): Input => ({ type: 'reroll', player, slot, windowId: cur.windowId });
/** Timeout for whatever window is current when the input is applied. */
export const timeout = (cur: MatchState): Input => ({ type: 'timeout', windowId: cur.windowId });

/** Pick in the open challenge containing `player`. */
export const choose =
  (player: string, choice: 'rock' | 'paper' | 'scissors' | 'A' | 'B') =>
  (cur: MatchState): Input => {
    if (cur.phase.kind !== 'settle') throw new Error('no challenge open');
    const ch = cur.phase.ctx.challenges.find((c) => c.winner === null && c.contesting.includes(player));
    if (!ch) throw new Error(`${player} is not in an open challenge`);
    return { type: 'challengePick', player, challengeId: ch.id, choice, windowId: cur.windowId };
  };

export function ofType<T extends GameEvent['type']>(events: GameEvent[], type: T): Array<Extract<GameEvent, { type: T }>> {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}

export function positions(s: MatchState): number[] {
  return s.players.map((p) => p.position);
}

/**
 * Scripted card-stream values that make drawCard() return `cardId`
 * (type pick by weight, then card pick by weight within the bucket).
 */
export function drawValues(cardId: string, excludeId?: string, cards: CardDef[] = STARTER_CARDS): number[] {
  const card = cards.find((c) => c.id === cardId)!;
  const buckets = CARD_TYPES.map((t) => cards.filter((c) => c.type === t && c.rarity === card.rarity && c.id !== excludeId));
  const typeIdx = CARD_TYPES.indexOf(card.type);
  const typeValue = buckets.slice(0, typeIdx).filter((b) => b.length > 0).length;
  const bucket = buckets[typeIdx]!;
  const cardIdx = bucket.findIndex((c) => c.id === cardId);
  const cardValue = bucket.slice(0, cardIdx).reduce((a, c) => a + c.weight, 0);
  return [typeValue, cardValue];
}

/** Values for three offered cards. */
export function offerValues(...ids: [string, string, string]): number[] {
  return ids.flatMap((id) => drawValues(id));
}
