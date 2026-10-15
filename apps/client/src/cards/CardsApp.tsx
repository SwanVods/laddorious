import { describeCard, statusOf, type CardCatalog, type CardStatus, type CatalogCard } from '@laddorious/core';
import { useEffect, useMemo, useState } from 'react';
import type { CardsApi } from './api';

// The card editor (2026-10-15): every card in the card file, to switch on or off, buff, nerf, or draft.

type StatusFilter = 'all' | CardStatus;
const FILTERS: Array<[StatusFilter, string]> = [['all', 'All'], ['on', 'On'], ['draft', 'Drafts'], ['off', 'Off']];

export function CardsApp({ api }: { api: CardsApi }) {
  const [catalog, setCatalog] = useState<CardCatalog | null>(null);
  const [version, setVersion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.loadCards().then(
      (r) => {
        setCatalog(r.catalog);
        setVersion(r.version);
      },
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [api]);

  const shown = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.cards.filter(
      (c) => (filter === 'all' || statusOf(c) === filter) && (q === '' || [c.name, c.note ?? '', c.plan ?? '', c.id].some((s) => s.toLowerCase().includes(q))),
    );
  }, [catalog, filter, query]);

  if (error) return <main className="cards-app"><p role="alert">{error}</p></main>;
  if (!catalog) return <main className="cards-app"><p>Reading the card file…</p></main>;
  const count = (s: CardStatus) => catalog.cards.filter((c) => statusOf(c) === s).length;

  return (
    <main className="cards-app">
      <header className="cards-head">
        <h1>Cards</h1>
        <p className="cards-count">{`${count('on')} on · ${count('draft')} drafts · ${count('off')} off`}</p>
      </header>
      <div className="cards-tools">
        <div role="group" aria-label="Show">
          {FILTERS.map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
        <input type="search" aria-label="Search cards" placeholder="Search names and notes" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className="cards-list">
        {shown.map((c) => (
          <CardRow key={c.id} card={c} selected={c.id === selectedId} onSelect={() => setSelectedId(c.id)} />
        ))}
      </ul>
      <input type="hidden" value={version} readOnly />
    </main>
  );
}

function CardRow({ card, selected, onSelect }: { card: CatalogCard; selected: boolean; onSelect: () => void }) {
  const status = statusOf(card);
  return (
    <li className={`card-row ${card.type} ${status}${selected ? ' selected' : ''}`}>
      <button type="button" onClick={onSelect}>
        <span className="card-row-name">{card.name}</span>
        <span className="card-row-meta">{`${card.rarity} · ${card.type} · ${status}`}</span>
        <span className="card-row-text">{status === 'draft' ? card.plan : describeCard(card)}</span>
      </button>
    </li>
  );
}
