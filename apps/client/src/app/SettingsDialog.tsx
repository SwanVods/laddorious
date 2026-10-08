import { useId } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { deviceEnv, startLevel, type QualitySetting } from '../scene/quality';
import { Dialog } from '../ui/Dialog';
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
}

/**
 * Settings (spec #2 §7.1): graphics quality (Auto, Low, High, with a one-line description and
 * the level in use) and Reduced motion. Changes are saved at once.
 */
export function SettingsDialog({ prefs, onClose, device = deviceEnv() }: SettingsDialogProps) {
  const settings = useStore(prefs, (s) => s.settings);
  const qualityId = useId();
  const motionId = useId();
  const chosen = QUALITY_OPTIONS.find((o) => o.value === settings.quality)!;
  const level = startLevel(settings.quality, device);
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
          onClick={() => prefs.getState().setReducedMotion(!settings.reducedMotion)}
        />
      </div>
      <p className="setting-note">{`Right now: ${level === 'high' ? 'High' : 'Low'}${settings.quality === 'auto' ? ' (Auto on this device)' : ''}.`}</p>
    </Dialog>
  );
}
