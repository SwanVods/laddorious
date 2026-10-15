import { CARD_CATALOG, catalogProblems, formatCatalog, hashString } from '@laddorious/core';
import { describe, expect, it } from 'vitest';
import { handleCards as handle } from '../cardsPlugin';

const core = { catalogProblems, formatCatalog, hashString };
const handleCards = (method: string, body: string, file: { read(): string; write(t: string): void }) => handle(method, body, file, core);

function memoryFile(text = formatCatalog(CARD_CATALOG)) {
  const file = { text, read: () => file.text, write: (t: string) => void (file.text = t) };
  return file;
}

describe('the card editor endpoint (2026-10-15)', () => {
  it('reads the card file with its version', () => {
    const r = handleCards('GET', '', memoryFile());
    expect(r.status).toBe(200);
    expect((r.body as { catalog: unknown }).catalog).toEqual(CARD_CATALOG);
  });

  it('saves a sound catalogue in the fixed format', () => {
    const file = memoryFile();
    const { version } = handleCards('GET', '', file).body as { version: string };
    const catalog = { ...CARD_CATALOG, odds: { ...CARD_CATALOG.odds, maxRerolls: 1 } };
    const r = handleCards('PUT', JSON.stringify({ catalog, basedOn: version }), file);
    expect(r.status).toBe(200);
    expect(file.text).toBe(formatCatalog(catalog));
  });

  it('refuses a catalogue with problems, and leaves the file alone', () => {
    const file = memoryFile();
    const { version } = handleCards('GET', '', file).body as { version: string };
    const before = file.text;
    const r = handleCards('PUT', JSON.stringify({ catalog: { ...CARD_CATALOG, odds: { ...CARD_CATALOG.odds, maxRerolls: 9 } }, basedOn: version }), file);
    expect(r.status).toBe(400);
    expect((r.body as { problems: unknown[] }).problems).toEqual([{ cardId: null, message: 'Rerolls per hand must be 0 to 3.' }]);
    expect(file.text).toBe(before);
  });

  it('refuses to overwrite a file that changed since the editor read it', () => {
    const file = memoryFile();
    const { version } = handleCards('GET', '', file).body as { version: string };
    file.text = file.text.replace('"maxRerolls": 2', '"maxRerolls": 3');
    const r = handleCards('PUT', JSON.stringify({ catalog: CARD_CATALOG, basedOn: version }), file);
    expect(r.status).toBe(409);
    expect((r.body as { message: string }).message).toBe('The card file changed on disk since you opened it. Reload the editor, then make your change again.');
  });
});
