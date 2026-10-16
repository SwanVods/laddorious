import { CARD_TYPES, RARITIES, catalogProblems, describeCard, statusOf, type CardCatalog, type CardStatus, type CardType, type CatalogCard, type Rarity } from '@laddorious/core';
import { useEffect, useMemo, useState } from 'react';
import type { CardsApi } from './api';
import { CardForm } from './CardForm';
import { OddsPanel } from './OddsPanel';
import { SimulatePanel } from './SimulatePanel';

// The card editor (2026-10-15): every card in the card file, to switch on or off, buff, nerf, or draft.

type StatusFilter = 'all' | CardStatus;
const FILTERS: Array<[StatusFilter, string]> = [['all', 'All'], ['on', 'On'], ['draft', 'Drafts'], ['off', 'Off']];
/** The list's order (2026-10-16): as in the card file, or by rarity, or by type, each then by the other and the name. */
type SortBy = 'file' | 'rarity' | 'type';
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const rank = (c: CatalogCard) => RARITIES.indexOf(c.rarity);
const kind = (c: CatalogCard) => CARD_TYPES.indexOf(c.type);
const ORDERS: Record<Exclude<SortBy, 'file'>, (a: CatalogCard, b: CatalogCard) => number> = {
  rarity: (a, b) => rank(a) - rank(b) || kind(a) - kind(b) || a.name.localeCompare(b.name),
  type: (a, b) => kind(a) - kind(b) || rank(a) - rank(b) || a.name.localeCompare(b.name),
};

export function CardsApp({ api }: { api: CardsApi }) {
  const [catalog, setCatalog] = useState<CardCatalog | null>(null);
  const [version, setVersion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<'all' | Rarity>('all');
  const [type, setType] = useState<'all' | CardType>('all');
  const [sortBy, setSortBy] = useState<SortBy>('file');
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
    const list = catalog.cards.filter(
      (c) =>
        (filter === 'all' || statusOf(c) === filter) &&
        (rarity === 'all' || c.rarity === rarity) &&
        (type === 'all' || c.type === type) &&
        (q === '' || [c.name, c.note ?? '', c.plan ?? '', c.id].some((s) => s.toLowerCase().includes(q))),
    );
    return sortBy === 'file' ? list : [...list].sort(ORDERS[sortBy]);
  }, [catalog, filter, rarity, type, sortBy, query]);

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
  /** Cards with problems other than the one open: Save names them, so a greyed-out Save always says why. */
  const elsewhere = catalog.cards.filter((c) => c.id !== selectedId && problems.some((p) => p.cardId === c.id));
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
    setRarity('all');
    setType('all');
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
        <select aria-label="Rarity" value={rarity} onChange={(e) => setRarity(e.target.value as 'all' | Rarity)}>
          <option value="all">All rarities</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {capital(r)}
            </option>
          ))}
        </select>
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as 'all' | CardType)}>
          <option value="all">All types</option>
          {CARD_TYPES.map((t) => (
            <option key={t} value={t}>
              {capital(t)}
            </option>
          ))}
        </select>
        <select aria-label="Sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
          <option value="file">Card file order</option>
          <option value="rarity">Sort by rarity</option>
          <option value="type">Sort by type</option>
        </select>
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
        {elsewhere.length > 0 && (
          <p className="cards-blocked">
            Fix these before saving:
            {elsewhere.map((c) => (
              <button key={c.id} type="button" onClick={() => select(c.id)}>
                {c.name}
              </button>
            ))}
          </p>
        )}
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
