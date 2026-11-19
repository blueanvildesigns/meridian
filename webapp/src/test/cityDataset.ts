import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decodeDataset, type CityDataset } from '../cities/dataset';

let cached: CityDataset | undefined;

/** The real generated dataset, read from disk (tests only). */
export function realDataset(): CityDataset {
  cached ??= decodeDataset(
    // Vitest runs from webapp/; happy-dom gives import.meta.url an http: scheme.
    JSON.parse(readFileSync(resolve('src/cities/data/cities.v1.json'), 'utf8')),
  );
  return cached;
}
