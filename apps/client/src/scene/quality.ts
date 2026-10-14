export type QualitySetting = 'auto' | 'low' | 'high';
export type QualityLevel = 'low' | 'high';

export interface QualityProfile {
  shadows: boolean;
  /** Pixel density cap. */
  dpr: number;
  antialias: boolean;
  clouds: number;
  /** Glossy plastic keeps its clearcoat (spec #5 §3.1). */
  clearcoat: boolean;
  /** Pieces and the crown load their lighter models (spec #5 A14). */
  lowModels: boolean;
  /** The ladder and portal ends are 3D models; otherwise flat images on the tiles (Step 2, round 5). */
  modelEnds: boolean;
}

/** Spec #2 §6.4. */
export const QUALITY: Record<QualityLevel, QualityProfile> = {
  high: { shadows: true, dpr: 2, antialias: true, clouds: 8, clearcoat: true, lowModels: false, modelEnds: true },
  low: { shadows: false, dpr: 1.5, antialias: false, clouds: 4, clearcoat: false, lowModels: true, modelEnds: false },
};

/** Auto starts Low on phones (a coarse pointer and a short screen side under 500 px) and High elsewhere. */
export function autoStartLevel(env: { coarsePointer: boolean; shortSide: number }): QualityLevel {
  return env.coarsePointer && env.shortSide < 500 ? 'low' : 'high';
}

/** What Auto looks at: a coarse pointer and the screen's short side (spec #2 §6.4). */
export function deviceEnv(): { coarsePointer: boolean; shortSide: number } {
  const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const shortSide = typeof screen === 'undefined' ? 1000 : Math.min(screen.width, screen.height);
  return { coarsePointer, shortSide };
}

export function startLevel(setting: QualitySetting, env: { coarsePointer: boolean; shortSide: number }): QualityLevel {
  return setting === 'auto' ? autoStartLevel(env) : setting;
}

/** Auto's step-down (spec #2 §6.4): true, once, when the frame rate has averaged under `minFps` for `windowMs`. */
export class FrameRateWatch {
  private readonly frames: number[] = [];
  private total = 0;
  private fired = false;

  constructor(
    private readonly windowMs = 5000,
    private readonly minFps = 45,
  ) {}

  /** Feed one frame's length in ms. Stalls over 250 ms (a hidden tab, a long pause) don't count. */
  add(deltaMs: number): boolean {
    if (this.fired || deltaMs > 250) return false;
    this.frames.push(deltaMs);
    this.total += deltaMs;
    while (this.frames.length > 1 && this.total - this.frames[0]! >= this.windowMs) this.total -= this.frames.shift()!;
    if (this.total < this.windowMs) return false;
    if (this.frames.length / (this.total / 1000) >= this.minFps) return false;
    this.fired = true;
    return true;
  }
}
