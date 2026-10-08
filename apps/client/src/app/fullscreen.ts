// Fullscreen on the first tap where supported (spec #2 §7.3): Android browsers, never iOS Safari.

export interface FullscreenEnv {
  /** The first tap's pointer: only touch asks; a desktop click never does. */
  pointerType: string;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  fullscreenEnabled: boolean;
  inFullscreen: boolean;
}

/** iPhones and iPods, and iPads, which report a Mac platform with touch points. */
export function isIOS(env: Pick<FullscreenEnv, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  return /iPhone|iPad|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
}

export function wantsFullscreen(env: FullscreenEnv): boolean {
  return env.pointerType === 'touch' && !isIOS(env) && env.fullscreenEnabled && !env.inFullscreen;
}
