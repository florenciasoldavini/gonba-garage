import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The `@/*` path from tsconfig.json, also for the JavaScript test files.
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./', import.meta.url)) }],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.mjs'],
    setupFiles: ['tests/setup.mjs'],
    // Each test starts from the file's own environment, globals and spies.
    unstubEnvs: true,
    unstubGlobals: true,
    restoreMocks: true,
  },
});
