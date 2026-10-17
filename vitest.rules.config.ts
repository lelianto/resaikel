import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Security-rules tests only. These require the Firestore emulator to be running
 * (`npm run emulators`) and are therefore kept out of the default `npm test`
 * suite, which must run anywhere with no external services.
 *
 *   npm run test:rules
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // Rules evaluation and emulator round-trips are slower than pure unit tests.
    testTimeout: 15_000,
    hookTimeout: 20_000,
  },
});
