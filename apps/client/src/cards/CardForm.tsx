import { CARD_TYPES, RARITIES, TARGETS, describeCard, statusOf, type CardProblem, type CatalogCard } from '@laddorious/core';
import { StepsEditor } from './StepsEditor';

export function CardForm({ card, problems, onChange }: { card: CatalogCard; problems: CardProblem[]; onChange: (card: CatalogCard) => void }) {
  const status = statusOf(card);
  const targetKey = TARGETS.find(([, , t]) => JSON.stringify(t) === JSON.stringify(card.target))?.[0] ?? 'self';
  const values = Object.entries(card.values ?? {});
  const setValue = (name: string, end: 'min' | 'max', v: number) => onChange({ ...card, values: { ...card.values, [name]: { ...card.values![name]!, [end]: v } } });
  return (
    <form className="card-form" onSubmit={(e) => e.preventDefault()}>
      <label>Name <input value={card.name} onChange={(e) => onChange({ ...card, name: e.target.value })} /></label>
      <label>Status
        <select aria-label="Status" value={status} onChange={(e) => onChange({ ...card, status: e.target.value as CatalogCard['status'] })}>
          <option value="on">On</option><option value="off">Off</option><option value="draft">Draft</option>
        </select>
      </label>
      <label>Rarity <select value={card.rarity} onChange={(e) => onChange({ ...card, rarity: e.target.value as CatalogCard['rarity'] })}>{RARITIES.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label>Type <select value={card.type} onChange={(e) => onChange({ ...card, type: e.target.value as CatalogCard['type'] })}>{CARD_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label>Weight <input type="number" min={1} value={card.weight} onChange={(e) => onChange({ ...card, weight: Number(e.target.value) })} /></label>
      <label>Hits <select value={targetKey} onChange={(e) => onChange({ ...card, target: TARGETS.find(([k]) => k === e.target.value)![2] })}>{TARGETS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</select></label>
      {status === 'draft' && <label>Plan <textarea value={card.plan ?? ''} onChange={(e) => onChange({ ...card, plan: e.target.value })} /></label>}
      <fieldset>
        <legend>Values, picked each match</legend>
        {values.map(([name, r]) => (
          <span key={name} className="value">
            {`${name}: `}
            <input aria-label={`Value ${name}: lowest`} type="number" value={r.min} onChange={(e) => setValue(name, 'min', Number(e.target.value))} />
            {' to '}
            <input aria-label={`Value ${name}: highest`} type="number" value={r.max} onChange={(e) => setValue(name, 'max', Number(e.target.value))} />
          </span>
        ))}
        <button type="button" onClick={() => onChange({ ...card, values: { ...card.values, [nextName(card)]: { min: 1, max: 6 } } })}>Add a value</button>
      </fieldset>
      <fieldset>
        <legend>Steps</legend>
        <StepsEditor ops={card.effects} card={card} onChange={(effects) => onChange({ ...card, effects })} />
      </fieldset>
      <label>Hand-written text (leave empty to use the generated text) <input value={card.text ?? ''} onChange={(e) => onChange({ ...card, text: e.target.value || undefined })} /></label>
      <label>Note <textarea value={card.note ?? ''} onChange={(e) => onChange({ ...card, note: e.target.value || undefined })} /></label>
      <p className="card-preview" data-testid="card-preview">{status === 'draft' ? card.plan : describeCard(card)}</p>
      {problems.length > 0 && <ul role="alert" className="card-problems">{problems.map((p) => <li key={p.message}>{p.message}</li>)}</ul>}
    </form>
  );
}

const nextName = (card: CatalogCard) => ['n', 'm', 'k', 'x', 'y'].find((n) => !card.values?.[n]) ?? `v${Object.keys(card.values ?? {}).length + 1}`;
