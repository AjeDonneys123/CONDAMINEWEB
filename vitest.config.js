/**
 * 🛡️ CONFIGURATION VITEST V500
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    // On désactive les threads pour éviter les collisions de modèles Mongoose sur ton Mac
    threads: false,
    isolate: false
  },
});
