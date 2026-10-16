// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pkg from '../package.json';
import { CHANGELOG, parseChangelog } from '../src/app/changelog';
import { WhatsNewDialog } from '../src/app/WhatsNewDialog';

afterEach(cleanup);

// The changelog (the user, 2026-10-17): CHANGELOG.md at the repo root, shown in the lobby under What's new.
// Every version bump writes its entry: a release without one fails here.

const ROOT_FILE = readFileSync(resolve(__dirname, '../../../CHANGELOG.md'), 'utf8');

describe('the changelog (2026-10-17)', () => {
  it('reads versions, dates and changes from the file, newest first', () => {
    const text = '# Changelog\n\nIntro.\n\n## 1.2.0 — 2026-10-17\n\n- One.\n- Two.\n\n## 1.1.0 — 2026-10-01\n\n- Old.\n';
    expect(parseChangelog(text)).toEqual([
      { version: '1.2.0', date: '2026-10-17', changes: ['One.', 'Two.'] },
      { version: '1.1.0', date: '2026-10-01', changes: ['Old.'] },
    ]);
  });

  it("is the repo's CHANGELOG.md", () => {
    expect(CHANGELOG.replace(/\r\n/g, '\n')).toBe(ROOT_FILE.replace(/\r\n/g, '\n'));
  });

  it('has an entry for this version, so every bump writes one', () => {
    const entries = parseChangelog(CHANGELOG);
    expect(entries.map((e) => e.version)).toContain(pkg.version);
  });

  it('keeps one entry per version, each with its changes and a date, newest first', () => {
    const entries = parseChangelog(CHANGELOG);
    expect(new Set(entries.map((e) => e.version)).size).toBe(entries.length);
    for (const e of entries) {
      expect(e.changes.length, e.version).toBeGreaterThan(0);
      expect(e.date, e.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const order = entries.map((e) => e.version.split('.').map(Number));
    for (let i = 1; i < order.length; i++) {
      const [a, b] = [order[i - 1]!, order[i]!];
      expect(a[0]! * 1e6 + a[1]! * 1e3 + a[2]!, entries[i]!.version).toBeGreaterThan(b[0]! * 1e6 + b[1]! * 1e3 + b[2]!);
    }
  });
});

describe("What's new in the lobby (2026-10-17)", () => {
  it('lists every version with its changes', () => {
    render(<WhatsNewDialog onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: "What's new" })).toBeTruthy();
    for (const entry of parseChangelog(CHANGELOG)) {
      expect(screen.getByRole('heading', { name: `v${entry.version}` })).toBeTruthy();
      expect(screen.getAllByText(entry.changes[0]!).length).toBeGreaterThan(0);
    }
  });

  it('closes from its close button', () => {
    const onClose = vi.fn();
    render(<WhatsNewDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
