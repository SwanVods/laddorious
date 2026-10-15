import { DEFAULT_TUNING, tuning } from '../app/tuning';
import type { ChallengeChoice, GameEvent, PlayerId } from '@laddorious/core';
import type { LoggedEvent } from '../director/director';
import { cardInfo } from './labels';

// Event feed lines (spec #2 §7.2): built from the events the director has shown.

/** Plain text, or a player's name (drawn in their seat colour). */
export type FeedPart = string | { player: PlayerId };

export interface FeedLine {
  seq: number;
  parts: FeedPart[];
  /** Only I can see it (my picks, my rerolls): drawn dashed. */
  private: boolean;
}

/** How many lines the feed keeps; phones show the first 3 (§7.2). */
/** The action log's lines by default; tuning.json can change it (2026-10-15). */
export const FEED_LINES = DEFAULT_TUNING.hud.feedLines;

const RARITY_PHRASE = { common: 'a Common', rare: 'a Rare', epic: 'an Epic' } as const;
const RPS_WORD: Record<string, string> = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };

/** "A", "A and B", "A, B and C" as parts. */
export function listParts(players: PlayerId[]): FeedPart[] {
  return players.flatMap((player, i): FeedPart[] => {
    const sep = i === 0 ? [] : i === players.length - 1 ? [' and '] : [', '];
    return [...sep, { player }];
  });
}

function choiceWord(choice: ChallengeChoice, theme: [string, string] | null | undefined): string {
  if (choice === 'A' || choice === 'B') return theme ? theme[choice === 'A' ? 0 : 1] : choice;
  return RPS_WORD[choice] ?? choice;
}

function lineFor(e: GameEvent, themes: ReadonlyMap<string, [string, string] | null>): FeedPart[] | null {
  switch (e.type) {
    case 'RoundStarted':
      return [`Round ${e.round} started`];
    case 'DieRolled':
      return [{ player: e.player }, ` rolled ${e.face}${e.forced ? ' (set by a card)' : ''}`];
    case 'DiceTotaled': {
      const sum = e.faces.reduce((a, b) => a + b, 0);
      return e.total === sum ? null : [{ player: e.player }, ` moves ${e.total} instead of ${sum}`];
    }
    case 'Moved':
      switch (e.cause) {
        case 'snake':
          return [{ player: e.player }, ` slid down to ${e.to}`];
        case 'ladder':
          return [{ player: e.player }, ` launched up to ${e.to}`];
        case 'knockback':
          return [{ player: e.player }, ` was knocked back to ${e.to}`];
        case 'card':
        case 'effect':
          return [{ player: e.player }, ` leapt to ${e.to}`];
        case 'stepBack':
          return [{ player: e.player }, ` stepped back to ${e.to}`];
        case 'dice':
          return null;
      }
      return null;
    case 'SnakeBlocked':
      return [{ player: e.player }, ' dodged a slide'];
    case 'ChallengeStarted':
      return [`Face-off on tile ${e.tile}: `, ...listParts(e.players)];
    case 'ChallengePickEcho':
      return ['You picked ', choiceWord(e.choice, themes.get(e.challengeId))];
    case 'ChallengeResolved':
      if (e.outcome === 'replay') return ['A tie! The face-off goes again'];
      if (e.outcome === 'continue') return ['The face-off goes on with ', ...listParts(Object.keys(e.picks).filter((p) => !e.losers.includes(p)))];
      return e.winner ? [{ player: e.winner }, e.outcome === 'random' ? ' wins the face-off by lot' : ' wins the face-off'] : null;
    case 'MysteryOffered':
      return [`You landed on ${RARITY_PHRASE[e.rarity]} ? square`];
    case 'CardRerolled':
      return ['You rerolled ', cardInfo(e.from).name, ' into ', cardInfo(e.to).name];
    case 'CardSelected':
      return [{ player: e.player }, ' picked ', cardInfo(e.cardId).name];
    case 'CardResolved': {
      const name = cardInfo(e.cardId).name;
      const rolled = e.roll !== undefined ? `: rolled ${e.roll}` : '';
      if (e.result === 'fizzled') return [{ player: e.caster }, `'s ${name} fizzled`];
      if (e.targets) {
        // A card for several players (2026-10-15): one line, who it hit and who blocked it.
        const parts: FeedPart[] = [{ player: e.caster }, ` used ${name}${rolled}`];
        const hit = e.targets.filter((t) => t !== e.caster);
        if (hit.length > 0) parts.push(', hit ', ...listParts(hit));
        if (e.blocked && e.blocked.length > 0) parts.push(', ', ...listParts(e.blocked), ' blocked it');
        return parts;
      }
      if (e.result === 'blocked' && e.target) return [{ player: e.target }, ` blocked ${name}`];
      if (e.target && e.target !== e.caster) return [name, e.roll !== undefined ? ` rolled ${e.roll} and hit ` : ' hit ', { player: e.target }];
      return [{ player: e.caster }, ` used ${name}${rolled}`];
    }
    case 'Clash':
      return ['Clash! ', e.cardIds.map((id) => cardInfo(id).name).join(' and '), ' cancel out'];
    case 'BoardEdited':
      return [{ player: e.edit.sourcePlayer }, ` changed the board with ${cardInfo(e.edit.sourceCard).name}`];
    case 'MatchWon':
      return [{ player: e.winner }, ' wins the match!'];
    default:
      return null;
  }
}

/** The newest feed lines first, at most `max`. */
export function feedLines(log: readonly LoggedEvent[], max = tuning().hud.feedLines): FeedLine[] {
  const themes = new Map<string, [string, string] | null>();
  const lines: FeedLine[] = [];
  for (const { seq, event } of log) {
    if (event.type === 'ChallengeStarted') themes.set(event.challengeId, event.theme);
    const parts = lineFor(event, themes);
    if (parts) lines.push({ seq, parts, private: event.visibility !== 'public' });
  }
  return lines.slice(-max).reverse();
}
