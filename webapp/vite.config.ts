/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { THEME_BOOT_SCRIPT } from './src/app/themeBoot';

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
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
  },
});
