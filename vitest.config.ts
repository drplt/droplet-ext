import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'entrypoints/**'],
      exclude: ['**/*.test.*'],
    },
  },
});
