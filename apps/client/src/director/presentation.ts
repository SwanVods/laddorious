import type { ActiveEffect, BoardEdit, GameEvent, Jump, PlayerId, PlayerView } from '@laddorious/core';

/** A face-off in progress: its pieces stand side by side instead of stacked (spec #2 §5.1). */
export interface FaceOff {
  challengeId: string;
  tile: number;
  players: PlayerId[];
}

/**
 * What the board shows (spec #2 §5.2). Beats animate it, and it is reset to the
 * engine's view at the end of every timeline.
 */
export interface PresentationState {
  round: number;
  /** Tile per player; 0 is the off-board start. */
  positions: Record<PlayerId, number>;
  /** Players in order of their latest move: on a shared tile, later arrivals stand on top. */
  arrivals: PlayerId[];
  effects: ActiveEffect[];
  boardEdits: BoardEdit[];
  jumps: Jump[];
  faceOffs: FaceOff[];
}

/** The presentation a view implies. Stack order isn't in the view, so `arrivals` keeps it where it can. */
export function presentationFromView(view: PlayerView, arrivals: PlayerId[] = []): PresentationState {
  const ids = view.players.map((p) => p.id);
  return {
    round: view.round,
    positions: Object.fromEntries(view.players.map((p) => [p.id, p.position])),
    arrivals: [...arrivals.filter((id) => ids.includes(id)), ...ids.filter((id) => !arrivals.includes(id))],
    effects: view.effects,
    boardEdits: view.boardEdits,
    jumps: view.board.jumps,
    faceOffs:
      view.phase.kind === 'settle'
        ? view.phase.challenges
            .filter((c) => c.winner === null)
            .map((c) => ({ challengeId: c.id, tile: c.tile, players: [...c.participants] }))
        : [],
  };
}

/** The presentation after one event. Never mutates its input. */
export function applyEvent(state: PresentationState, event: GameEvent): PresentationState {
  switch (event.type) {
    case 'RoundStarted':
      return { ...state, round: event.round };
    case 'Moved':
      return {
        ...state,
        positions: { ...state.positions, [event.player]: event.to },
        arrivals: [...state.arrivals.filter((id) => id !== event.player), event.player],
      };
    case 'ChallengeStarted':
      return { ...state, faceOffs: [...state.faceOffs, { challengeId: event.challengeId, tile: event.tile, players: [...event.players] }] };
    case 'ChallengeResolved':
      return event.winner === null ? state : { ...state, faceOffs: state.faceOffs.filter((f) => f.challengeId !== event.challengeId) };
    case 'EffectAdded':
      return { ...state, effects: [...state.effects, event.effect] };
    case 'EffectRemoved':
    case 'EffectExpired':
      return { ...state, effects: state.effects.filter((e) => e.id !== event.effectId) };
    case 'BoardEdited': {
      const removed = new Set(event.edit.removed.map((j) => j.id));
      return {
        ...state,
        boardEdits: [...state.boardEdits, event.edit],
        jumps: [...state.jumps.filter((j) => !removed.has(j.id)), ...event.edit.added],
      };
    }
    case 'BoardEditExpired': {
      const edit = state.boardEdits.find((e) => e.id === event.editId);
      if (!edit) return state;
      const added = new Set(edit.added.map((j) => j.id));
      return {
        ...state,
        boardEdits: state.boardEdits.filter((e) => e.id !== event.editId),
        jumps: [...state.jumps.filter((j) => !added.has(j.id)), ...edit.removed.filter((j) => event.restored.includes(j.id))],
      };
    }
    default:
      return state;
  }
}

/**
 * Do two presentations show the same board? Stack order is the director's own, and the
 * engine spends effect charges in place without an event, so effects compare by id.
 */
export function samePresentation(a: PresentationState, b: PresentationState): boolean {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}

function comparable(s: PresentationState) {
  return {
    round: s.round,
    positions: Object.entries(s.positions).sort(([x], [y]) => x.localeCompare(y)),
    effects: s.effects.map((e) => e.id).sort(),
    boardEdits: s.boardEdits.map((e) => e.id).sort(),
    jumps: s.jumps.map((j) => `${j.id}:${j.from}>${j.to}`).sort(),
    faceOffs: s.faceOffs.map((f) => `${f.challengeId}@${f.tile}:${f.players.join(',')}`).sort(),
  };
}

/** The players standing on a tile, bottom of the stack first. */
export function stackOn(state: PresentationState, tile: number): PlayerId[] {
  return state.arrivals.filter((id) => state.positions[id] === tile);
}
