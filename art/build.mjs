// pnpm art [ids…]: rebuild the Blender models headless (spec #5 §5). Needs Blender 5.2: set
// BLENDER to its executable (e.g. E:\Software\Blender\blender.exe), or have `blender` on the PATH.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const build = fileURLToPath(new URL('./build.py', import.meta.url));
const blender = process.env.BLENDER || 'blender';
const result = spawnSync(blender, ['--background', '--factory-startup', '--python', build, '--', ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) {
  console.error(`Couldn't start Blender (${blender}). Set BLENDER to Blender's executable, e.g. E:\\Software\\Blender\\blender.exe.`);
  process.exit(1);
}
process.exit(result.status ?? 1);
