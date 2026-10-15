// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrefsStore } from '../src/app/prefs';
import { DEFAULT_SOUND } from '../src/audio/settings';
import { AudioEngine } from '../src/audio/engine';
import { SoundProvider, useSound } from '../src/audio/SoundProvider';

afterEach(cleanup);

function setup() {
  const engine = new AudioEngine(() => new Promise(() => {}));
  const spies = {
    unlock: vi.spyOn(engine, 'unlock'),
    playNow: vi.spyOn(engine, 'playNow'),
    setSound: vi.spyOn(engine, 'setSound'),
    suspend: vi.spyOn(engine, 'suspend'),
    resume: vi.spyOn(engine, 'resume'),
  };
  const prefs = createPrefsStore(null, { prefersReducedMotion: false });
  render(
    <SoundProvider engine={engine} prefs={prefs}>
      <button type="button">Plain</button>
      <button type="button" data-sound="none">
        Silent
      </button>
      <button type="button" data-sound="U2" data-sound-arg="3">
        Dragon
      </button>
      <button type="button" disabled>
        Off
      </button>
    </SoundProvider>,
  );
  return { engine, prefs, ...spies };
}

describe('SoundProvider (spec #3 §3, §4, §7)', () => {
  it('unlocks sound on the first tap or key', () => {
    const { unlock } = setup();
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: 'a' });
    expect(unlock).toHaveBeenCalledTimes(2);
  });

  it('clicks every button, unless it names its own sound or none', () => {
    const { playNow } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Plain' }));
    fireEvent.click(screen.getByRole('button', { name: 'Silent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dragon' }));
    expect(playNow.mock.calls).toEqual([['U1', undefined], ['U2', 3]]);
  });

  it('applies the saved sound settings, and follows changes', () => {
    const { prefs, setSound } = setup();
    expect(setSound).toHaveBeenLastCalledWith(DEFAULT_SOUND);
    act(() => prefs.getState().setMuted(true));
    expect(setSound).toHaveBeenLastCalledWith({ ...DEFAULT_SOUND, muted: true });
  });

  it('suspends while the page is hidden and resumes on return', () => {
    const { suspend, resume } = setup();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    fireEvent(document, new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    fireEvent(document, new Event('visibilitychange'));
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('gives a silent engine to components outside a provider', () => {
    let engine: AudioEngine | null = null;
    function Probe() {
      engine = useSound();
      return null;
    }
    render(<Probe />);
    expect(() => engine!.playNow('U1')).not.toThrow();
  });
});
