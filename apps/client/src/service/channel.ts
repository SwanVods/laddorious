/** Fans values out to listeners. Values that arrive before the first listener are held for it. */
export class Channel<T> {
  private readonly listeners = new Set<(value: T) => void>();
  private held: T[] | null = [];

  emit(value: T): void {
    if (this.held) this.held.push(value);
    else for (const cb of this.listeners) cb(value);
  }

  on(cb: (value: T) => void): () => void {
    this.listeners.add(cb);
    const held = this.held ?? [];
    this.held = null;
    for (const value of held) cb(value);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
