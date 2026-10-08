import eslintReact from '@eslint-react/eslint-plugin';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/dist-e2e/**', '**/test-results/**', '**/playwright-report/**', '**/coverage/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // The core must stay deterministic: no wall clock, no unseeded randomness (spec §3.5).
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'core must not read the clock' },
        { name: 'performance', message: 'core must not read the clock' },
      ],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'use a seeded RngStream' }],
    },
  },
  {
    // Libraries must run in browsers and on the server alike: no Node built-ins (spec #2 C6).
    files: ['packages/*/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['node:*'], message: 'packages/* must stay browser-safe: no Node built-ins' }] },
      ],
    },
  },
  {
    // React and React Hooks rules for the client (spec #2 §3).
    files: ['apps/client/**/*.{ts,tsx}'],
    extends: [eslintReact.configs['recommended-typescript']],
  },
);
