interface Entry {
  fn: () => void;
  /** The delay still to run: the full delay when set, the time left after a pause. */
  remaining: number;
  /** Epoch ms when an armed timer fires. */
  dueAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

/** Named one-shot timers that can all be frozen and resumed together (spec #2 C14). */
export class PausableTimers {
  private readonly entries = new Map<string, Entry>();
  private paused = false;

  /** Run fn after ms, replacing any timer with the same key. While paused, the timer starts frozen. */
  set(key: string, ms: number, fn: () => void): void {
    this.clear(key);
    const entry: Entry = { fn, remaining: ms, dueAt: 0, handle: null };
    this.entries.set(key, entry);
    if (!this.paused) this.arm(key, entry);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  /** Epoch ms when the timer fires; a frozen timer counts as if it resumed now. */
  dueAt(key: string): number | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    return this.paused ? Date.now() + entry.remaining : entry.dueAt;
  }

  clear(key: string): void {
    const entry = this.entries.get(key);
    if (entry && entry.handle !== null) clearTimeout(entry.handle);
    this.entries.delete(key);
  }

  clearAll(): void {
    for (const key of [...this.entries.keys()]) this.clear(key);
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const now = Date.now();
    for (const entry of this.entries.values()) {
      if (entry.handle !== null) clearTimeout(entry.handle);
      entry.handle = null;
      entry.remaining = Math.max(0, entry.dueAt - now);
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const [key, entry] of this.entries) this.arm(key, entry);
  }

  private arm(key: string, entry: Entry): void {
    entry.dueAt = Date.now() + entry.remaining;
    entry.handle = setTimeout(() => {
      this.entries.delete(key);
      entry.fn();
    }, entry.remaining);
  }
}
