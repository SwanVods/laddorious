import { rollDie } from '../rng/stream';
import { applyFaceEffects, applyTotalEffects, effectsOn, spendCharge } from './effects';
import type { DiceSeq, GameEvent, InputError, MatchState, Mover, PlayerId } from './types';
import { bounce, getPlayer, movePlayer, openWindow, pub } from './util';

type DicePhase = Extract<MatchState['phase'], { kind: 'dice' }>;

export function inputError(code: InputError['code'], message: string): InputError {
  return { code, message };
}

export function startDicePhase(s: MatchState, ev: GameEvent[]): void {
  const seqs: Record<PlayerId, DiceSeq> = {};
  for (const p of s.players) {
    // A skip (2026-10-16) is used up as the dice phase opens; the player sits this roll out.
    const skip = effectsOn(s, p.id, 'skipRoll')[0];
    if (skip) {
      spendCharge(s, ev, skip);
      ev.push(pub({ type: 'RollSkipped', player: p.id, effectId: skip.id }));
    }
    seqs[p.id] = { faces: [], status: skip ? 'skipped' : 'ready' };
  }
  s.phase = { kind: 'dice', seqs };
  openWindow(s, ev, 'dice', s.players.filter((p) => seqs[p.id]!.status === 'ready').map((p) => p.id));
}

function dicePhase(s: MatchState): DicePhase | null {
  return s.phase.kind === 'dice' ? s.phase : null;
}

/** Roll the player's one die for this round (spec §4.3, amended 2026-10-04: a 6 grants nothing extra). */
function rollOne(s: MatchState, ev: GameEvent[], player: PlayerId, auto: boolean): void {
  const phase = dicePhase(s)!;
  const seq = phase.seqs[player]!;
  const seat = getPlayer(s, player).seat;
  const natural = rollDie(s.rng.dice[seat]!);
  const { face, forced } = applyFaceEffects(s, ev, player, seq.faces.length, natural);
  seq.faces.push(face);
  ev.push(pub({ type: 'DieRolled', player, natural, face, forced, auto }));
  seq.status = 'done';
}

export function rollInput(s: MatchState, ev: GameEvent[], player: PlayerId): InputError | null {
  const phase = dicePhase(s);
  if (!phase) return inputError('WRONG_PHASE', 'not in the dice phase');
  const seq = phase.seqs[player];
  if (!seq) return inputError('UNKNOWN_PLAYER', `unknown player ${player}`);
  if (seq.status !== 'ready') return inputError('NOT_AWAITED', `${player} cannot roll now`);
  rollOne(s, ev, player, false);
  return null;
}

/** Dice window expiry: auto-roll everyone who has not rolled. The phase then ends; there is no grace window. */
export function diceTimeout(s: MatchState, ev: GameEvent[]): void {
  const phase = dicePhase(s)!;
  for (const p of s.players) if (phase.seqs[p.id]!.status === 'ready') rollOne(s, ev, p.id, true);
}

export function diceAwaited(phase: DicePhase): PlayerId[] {
  return Object.entries(phase.seqs)
    .filter(([, seq]) => seq.status === 'ready')
    .map(([id]) => id);
}

export function diceComplete(phase: DicePhase): boolean {
  return Object.values(phase.seqs).every((seq) => seq.status !== 'ready');
}

/** Totals with TOTAL-stage effects, then simultaneous movement with bounce (spec §4.3–4.4). */
export function finishDicePhase(s: MatchState, ev: GameEvent[]): void {
  const phase = dicePhase(s)!;
  const N = s.board.size;
  const movers: Mover[] = [];
  for (const p of s.players) {
    const seq = phase.seqs[p.id]!;
    if (seq.status === 'skipped') {
      s.lastTotals[p.id] = 0;
      continue;
    }
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
