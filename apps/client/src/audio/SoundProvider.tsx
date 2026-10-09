import { createContext, use, useEffect, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { PrefsState } from '../app/prefs';
import { AudioEngine } from './engine';
import { isSoundId } from './sounds';

// Sound for the whole app (spec #3 §3, §4, §7): the engine, the first-tap unlock, pausing
// while hidden, the saved settings, and a click for every button.

/** Outside a provider (some tests), sound is a silent engine that never loads. */
const SILENT = new AudioEngine(() => new Promise(() => {}));

const SoundContext = createContext<AudioEngine>(SILENT);

export const useSound = (): AudioEngine => use(SoundContext);

export function SoundProvider({ engine, prefs, children }: { engine: AudioEngine; prefs: StoreApi<PrefsState>; children: ReactNode }) {
  const sound = useStore(prefs, (s) => s.settings.sound);

  useEffect(() => engine.setSound(sound), [engine, sound]);

  useEffect(() => {
    const unlock = () => engine.unlock();
    const onVisibility = () => (document.hidden ? engine.suspend() : engine.resume());
    // Buttons click by default; data-sound names another sound, or "none" (spec #3 §5).
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element | null)?.closest?.('button');
      if (!button || button.disabled) return;
      const id = button.dataset.sound ?? 'U1';
      if (!isSoundId(id)) return;
      const arg = button.dataset.soundArg;
      engine.playNow(id, arg === undefined ? undefined : Number(arg));
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', onClick);
    };
  }, [engine]);

  return <SoundContext value={engine}>{children}</SoundContext>;
}
