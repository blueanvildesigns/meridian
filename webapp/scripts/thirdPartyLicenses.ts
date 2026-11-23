// Ships the licences of the third-party code and fonts in the build (M7-3). Minifying drops their
// licence comments, and MIT and the SIL OFL both ask for the notice to go with every copy, so the
// build writes them to one file and each script's first line points to it. The list comes from
// what actually landed in the bundle, so it can't drift from package.json.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** Served next to index.html. */
export const LICENSES_FILE = 'third-party-licenses.txt';

export interface PackageLicence {
  name: string;
  version: string;
  licence: string;
  text: string;
}

/** The package folder a bundled file came from, or null for our own code. */
export function packageDir(id: string): string | null {
  const path = id.replace(/^\0/, '').replace(/\?.*$/, '').replaceAll('\\', '/');
  const at = path.lastIndexOf('node_modules/');
  if (at === -1) return null;
  const parts = path.slice(at + 'node_modules/'.length).split('/');
  const [first, second] = parts;
  if (!first) return null;
  const name = first.startsWith('@') && second ? `${first}/${second}` : first;
  return path.slice(0, at) + 'node_modules/' + name;
}

/** Name, version, licence and full licence text from an installed package. */
export function readPackage(dir: string): PackageLicence {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    name: string;
    version: string;
    license?: string;
  };
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const standard = pkg.license ? STANDARD_TEXTS[pkg.license] : undefined;
  if (!file && !standard) throw new Error(`${pkg.name} has no licence file to ship`);
  return {
    name: pkg.name,
    version: pkg.version,
    licence: pkg.license ?? 'see below',
    text: readFileSync(file ? join(dir, file) : (standard ?? ''), 'utf8').trim(),
  };
}

/**
 * Licences whose text is the same for everyone, for packages that declare one but ship no file:
 * the Firebase SDK (`@firebase/*`, Apache-2.0) has none in its npm packages, and Apache-2.0 asks
 * for a copy to go with the code. The text is the Apache Software Foundation's, copied unchanged
 * from TypeScript's LICENSE.txt.
 */
const STANDARD_TEXTS: Record<string, string> = {
  'Apache-2.0': fileURLToPath(new URL('./licences/Apache-2.0.txt', import.meta.url)),
};

const RULE = '='.repeat(72);

/** The file's text: what Meridian is under, the data credits, then each package in name order. */
export function renderLicences(packages: readonly PackageLicence[]): string {
  const sorted = [...packages].sort((a, b) => a.name.localeCompare(b.name));
  return [
    'Meridian: third-party licences',
    '',
    'Meridian is released under the MIT licence, copyright (c) 2026 Blue Anvil Designs.',
    'City data: GeoNames (https://www.geonames.org/), licensed under CC BY 4.0',
    '(https://creativecommons.org/licenses/by/4.0/). Airport codes: OurAirports',
    '(https://ourairports.com/), public domain. Time zone rules come from your browser.',
    '',
    'The app includes the following software and fonts, each under its own licence.',
    ...sorted.flatMap((p) => ['', RULE, `${p.name} ${p.version} (${p.licence})`, RULE, '', p.text]),
    '',
  ].join('\n');
}

export function thirdPartyLicenses(): Plugin {
  return {
    name: 'meridian-third-party-licenses',
    apply: 'build',
    // After minifying, which would drop it (Rolldown's postBanner keeps the source maps right).
    outputOptions: (options) => ({
      ...options,
      postBanner: (chunk) =>
        chunk.fileName.endsWith('.js') ? `/*! Third-party licences: /${LICENSES_FILE} */` : '',
    }),
    generateBundle(_options, bundle) {
      const dirs = new Set<string>();
      for (const file of Object.values(bundle)) {
        const ids = file.type === 'chunk' ? file.moduleIds : file.originalFileNames;
        for (const id of ids) {
          const dir = packageDir(id);
          if (dir) dirs.add(dir);
        }
      }
      this.emitFile({
        type: 'asset',
        fileName: LICENSES_FILE,
        source: renderLicences([...dirs].map(readPackage)),
      });
    },
  };
}
