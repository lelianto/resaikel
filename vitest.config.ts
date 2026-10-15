import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Force the deterministic mock adapter so the suite never calls Gemini and
    // never costs anything. Must be set before any module reads the config.
    env: {
      AI_MODE: 'mock',
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
    },
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/ai/schemas.ts'],
      reporter: ['text', 'html'],
    },
  },
});
