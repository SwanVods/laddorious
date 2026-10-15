import { STEP_KINDS, isDie, stepKindOf, type Amount, type CatalogCard, type DieAmount, type EffectOp, type StepField, type Templated } from '@laddorious/core';

type Op = Templated<EffectOp>;

/** A number, a named value, or (where the field allows it) the card's own die (2026-10-15). */
type AmountValue = Amount | DieAmount;

/** A number field: a fixed number, one of the card's named values, or the card's die. */
function AmountInput({ label, value, names, onChange, field }: { label: string; value: AmountValue; names: string[]; onChange: (v: AmountValue) => void; field: StepField }) {
  const asNumber = typeof value === 'number' ? value : null;
  const named = typeof value === 'object' && 'value' in value ? value : null;
  const die = isDie(value) ? value : null;
  const negate = (on: boolean) => (on ? { negate: true as const } : {});
  return (
    <span className="amount">
      {named && (
        <select aria-label={label} value={named.value} onChange={(e) => onChange({ ...named, value: e.target.value })}>
          {names.map((n) => <option key={n} value={n}>{`value ${n}`}</option>)}
        </select>
      )}
      {asNumber !== null && <input aria-label={label} type="number" min={field.min} max={field.max} value={asNumber} onChange={(e) => onChange(Number(e.target.value))} />}
      {die && <span aria-label={label}>the card's die</span>}
      {asNumber === null && <button type="button" onClick={() => onChange(field.min ?? 1)}>Use a number</button>}
      {names.length > 0 && !named && <button type="button" onClick={() => onChange({ value: names[0]! })}>Use a value</button>}
      {field.die && !die && <button type="button" onClick={() => onChange({ die: true })}>Use the card's die</button>}
      {named && <label><input type="checkbox" checked={!!named.negate} onChange={(e) => onChange({ value: named.value, ...negate(e.target.checked) })} /> negative</label>}
      {die && <label><input type="checkbox" checked={!!die.negate} onChange={(e) => onChange({ die: true, ...negate(e.target.checked) })} /> negative</label>}
    </span>
  );
}

export function StepsEditor({ ops, card, onChange }: { ops: Op[]; card: CatalogCard; onChange: (ops: Op[]) => void }) {
  const names = Object.keys(card.values ?? {});
  const set = (i: number, op: Op) => onChange(ops.map((o, j) => (j === i ? op : o)));
  return (
    <ol className="steps">
      {ops.map((op, i) => {
        const kind = stepKindOf(op);
        const values = kind.read(op)!;
        return (
          // Steps have no identity of their own and are only added or removed, never reordered.
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <li key={i} className="step">
            <select aria-label={`Step ${i + 1}`} value={kind.id} onChange={(e) => set(i, STEP_KINDS.find((k) => k.id === e.target.value)!.make())}>
              {STEP_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            {kind.id === 'gamble' ? (
              <ol className="outcomes">
                {(values.outcomes as Array<{ weight: number; ops: Op[] }>).map((o, j, all) => (
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  <li key={j}>
                    <label>Chance weight <input aria-label={`Outcome ${j + 1}: weight`} type="number" min={1} value={o.weight} onChange={(e) => set(i, kind.write({ outcomes: all.map((x, k) => (k === j ? { ...x, weight: Number(e.target.value) } : x)) }))} /></label>
                    <StepsEditor ops={o.ops} card={card} onChange={(next) => set(i, kind.write({ outcomes: all.map((x, k) => (k === j ? { ...x, ops: next } : x)) }))} />
                  </li>
                ))}
              </ol>
            ) : (
              kind.fields.map((f) =>
                f.kind === 'amount' ? (
                  <AmountInput key={f.key} field={f} label={`${kind.label}: ${f.label}`} value={values[f.key] as AmountValue} names={names} onChange={(v) => set(i, kind.write({ ...values, [f.key]: v }))} />
                ) : (
                  <label key={f.key}>{f.label} <input aria-label={`${kind.label}: ${f.label}`} type="number" min={f.min} value={values[f.key] as number} onChange={(e) => set(i, kind.write({ ...values, [f.key]: Number(e.target.value) }))} /></label>
                ),
              )
            )}
            <button type="button" onClick={() => onChange(ops.filter((_, j) => j !== i))}>Remove step</button>
          </li>
        );
      })}
      <li><button type="button" onClick={() => onChange([...ops, STEP_KINDS[0]!.make()])}>Add a step</button></li>
    </ol>
  );
}
