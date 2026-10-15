import type { CardCatalog, CardProblem } from '@laddorious/core';

export type SaveResult = { ok: true; version: string } | { ok: false; message: string; problems: CardProblem[] };

export async function loadCards(): Promise<{ catalog: CardCatalog; version: string }> {
  const res = await fetch('/__cards');
  if (!res.ok) throw new Error(`The card file couldn't be read (${res.status}). Is \`pnpm cards\` running?`);
  return (await res.json()) as { catalog: CardCatalog; version: string };
}

export async function saveCards(catalog: CardCatalog, basedOn: string): Promise<SaveResult> {
  const res = await fetch('/__cards', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ catalog, basedOn }) });
  const body = (await res.json()) as { version?: string; message?: string; problems?: CardProblem[] };
  if (res.ok) return { ok: true, version: body.version! };
  return { ok: false, message: body.message ?? 'Some cards have problems: fix them, then save again.', problems: body.problems ?? [] };
}

export interface CardsApi {
  loadCards: typeof loadCards;
  saveCards: typeof saveCards;
}
