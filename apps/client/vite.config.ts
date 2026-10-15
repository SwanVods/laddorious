import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { cardsPlugin } from './cardsPlugin';

export default defineConfig({
  plugins: [react(), cardsPlugin()],
});
