import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Desktop extras (spec #2 §7.3): keys mapped to actions, e.g. { Space: roll, '1': pickFirst }.
 * Never required: every action also has a button. Ignored while typing, with modifier keys,
 * and on key repeat.
 */
export function useHotkeys(keys: Readonly<Record<string, () => void>>, enabled = true): void {
  const keysRef = useRef(keys);
  useLayoutEffect(() => {
    keysRef.current = keys;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const action = keysRef.current[e.key === ' ' ? 'Space' : e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
