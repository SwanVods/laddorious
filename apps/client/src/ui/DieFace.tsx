// A die face for the HUD: pips in currentColor on a paper face (styled by .die-face).

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[29, 29], [50, 50], [71, 71]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[29, 29], [71, 29], [50, 50], [29, 71], [71, 71]],
  6: [[30, 27], [70, 27], [30, 50], [70, 50], [30, 73], [70, 73]],
};

/** `face` 0 draws a blank die (rolling). `forced` faces were set by a card and flash (spec #2 §5.1). */
export function DieFace({ face, forced = false, className }: { face: number; forced?: boolean; className?: string }) {
  const classes = ['die-face', forced ? 'forced' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg className={classes} viewBox="0 0 100 100" role="img" aria-label={face > 0 ? `${face}` : 'rolling'}>
      <rect x="6" y="6" width="88" height="88" rx="22" />
      {(PIPS[face] ?? []).map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="9.5" />
      ))}
    </svg>
  );
}
