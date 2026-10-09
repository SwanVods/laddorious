import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;
/** The online tests' server: wrangler dev with an online e2e build and fast matches (spec #4 §10). */
const ONLINE_PORT = 8788;

/**
 * End-to-end tests (spec #2 §9.3) against the e2e build, which has the fast test mode and
 * window.__laddoriousTest. All projects run in Chromium; the phones are emulated. The `online`
 * project plays two browser contexts against wrangler dev (spec #4 §10).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // WebGL without a GPU: SwiftShader.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop-chromium', testIgnore: /online\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-12-landscape', testIgnore: /online\.spec\.ts/, use: { ...devices['iPhone 12 landscape'], browserName: 'chromium' } },
    { name: 'pixel-7-landscape', testIgnore: /online\.spec\.ts/, use: { ...devices['Pixel 7 landscape'] } },
    { name: 'online', testMatch: /online\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${ONLINE_PORT}` } },
  ],
  webServer: [
    {
      command: `pnpm exec vite build --mode e2e --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'pnpm exec vite build --mode e2e --outDir dist-online-e2e && pnpm --filter @laddorious/server e2e:serve',
      url: `http://127.0.0.1:${ONLINE_PORT}`,
      env: { VITE_SERVER: 'same-origin', WRANGLER_SEND_METRICS: 'false' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
