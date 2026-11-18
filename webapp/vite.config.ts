/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { THEME_BOOT_SCRIPT } from './src/app/themeBoot.ts';

/** Inlines the theme bootstrap into <head> so the theme is set before first paint. */
function themeBoot(): Plugin {
  return {
    name: 'meridian-theme-boot',
    transformIndexHtml: () => [
      { tag: 'script', children: THEME_BOOT_SCRIPT, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  plugins: [themeBoot(), react()],
  build: {
    target: 'es2023',
    sourcemap: true,
  },
  test: {
    // Each project lists its own files: Vitest merges a root `include` into every project.
    projects: [
      {
        // Everything, on the engine's native Temporal (Node 26).
        extends: true,
        test: {
          name: 'native',
          environment: 'happy-dom',
          include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
          setupFiles: ['src/test/setup.ts'],
          restoreMocks: true,
        },
      },
      {
        // The time core again, with native Temporal removed so the polyfill runs (Safari's path).
        extends: true,
        test: {
          name: 'polyfill',
          environment: 'node',
          include: ['src/time/**/*.test.ts'],
          setupFiles: ['src/test/setup.ts'],
          restoreMocks: true,
          env: { MERIDIAN_TEMPORAL: 'polyfill' },
        },
      },
    ],
  },
});
