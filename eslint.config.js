import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
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
);
