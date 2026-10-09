// The online scripts (spec #4 §8), run from the repository root:
//   pnpm serve              build the game for this server and run it on every network interface (Wi-Fi play)
//   pnpm dev:online         the Vite dev server against a local Worker, for working on online play
//   pnpm deploy:cloudflare  build the game and deploy the Worker (needs `wrangler login` first)
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = fileURLToPath(new URL('..', import.meta.url));
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));
const PORT = 8787;

/** Runs a command to the end; this script stops if it fails. */
function run(command, env = {}) {
  const result = spawnSync(command, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/** Starts a long-running command; this script ends when it does. */
function start(command, cwd, env = {}) {
  const child = spawn(command, { stdio: 'inherit', shell: true, cwd, env: { ...process.env, ...env } });
  child.on('exit', (code) => process.exit(code ?? 0));
}

const mode = process.argv[2];
if (mode === 'serve') {
  run('pnpm --filter @laddorious/client build', { VITE_SERVER: 'same-origin' });
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  console.log('\nLaddorious is starting. Open it on this computer or on any phone on the same Wi-Fi:');
  for (const host of ['localhost', ...lan]) console.log(`  http://${host}:${PORT}`);
  console.log('');
  start(`pnpm exec wrangler dev --ip 0.0.0.0 --port ${PORT}`, SERVER_DIR);
} else if (mode === 'dev') {
  mkdirSync(CLIENT_DIST, { recursive: true }); // wrangler wants the assets folder; Vite serves the game here
  start(`pnpm exec wrangler dev --port ${PORT}`, SERVER_DIR);
  start('pnpm --filter @laddorious/client dev', undefined, { VITE_SERVER: `ws://localhost:${PORT}` });
} else if (mode === 'deploy') {
  run('pnpm --filter @laddorious/client build', { VITE_SERVER: 'same-origin' });
  start('pnpm exec wrangler deploy', SERVER_DIR);
} else {
  console.error('usage: node apps/server/scripts/online.mjs serve|dev|deploy');
  process.exit(1);
}
