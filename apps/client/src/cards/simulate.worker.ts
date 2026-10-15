import { simulateCards } from '@laddorious/sim';
import type { CardCatalog } from '@laddorious/core';

// Runs the card editor's Simulate off the page's thread (2026-10-15).
self.onmessage = (e: MessageEvent<{ catalog: CardCatalog; matches: number }>) => {
  const stats = simulateCards(e.data.catalog, { matches: e.data.matches, players: 4, seed: `editor-${Date.now()}`, onProgress: (done) => { if (done % 50 === 0) self.postMessage({ done }); } });
  self.postMessage({ stats });
};
