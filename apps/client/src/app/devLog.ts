import type { GameEvent, PlayerId } from '@laddorious/core';

/** One dev-log line: the event type, then each field, with player ids shown as nicknames. */
export function formatEvent(event: GameEvent, names: ReadonlyMap<PlayerId, string>): string {
  const { type, visibility, ...fields } = event;
  const parts = Object.entries(fields).map(([key, value]) => {
    const shown = rename(value, names);
    return `${key}=${typeof shown === 'object' && shown !== null ? JSON.stringify(shown) : String(shown)}`;
  });
  return [visibility === 'public' ? type : `${type} (private)`, ...parts].join(' ');
}

function rename(value: unknown, names: ReadonlyMap<PlayerId, string>): unknown {
  if (typeof value === 'string') return names.get(value) ?? value;
  if (Array.isArray(value)) return value.map((v) => rename(v, names));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [names.get(k) ?? k, rename(v, names)]));
  }
  return value;
}
