import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

/**
 * End-to-end tests (spec #2 §9.3) against the e2e build, which has the fast test mode and
 * window.__laddoriousTest. All projects run in Chromium; the phones are emulated.
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
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-12-landscape', use: { ...devices['iPhone 12 landscape'], browserName: 'chromium' } },
    { name: 'pixel-7-landscape', use: { ...devices['Pixel 7 landscape'] } },
  ],
  webServer: {
    command: `pnpm exec vite build --mode e2e --outDir dist-e2e && pnpm exec vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
