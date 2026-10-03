import { challengePickInput, closePickRound } from './challenge';
import { bonusChoiceInput, diceComplete, diceTimeout, finishDicePhase, inputError, rollInput } from './dice';
import { assertInvariants } from './invariants';
import { beginResolution, continueResolution, mysteryAwaited, mysteryTimeout, pickCardInput, rerollInput, startMysteryOrEndRound } from './mystery';
import { runSettle } from './settle';
import type { GameEvent, Input, InputError, MatchState, StepResult } from './types';
import { clonePlain } from './util';

/** Apply one input. Pure from the outside: the given state is never mutated (spec §3.2). */
export function step(state: MatchState, input: Input): StepResult {
  if (state.phase.kind === 'finished') {
    return { ok: false, error: inputError('MATCH_FINISHED', 'the match is over') };
  }
  // config is never mutated, so it is shared rather than cloned (it holds the whole card list).
  const { config, ...rest } = state;
  const s: MatchState = { ...clonePlain(rest), config };
  const ev: GameEvent[] = [];
  const error = dispatch(s, ev, input);
  if (error) return { ok: false, error };
  advance(s, ev);
  if (s.config.checkInvariants) assertInvariants(s);
  return { ok: true, state: s, events: ev };
}

function dispatch(s: MatchState, ev: GameEvent[], input: Input): InputError | null {
  if (input.type !== 'timeout' && !s.players.some((p) => p.id === input.player)) {
    return inputError('UNKNOWN_PLAYER', `unknown player ${input.player}`);
  }
  switch (input.type) {
    case 'roll':
      return rollInput(s, ev, input.player);
    case 'bonusChoice':
      return bonusChoiceInput(s, ev, input.player, input.rollAgain);
    case 'challengePick':
      return challengePickInput(s, ev, input.player, input.challengeId, input.choice);
    case 'reroll':
      return rerollInput(s, ev, input.player, input.slot);
    case 'pickCard':
      return pickCardInput(s, ev, input.player, input.slot);
    case 'timeout':
      return timeout(s, ev, input.windowId);
  }
}

function timeout(s: MatchState, ev: GameEvent[], windowId: number): InputError | null {
  if (windowId !== s.windowId) return inputError('STALE_TIMEOUT', `window ${windowId} is not the current window ${s.windowId}`);
  switch (s.phase.kind) {
    case 'dice':
      diceTimeout(s, ev);
      return null;
    case 'settle':
      closePickRound(s, ev);
      return null;
    case 'mysterySelect':
      mysteryTimeout(s);
      return null;
    case 'finished':
      return inputError('MATCH_FINISHED', 'the match is over');
  }
}

/** Run the state machine forward until it needs player input or the match ends. */
export function advance(s: MatchState, ev: GameEvent[]): void {
  for (;;) {
    const phase = s.phase;
    switch (phase.kind) {
      case 'dice':
        if (!diceComplete(phase)) return;
        finishDicePhase(s, ev);
        break;
      case 'settle':
        if (runSettle(s, ev) === 'waiting') return;
        if (phase.after === 'mysteryDetect') startMysteryOrEndRound(s, ev);
        else continueResolution(s, ev);
        break;
      case 'mysterySelect':
        if (mysteryAwaited(phase).length > 0) return;
        beginResolution(s, ev);
        break;
      case 'finished':
        return;
    }
  }
}
