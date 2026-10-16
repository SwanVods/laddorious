import CHANGELOG_FILE from '../../../../CHANGELOG.md?raw';

/** The repo's CHANGELOG.md, bundled with the game (the user, 2026-10-17): every version bump writes its entry. */
export const CHANGELOG: string = CHANGELOG_FILE;

/** One release: its version, its date and what changed. */
export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

/** The releases in a changelog, newest first: each "## x.y.z — yyyy-mm-dd" heading and the "- " lines under it. */
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^## (\d+\.\d+\.\d+) — (\d{4}-\d{2}-\d{2})\s*$/);
    if (heading) entries.push({ version: heading[1]!, date: heading[2]!, changes: [] });
    else if (line.startsWith('- ') && entries.length > 0) entries.at(-1)!.changes.push(line.slice(2).trim());
  }
  return entries;
}
