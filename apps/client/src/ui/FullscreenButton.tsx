import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/**
 * Full-screen mode (the user, 2026-10-15): a round button that puts the whole game in the browser's full
 * screen and takes it out again. It follows full screen left another way (the Esc key) and doesn't show
 * where the browser can't do full screen (Safari on an iPhone).
 */
export function FullscreenButton({ className = '' }: { className?: string }) {
  const [full, setFull] = useState(() => typeof document !== 'undefined' && document.fullscreenElement !== null);
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  if (typeof document === 'undefined' || !document.fullscreenEnabled) return null;
  const toggle = () => {
    const done = full ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    void done.catch(() => {}); // a browser may refuse (no gesture, a policy): the button just stays as it was
  };
  return (
    <button type="button" className={`round-btn fullscreen-btn live ${className}`.trim()} aria-label={full ? 'Exit full screen' : 'Full screen'} onClick={toggle}>
      <Icon name={full ? 'shrink' : 'expand'} />
    </button>
  );
}
