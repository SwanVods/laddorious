import { readFileSync, writeFileSync } from 'node:fs';
import { normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardCatalog, CardProblem } from '@laddorious/core';
import type { Plugin } from 'vite';

// The card editor's endpoint (2026-10-15): the dev server reads and saves the card file. Dev only: a build
// never includes it, so the deployed game can't change its cards. Vite loads this file with plain Node, which
// can't import core's TypeScript, so core's functions come in through the dev server at request time.

const CARD_FILE = fileURLToPath(new URL('../../packages/core/src/cards/cards.json', import.meta.url));

interface TextFile {
  read(): string;
  write(text: string): void;
}

/** The parts of core the endpoint uses. */
export interface CardsCore {
  catalogProblems(catalog: CardCatalog): CardProblem[];
  formatCatalog(catalog: CardCatalog): string;
  hashString(text: string): string;
}

export function handleCards(method: string, body: string, file: TextFile, core: CardsCore): { status: number; body: unknown } {
  const text = file.read();
  const version = core.hashString(text);
  if (method === 'GET') return { status: 200, body: { catalog: JSON.parse(text) as CardCatalog, version } };
  if (method !== 'PUT') return { status: 405, body: { message: 'Only GET and PUT.' } };
  let parsed: { catalog: CardCatalog; basedOn: string };
  try {
    parsed = JSON.parse(body) as { catalog: CardCatalog; basedOn: string };
  } catch {
    return { status: 400, body: { problems: [{ cardId: null, message: 'The editor sent something that isn’t JSON.' }] } };
  }
  if (parsed.basedOn !== version) {
    return { status: 409, body: { message: 'The card file changed on disk since you opened it. Reload the editor, then make your change again.' } };
  }
  const problems = core.catalogProblems(parsed.catalog);
  if (problems.length > 0) return { status: 400, body: { problems } };
  const next = core.formatCatalog(parsed.catalog);
  file.write(next);
  return { status: 200, body: { version: core.hashString(next) } };
}

export function cardsPlugin(path = CARD_FILE): Plugin {
  const file: TextFile = { read: () => readFileSync(path, 'utf8'), write: (t) => writeFileSync(path, t) };
  return {
    name: 'laddorious-cards',
    apply: 'serve',
    // The editor already holds what it saved: a reload would lose its place and its "Saved." (2026-10-15).
    handleHotUpdate({ file: changed }) {
      if (normalize(changed).toLowerCase() === normalize(path).toLowerCase()) return [];
    },
    configureServer(server) {
      server.middlewares.use('/__cards', (req, res) => {
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
        req.on('end', () => {
          void server
            .ssrLoadModule('@laddorious/core')
            .then((core) => handleCards(req.method ?? 'GET', body, file, core as unknown as CardsCore))
            .then(
              (out) => {
                res.statusCode = out.status;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify(out.body));
              },
              (e: unknown) => {
                res.statusCode = 500;
                res.end(JSON.stringify({ message: `The card file couldn’t be read or saved: ${String(e)}` }));
              },
            );
        });
      });
    },
  };
}
