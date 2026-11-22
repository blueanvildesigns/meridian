// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { packageDir, readPackage, renderLicences } from './thirdPartyLicenses';

describe('packageDir', () => {
  it('finds the package a bundled file came from', () => {
    expect(packageDir('/app/node_modules/react-dom/cjs/react-dom-client.production.js')).toBe(
      '/app/node_modules/react-dom',
    );
    expect(packageDir('/app/node_modules/@dnd-kit/core/dist/core.esm.js')).toBe(
      '/app/node_modules/@dnd-kit/core',
    );
  });

  it('takes the innermost package, and ignores virtual-module marks and queries', () => {
    expect(packageDir('\0/app/node_modules/a/node_modules/b/index.js?commonjs-exports')).toBe(
      '/app/node_modules/a/node_modules/b',
    );
    expect(packageDir('node_modules/@fontsource/ibm-plex-sans/files/x.woff2')).toBe(
      'node_modules/@fontsource/ibm-plex-sans',
    );
    expect(packageDir('C:\\app\\node_modules\\react\\index.js')).toBe('C:/app/node_modules/react');
  });

  it('returns null for our own code', () => {
    expect(packageDir('/app/src/main.tsx')).toBeNull();
    expect(packageDir('\0vite/modulepreload-polyfill.js')).toBeNull();
  });
});

describe('readPackage', () => {
  it('reads the name, version, licence and the full text of an installed package', () => {
    const react = readPackage('node_modules/react');
    expect(react).toMatchObject({ name: 'react', licence: 'MIT' });
    expect(react.text).toMatch(/^MIT License\s+Copyright \(c\) Meta Platforms/);
    expect(readPackage('node_modules/@fontsource/ibm-plex-sans').text).toContain(
      'SIL OPEN FONT LICENSE',
    );
  });

  it('ships the standard Apache-2.0 text for a package that declares it but has no file', () => {
    const appCheck = readPackage('node_modules/@firebase/app-check');
    expect(appCheck).toMatchObject({ name: '@firebase/app-check', licence: 'Apache-2.0' });
    expect(appCheck.text).toMatch(/^Apache License\s+Version 2\.0, January 2004/);
    expect(appCheck.text).toMatch(/END OF TERMS AND CONDITIONS$/);
  });
});

describe('renderLicences', () => {
  it('opens with Meridian’s own licence and the data credits, then each package by name', () => {
    const text = renderLicences([
      { name: 'zeta', version: '1.0.0', licence: 'MIT', text: 'Z text' },
      { name: '@scope/alpha', version: '2.0.0', licence: 'OFL-1.1', text: 'A text' },
    ]);
    expect(text).toContain('MIT licence, copyright (c) 2026 Blue Anvil Designs');
    expect(text).toContain('GeoNames');
    expect(text).toContain('CC BY 4.0');
    expect(text).toContain('OurAirports');
    expect(text.indexOf('@scope/alpha 2.0.0 (OFL-1.1)')).toBeLessThan(
      text.indexOf('zeta 1.0.0 (MIT)'),
    );
    expect(text).toContain('Z text');
  });
});
