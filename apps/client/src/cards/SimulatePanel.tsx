import type { CardCatalog } from '@laddorious/core';
import type { CardStat } from '@laddorious/sim';
import { useRef, useState } from 'react';

export type RunSimulation = (catalog: CardCatalog, matches: number, onProgress: (done: number) => void) => Promise<CardStat[]>;

export const workerRun: RunSimulation = (catalog, matches, onProgress) =>
  new Promise((resolve) => {
    const worker = new Worker(new URL('./simulate.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ done?: number; stats?: CardStat[] }>) => {
      if (e.data.stats) {
        worker.terminate();
        resolve(e.data.stats);
      } else if (e.data.done) onProgress(e.data.done);
    };
    worker.postMessage({ catalog, matches });
  });

const MATCHES = 1000;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const FLAGS = { strong: 'Strong', weak: 'Weak', fizzles: 'Fizzles often' } as const;

export function SimulatePanel({ catalog, run = workerRun }: { catalog: CardCatalog; run?: RunSimulation }) {
  const [stats, setStats] = useState<CardStat[] | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const previousRef = useRef(new Map<string, number>());
  const start = async () => {
    setDone(0);
    if (stats) previousRef.current = new Map(stats.map((s) => [s.cardId, s.winRate]));
    const next = await run(catalog, MATCHES, setDone);
    setStats(next);
    setDone(null);
  };
  const name = (id: string) => catalog.cards.find((c) => c.id === id)?.name ?? id;
  return (
    <section className="simulate" aria-label="Simulate">
      <h2>Simulate</h2>
      <p>Bot matches with the cards as they are on screen, saved or not. Bots pick cards at random, so this measures the cards.</p>
      <button type="button" onClick={start} disabled={done !== null}>Simulate 1,000 matches</button>
      {done !== null && <p role="status">{`${done} of ${MATCHES} matches…`}</p>}
      {stats && (
        <div className="simulate-table">
          <table>
            <thead><tr><th>Card</th><th>Dealt</th><th>Picked</th><th>Avg tiles</th><th>Played by</th><th>Win rate</th><th></th></tr></thead>
            <tbody>
              {stats.map((s) => {
                const was = previousRef.current.get(s.cardId);
                return (
                  <tr key={s.cardId}>
                    <td>{name(s.cardId)}</td>
                    <td>{s.dealt}</td>
                    <td>{s.picked}</td>
                    <td>{s.avgTiles}</td>
                    <td>{s.playedBy}</td>
                    <td>{was !== undefined ? `${pct(s.winRate)} (was ${pct(was)})` : pct(s.winRate)}</td>
                    <td>{s.flag ? FLAGS[s.flag] : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
