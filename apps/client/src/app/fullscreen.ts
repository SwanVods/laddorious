// Fullscreen on the first tap where supported (spec #2 §7.3): Android browsers, never iOS Safari.

export interface FullscreenEnv {
  /** The first tap's pointer: only touch asks; a desktop click never does. */
  pointerType: string;
  userAgent: string;
  maxTouchPoints: number;
  fullscreenEnabled: boolean;
  inFullscreen: boolean;
}

/**
 * iPhones and iPods, and iPads, whose Safari says it's a Mac but has touch points (read from the user agent,
 * not the deprecated navigator.platform, 2026-10-15).
 */
export function isIOS(env: Pick<FullscreenEnv, 'userAgent' | 'maxTouchPoints'>): boolean {
  return /iPhone|iPad|iPod/.test(env.userAgent) || (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
}

export function wantsFullscreen(env: FullscreenEnv): boolean {
  return env.pointerType === 'touch' && !isIOS(env) && env.fullscreenEnabled && !env.inFullscreen;
}
