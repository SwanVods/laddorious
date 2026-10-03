import { rollDie } from '../rng/stream';
import { applyFaceEffects, applyTotalEffects } from './effects';
import type { DiceSeq, GameEvent, InputError, MatchState, Mover, PlayerId } from './types';
import { bounce, getPlayer, movePlayer, openWindow, pub } from './util';

type DicePhase = Extract<MatchState['phase'], { kind: 'dice' }>;

export function inputError(code: InputError['code'], message: string): InputError {
  return { code, message };
}

export function startDicePhase(s: MatchState, ev: GameEvent[]): void {
  const seqs: Record<PlayerId, DiceSeq> = {};
  for (const p of s.players) seqs[p.id] = { faces: [], status: 'ready' };
  s.phase = { kind: 'dice', window: 'dice', seqs };
  openWindow(s, ev, 'dice', s.players.map((p) => p.id));
}

function dicePhase(s: MatchState): DicePhase | null {
  return s.phase.kind === 'dice' ? s.phase : null;
}

/** Roll one die for the player; a first-die 6 opens the bonus choice (spec §4.3). */
function rollOne(s: MatchState, ev: GameEvent[], player: PlayerId, auto: boolean): void {
  const phase = dicePhase(s)!;
  const seq = phase.seqs[player]!;
  const seat = getPlayer(s, player).seat;
  const natural = rollDie(s.rng.dice[seat]!);
  const { face, forced } = applyFaceEffects(s, ev, player, seq.faces.length, natural);
  seq.faces.push(face);
  ev.push(pub({ type: 'DieRolled', player, natural, face, forced, auto }));
  seq.status = face === 6 && seq.faces.length === 1 ? 'bonusPending' : 'done';
}

export function rollInput(s: MatchState, ev: GameEvent[], player: PlayerId): InputError | null {
  const phase = dicePhase(s);
  if (!phase) return inputError('WRONG_PHASE', 'not in the dice phase');
  const seq = phase.seqs[player];
  if (!seq) return inputError('UNKNOWN_PLAYER', `unknown player ${player}`);
  if (phase.window !== 'dice' || seq.status !== 'ready') return inputError('NOT_AWAITED', `${player} cannot roll now`);
  rollOne(s, ev, player, false);
  return null;
}

export function bonusChoiceInput(s: MatchState, ev: GameEvent[], player: PlayerId, rollAgain: boolean): InputError | null {
  const phase = dicePhase(s);
  if (!phase) return inputError('WRONG_PHASE', 'not in the dice phase');
  const seq = phase.seqs[player];
  if (!seq) return inputError('UNKNOWN_PLAYER', `unknown player ${player}`);
  if (seq.status !== 'bonusPending') return inputError('NOT_AWAITED', `${player} has no bonus roll pending`);
  ev.push(pub({ type: 'BonusChosen', player, rollAgain, auto: false }));
  if (rollAgain) rollOne(s, ev, player, false);
  else seq.status = 'done';
  return null;
}

/**
 * Dice window expiry: auto-roll anyone who has not rolled, then open one
 * bonusGrace window if any bonus choice is pending. Grace expiry = Stop.
 */
export function diceTimeout(s: MatchState, ev: GameEvent[]): void {
  const phase = dicePhase(s)!;
  if (phase.window === 'dice') {
    for (const p of s.players) if (phase.seqs[p.id]!.status === 'ready') rollOne(s, ev, p.id, true);
    const pending = s.players.filter((p) => phase.seqs[p.id]!.status === 'bonusPending').map((p) => p.id);
    if (pending.length > 0) {
      phase.window = 'bonusGrace';
      openWindow(s, ev, 'bonusGrace', pending);
    }
    return;
  }
  for (const p of s.players) {
    const seq = phase.seqs[p.id]!;
    if (seq.status === 'bonusPending') {
      ev.push(pub({ type: 'BonusChosen', player: p.id, rollAgain: false, auto: true }));
      seq.status = 'done';
    }
  }
}

export function diceAwaited(phase: DicePhase): PlayerId[] {
  return Object.entries(phase.seqs)
    .filter(([, seq]) => (phase.window === 'dice' ? seq.status !== 'done' : seq.status === 'bonusPending'))
    .map(([id]) => id);
}

export function diceComplete(phase: DicePhase): boolean {
  return Object.values(phase.seqs).every((seq) => seq.status === 'done');
}

/** Totals with TOTAL-stage effects, then simultaneous movement with bounce (spec §4.3–4.4). */
export function finishDicePhase(s: MatchState, ev: GameEvent[]): void {
  const phase = dicePhase(s)!;
  const N = s.board.size;
  const movers: Mover[] = [];
  for (const p of s.players) {
    const seq = phase.seqs[p.id]!;
    const sum = seq.faces.reduce((a, b) => a + b, 0);
    const total = applyTotalEffects(s, ev, p.id, sum);
    s.lastTotals[p.id] = total;
    ev.push(pub({ type: 'DiceTotaled', player: p.id, faces: [...seq.faces], total }));
  }
  for (const p of s.players) {
    const total = s.lastTotals[p.id]!;
    if (total === 0) continue;
    const raw = p.position + total;
    movePlayer(s, ev, p.id, bounce(raw, N), 'dice', raw > N);
    movers.push({ player: p.id, cause: 'dice' });
  }
  s.phase = { kind: 'settle', ctx: { movers, wave: 0, challenges: [] }, after: 'mysteryDetect' };
}
