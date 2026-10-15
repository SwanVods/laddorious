import { useEffect, useLayoutEffect, useRef } from 'react';

// Effects that must happen once per moment, even under React's StrictMode, which runs every effect twice
// in dev builds (2026-10-15). Refs outlive StrictMode's pretend unmount, so they remember what already ran.

/** Run `run` once each time `key` changes to a new value (null and undefined never run). */
export function useOncePer(key: unknown, run: () => void): void {
  const doneRef = useRef<unknown>(undefined);
  const latestRef = useRef(run);
  useLayoutEffect(() => {
    latestRef.current = run;
  });
  useEffect(() => {
    if (key === null || key === undefined || Object.is(doneRef.current, key)) return;
    doneRef.current = key;
    latestRef.current();
  }, [key]);
}

/**
 * Call `dispose` when the component really unmounts. StrictMode's pretend unmount is followed at once by a
 * remount, before any microtask runs; a real one isn't.
 */
export function useDisposeOnUnmount(dispose: () => void): void {
  const latestRef = useRef(dispose);
  useLayoutEffect(() => {
    latestRef.current = dispose;
  });
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) latestRef.current();
      });
    };
  }, []);
}
