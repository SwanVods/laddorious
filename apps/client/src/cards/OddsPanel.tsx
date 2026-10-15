import { CARD_TYPES, RARITIES, type CatalogOdds } from '@laddorious/core';

const pct = (w: Record<string, number>, k: string) => {
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return total > 0 ? Math.round((w[k]! / total) * 100) : 0;
};
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function OddsPanel({ odds, onChange }: { odds: CatalogOdds; onChange: (odds: CatalogOdds) => void }) {
  return (
    <section className="odds" aria-label="Odds">
      <h2>Odds</h2>
      <fieldset>
        <legend>"?" squares: which rarity</legend>
        {RARITIES.map((r) => (
          <label key={r}>
            <input aria-label={`${cap(r)} weight`} type="number" min={0} value={odds.rarityWeights[r]} onChange={(e) => onChange({ ...odds, rarityWeights: { ...odds.rarityWeights, [r]: Number(e.target.value) } })} />
            <span>{`${cap(r)}: ${odds.rarityWeights[r]} (${pct(odds.rarityWeights, r)}%)`}</span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Dealt cards: which type</legend>
        {CARD_TYPES.map((t) => (
          <label key={t}>
            <input aria-label={`${cap(t)} type weight`} type="number" min={0} value={odds.typeWeights[t]} onChange={(e) => onChange({ ...odds, typeWeights: { ...odds.typeWeights, [t]: Number(e.target.value) } })} />
            <span>{`${cap(t)}: ${pct(odds.typeWeights, t)}%`}</span>
          </label>
        ))}
      </fieldset>
      <label>Rerolls per hand <input type="number" min={0} max={3} value={odds.maxRerolls} onChange={(e) => onChange({ ...odds, maxRerolls: Number(e.target.value) })} /></label>
    </section>
  );
}
