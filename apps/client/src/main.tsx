import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DevMatchPage } from './app/DevMatchPage';
import './app/theme.css';
import './app/dev.css';
import { LocalMatchService } from './service/localMatchService';

const service = new LocalMatchService(
  () => new Worker(new URL('./worker/host.worker.ts', import.meta.url), { type: 'module' }),
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevMatchPage service={service} />
  </StrictMode>,
);
