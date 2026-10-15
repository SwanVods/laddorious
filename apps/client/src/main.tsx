import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { loadTuning } from './app/tuning';
import { browserStorage, createPrefsStore } from './app/prefs';
import { AudioEngine } from './audio/engine';
import { SoundProvider } from './audio/SoundProvider';
import { testHooks } from './app/testMode';
import { LocalMatchService } from './service/localMatchService';
import { OnlineMatchService, serverUrl } from './service/onlineMatchService';
import './app/theme.css';
import './app/base.css';
import './ui/ui.css';
import './hud/hud.css';
import './hud/popups.css';
import './app/match.css';
import './app/menu.css';
import './app/screens.css';

// Sound (spec #3): Tone loads as its own chunk after the first tap (A3). On a touch screen it asks for bigger
// audio buffers, so a busy frame doesn't make it stutter (2026-10-15).
const phone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const sound = new AudioEngine(() => import('tone'), phone ? { latencyHint: 'playback' } : {});

// e2e builds only (vite build --mode e2e): fast matches and window.__laddoriousTest (spec #2 §9.3).
const test = import.meta.env.MODE === 'e2e' ? testHooks(undefined, () => sound.stats()) : null;
const local = new LocalMatchService(
  () => new Worker(new URL('./worker/host.worker.ts', import.meta.url), { type: 'module' }),
  { fast: test !== null },
);
// Online builds (spec #4 M11): VITE_SERVER names the server, and the offline bots stay as the fallback.
const server = serverUrl(import.meta.env.VITE_SERVER, location);
const online = server ? new OnlineMatchService({ url: server }) : null;
// A reload during an online match goes straight back to it (spec #4 §3.3).
const resume = online?.rejoin() ?? null;
const prefs = createPrefsStore(browserStorage(), {
  prefersReducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
});

// Admin settings (tuning.json) first, so the first match plays by them (2026-10-15).
void loadTuning().then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider engine={sound} prefs={prefs}>
      <App service={online ?? local} offline={online ? local : undefined} resume={resume} prefs={prefs} dev={import.meta.env.DEV} test={test} />
    </SoundProvider>
  </StrictMode>,
));
