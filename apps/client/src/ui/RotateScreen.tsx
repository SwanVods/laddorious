import { useMediaQuery } from './useMediaQuery';

/** Laddorious plays in landscape: an upright screen gets this instead (spec #2 §7.1, §7.3). */
export function RotateScreen() {
  const portrait = useMediaQuery('(orientation: portrait)');
  if (!portrait) return null;
  return (
    <div className="rotate-screen" role="alert">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="20" y="6" width="24" height="52" rx="6" />
        <path d="M28 50h8" />
      </svg>
      <b className="display">Turn your phone sideways</b>
      <span>Laddorious plays in landscape.</span>
    </div>
  );
}
