/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { thirdPartyLicenses } from './scripts/thirdPartyLicenses.ts';
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

/** About's version line (D21): package.json's version and the commit it was built from. */
function buildInfo() {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  let sha = 'dev';
  try {
    sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // Not a git checkout: say so rather than fail the build.
  }
  return { __APP_VERSION__: JSON.stringify(version), __BUILD_SHA__: JSON.stringify(sha) };
}

export default defineConfig({
  plugins: [themeBoot(), react(), thirdPartyLicenses()],
  define: buildInfo(),
  server: {
    // `npm run dev` sends bug reports to the Functions emulator (functions/README.md), the way
    // Hosting's rewrite sends them to the deployed function.
    proxy: {
      '/api/report-bug': {
        target: 'http://127.0.0.1:5001',
        rewrite: () => '/meridian-web-a5829/us-central1/reportBug',
      },
    },
  },
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
          include: ['src/time/**/*.test.ts', 'src/ui/send/**/*.test.ts'],
          setupFiles: ['src/test/setup.ts'],
          restoreMocks: true,
          env: { MERIDIAN_TEMPORAL: 'polyfill' },
        },
      },
    ],
  },
});
