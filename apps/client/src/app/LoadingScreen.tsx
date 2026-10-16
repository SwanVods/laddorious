import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { modelLoading } from '../assets/modelCache';

/** After this long, the screen offers to play with stand-ins while the models keep coming. */
export const LOADING_SKIP_MS = 20_000;

/**
 * The first start's loading screen (the user, 2026-10-16): over the menu, or a match entered straight from a
 * reload, until the 3D models are in. After a while it offers to play anyway; if some never load, it says so
 * and can try again. Once the first load is over it stays away, so a quality change loads quietly.
 */
export function LoadingScreen({ onRetry }: { onRetry: () => void }) {
  const { requested, done, failed, over } = useStore(modelLoading);
  const total = requested.length;
  const loading = !over && total > 0 && done < total;
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), LOADING_SKIP_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (over || total === 0 || (done >= total && failed.length === 0)) return null;
  const playAnyway = () => modelLoading.setState({ over: true });

  if (!loading) {
    return (
      <div className="screen loading-screen live">
        <div className="backdrop" />
        <div className="loading-panel panel" role="dialog" aria-labelledby="loading-title">
          <h2 id="loading-title" className="display">
            Some models didn't load
          </h2>
          <p>{`${failed.length} of ${total} 3D models couldn't be downloaded. The game still works, with simpler shapes in their place.`}</p>
          <div className="loading-buttons">
            <button type="button" className="btn" onClick={onRetry}>
              Try again
            </button>
            <button type="button" className="btn primary" onClick={playAnyway}>
              Play anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen loading-screen live">
      <div className="backdrop" />
      <div className="loading-panel panel" role="dialog" aria-labelledby="loading-title">
        <h2 id="loading-title" className="display">
          Setting up the board
        </h2>
        <div className="load-bar" role="progressbar" aria-label="Loading 3D models" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <i style={{ width: `${(100 * done) / total}%` }} />
        </div>
        <small>{`${done} of ${total}`}</small>
        {slow && (
          <>
            <p>This is taking a while on this connection.</p>
            <button type="button" className="btn primary" onClick={playAnyway}>
              Play anyway
            </button>
          </>
        )}
      </div>
    </div>
  );
}
