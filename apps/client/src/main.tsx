import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { browserStorage, createPrefsStore } from './app/prefs';
import { LocalMatchService } from './service/localMatchService';
import './app/theme.css';
import './app/base.css';
import './ui/ui.css';
import './hud/hud.css';
import './hud/popups.css';
import './app/match.css';
import './app/menu.css';
import './app/screens.css';

const service = new LocalMatchService(
  () => new Worker(new URL('./worker/host.worker.ts', import.meta.url), { type: 'module' }),
);
const prefs = createPrefsStore(browserStorage(), {
  prefersReducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App service={service} prefs={prefs} dev={import.meta.env.DEV} />
  </StrictMode>,
);
