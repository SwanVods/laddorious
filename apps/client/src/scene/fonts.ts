// The page's web fonts (Lilita One, Fredoka) arrive after the first paint; canvases painted before them
// use a fallback face. Board textures paint again once they're in (2026-10-15).

/** Resolves once the page's web fonts have loaded; null when they already have, or there are none to wait for. */
export function webFontsPending(): Promise<unknown> | null {
  if (typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded') return null;
  return document.fonts.ready;
}
