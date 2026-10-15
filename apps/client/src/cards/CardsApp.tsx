import { catalogProblems, describeCard, statusOf, type CardCatalog, type CardStatus, type CatalogCard } from '@laddorious/core';
import { useEffect, useMemo, useState } from 'react';
import type { CardsApi } from './api';
import { CardForm } from './CardForm';
import { OddsPanel } from './OddsPanel';
import { SimulatePanel } from './SimulatePanel';

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
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const problems = useMemo(() => (catalog ? catalogProblems(catalog) : []), [catalog]);

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
  const selected = catalog.cards.find((c) => c.id === selectedId) ?? null;
  const update = (card: CatalogCard) => {
    setCatalog({ ...catalog, cards: catalog.cards.map((c) => (c.id === selectedId ? card : c)) });
    setSelectedId(card.id);
    setNotice(null);
  };
  const save = async () => {
    const r = await api.saveCards(catalog, version);
    if (r.ok) {
      setVersion(r.version);
      setNotice('Saved.');
    } else setNotice(r.message);
  };
  const general = problems.filter((p) => p.cardId === null);
  const change = (next: CardCatalog) => {
    setCatalog(next);
    setNotice(null);
  };
  const select = (id: string | null) => {
    setSelectedId(id);
    setDeleting(false);
  };
  const freeId = (base: string) => {
    const taken = new Set(catalog.cards.map((c) => c.id));
    let n = 1;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  };
  const newCard = () => {
    const id = freeId('new-card');
    const card: CatalogCard = { id, name: `New card ${id.slice('new-card-'.length)}`, rarity: 'common', type: 'movement', status: 'draft', weight: 1, plan: '', target: { condition: 'self', pick: 'self', tieBreak: 'lowest-seat' }, effects: [] };
    change({ ...catalog, cards: [...catalog.cards, card] });
    setFilter('all');
    select(id);
  };
  const duplicate = (card: CatalogCard) => {
    const id = freeId(`${card.id}-copy`);
    change({ ...catalog, cards: [...catalog.cards, { ...structuredClone(card), id, name: `${card.name} (copy)`, status: 'off' }] });
    select(id);
  };
  const remove = (card: CatalogCard) => {
    change({ ...catalog, cards: catalog.cards.filter((c) => c.id !== card.id) });
    select(null);
  };

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
        <button type="button" onClick={newCard}>
          New card
        </button>
        <input type="search" aria-label="Search cards" placeholder="Search names and notes" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <OddsPanel odds={catalog.odds} onChange={(odds) => change({ ...catalog, odds })} />
      <SimulatePanel catalog={catalog} />
      <ul className="cards-list">
        {shown.map((c) => (
          <CardRow key={c.id} card={c} selected={c.id === selectedId} onSelect={() => select(c.id)} />
        ))}
      </ul>
      {selected && (
        <section className="card-edit" aria-label={`Edit ${selected.name}`}>
          <CardForm card={selected} problems={problems.filter((p) => p.cardId === selected.id)} onChange={update} />
          <div className="card-edit-actions">
            <button type="button" onClick={() => duplicate(selected)}>
              Duplicate
            </button>
            {deleting ? (
              <>
                <button type="button" className="danger" onClick={() => remove(selected)}>{`Delete ${selected.name} for good`}</button>
                <button type="button" onClick={() => setDeleting(false)}>
                  Keep it
                </button>
              </>
            ) : (
              <button type="button" onClick={() => setDeleting(true)}>
                Delete
              </button>
            )}
          </div>
        </section>
      )}
      <div className="cards-save">
        <button type="button" onClick={() => void save()} disabled={problems.length > 0}>
          Save
        </button>
        {general.length > 0 && <p role="alert">{general.map((p) => p.message).join(' ')}</p>}
        {problems.length > 0 && general.length === 0 && !selected && <p>{`${problems.length} problem${problems.length === 1 ? '' : 's'} to fix before saving.`}</p>}
        {notice && <p role="status">{notice}</p>}
      </div>
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
