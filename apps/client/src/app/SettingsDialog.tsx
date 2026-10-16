import { useId, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { autoStepDown, deviceEnv, startLevel, type QualitySetting } from '../scene/quality';
import { Dialog } from '../ui/Dialog';
import pkg from '../../package.json';
import type { PrefsState } from './prefs';

const QUALITY_OPTIONS: Array<{ value: QualitySetting; label: string; description: string }> = [
  { value: 'auto', label: 'Auto', description: 'Picks Low on phones and High on desktop, and steps down if the frame rate drops.' },
  { value: 'low', label: 'Low', description: 'No live shadows and lower resolution. Best for older phones.' },
  { value: 'high', label: 'High', description: 'Live shadows, antialiasing and full resolution.' },
];

interface SettingsDialogProps {
  prefs: StoreApi<PrefsState>;
  onClose: () => void;
  /** What Auto looks at; the real device by default. */
  device?: { coarsePointer: boolean; shortSide: number };
  /** Buttons at the foot, like leaving the match when it opens from the match's menu button (2026-10-16). */
  children?: ReactNode;
}

/**
 * Settings (spec #2 §7.1): graphics quality (Auto, Low, High, with a one-line description and
 * the level in use), Reduced motion, and sound: mute and the effects and music volumes
 * (spec #3 §4). Changes are saved at once.
 */
export function SettingsDialog({ prefs, onClose, device = deviceEnv(), children }: SettingsDialogProps) {
  const settings = useStore(prefs, (s) => s.settings);
  const qualityId = useId();
  const motionId = useId();
  const soundId = useId();
  const chosen = QUALITY_OPTIONS.find((o) => o.value === settings.quality)!;
  // Auto may have lowered this match's quality to keep it smooth (2026-10-15).
  const stepped = useStore(autoStepDown, (s) => s.stepped) && settings.quality === 'auto';
  const level = stepped ? 'low' : startLevel(settings.quality, device);
  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="setting-row">
        <div className="setting-label">
          <b className="display" id={qualityId}>
            Graphics quality
          </b>
          <span>{chosen.description}</span>
        </div>
        <div className="segmented" role="group" aria-labelledby={qualityId}>
          {QUALITY_OPTIONS.map((o) => (
            <button key={o.value} type="button" className="display" aria-pressed={o.value === settings.quality} onClick={() => prefs.getState().setQuality(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <div className="setting-label">
          <b className="display" id={motionId}>
            Reduced motion
          </b>
          <span>Camera cuts instead of swoops, and less wobble.</span>
        </div>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={settings.reducedMotion}
          aria-labelledby={motionId}
          data-sound="U3"
          data-sound-arg={settings.reducedMotion ? 0 : 1}
          onClick={() => prefs.getState().setReducedMotion(!settings.reducedMotion)}
        />
      </div>
      <div className="setting-row">
        <div className="setting-label">
          <b className="display" id={soundId}>
            Sound
          </b>
          <span>Effects and music. Your own moments play louder than other players'.</span>
        </div>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-label="Sound"
          aria-checked={!settings.sound.muted}
          data-sound="U3"
          data-sound-arg={settings.sound.muted ? 1 : 0}
          onClick={() => prefs.getState().setMuted(!settings.sound.muted)}
        />
      </div>
      <div className="setting-row volume-row" role="group" aria-labelledby={soundId}>
        <label className="volume">
          <span>Effects</span>
          <input type="range" min={0} max={100} step={5} aria-label="Effects volume" value={Math.round(settings.sound.effects * 100)} onChange={(e) => prefs.getState().setEffectsVolume(Number(e.target.value) / 100)} />
        </label>
        <label className="volume">
          <span>Music</span>
          <input type="range" min={0} max={100} step={5} aria-label="Music volume" value={Math.round(settings.sound.music * 100)} onChange={(e) => prefs.getState().setMusicVolume(Number(e.target.value) / 100)} />
        </label>
      </div>
      <p className="setting-note">{`Right now: ${level === 'high' ? 'High' : 'Low'}${stepped ? ' (Auto lowered it for this match)' : settings.quality === 'auto' ? ' (Auto on this device)' : ''}.`}</p>
      {children && <div className="dialog-actions">{children}</div>}
      {/* The version and who made it (the user, 2026-10-16); the version is the release in package.json. */}
      <footer className="about" role="contentinfo">
        <b className="display">{`Laddorious v${pkg.version}`}</b>
        <span>Made by Feiralabs</span>
      </footer>
    </Dialog>
  );
}
