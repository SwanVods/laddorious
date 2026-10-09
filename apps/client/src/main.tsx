import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { browserStorage, createPrefsStore } from './app/prefs';
import { AudioEngine } from './audio/engine';
import { SoundProvider } from './audio/SoundProvider';
import { testHooks } from './app/testMode';
import { LocalMatchService } from './service/localMatchService';
import './app/theme.css';
import './app/base.css';
import './ui/ui.css';
import './hud/hud.css';
import './hud/popups.css';
import './app/match.css';
import './app/menu.css';
import './app/screens.css';

// Sound (spec #3): Tone loads as its own chunk after the first tap (A3).
const sound = new AudioEngine(() => import('tone'));

// e2e builds only (vite build --mode e2e): fast matches and window.__laddoriousTest (spec #2 §9.3).
const test = import.meta.env.MODE === 'e2e' ? testHooks() : null;
const service = new LocalMatchService(
  () => new Worker(new URL('./worker/host.worker.ts', import.meta.url), { type: 'module' }),
  { fast: test !== null },
);
const prefs = createPrefsStore(browserStorage(), {
  prefersReducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SoundProvider engine={sound} prefs={prefs}>
      <App service={service} prefs={prefs} dev={import.meta.env.DEV} test={test} />
    </SoundProvider>
  </StrictMode>,
);
