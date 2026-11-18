// The one place that decides which Temporal implementation the app uses.
// Native Temporal where the engine has it (Chrome/Edge 144+, Firefox 139+, Node 26), otherwise
// the `temporal-polyfill` package, loaded lazily so engines with native support never download it.
// Either way, zone rules come from the engine's Intl data: no tzdata is bundled.
//
// Everything else calls T() instead of touching the global, so the polyfill path is the same code
// path as the native one (enforced by ESLint's no-restricted-globals in src/time).

export type TemporalApi = typeof Temporal;
export type TemporalSource = 'native' | 'polyfill';

let api: TemporalApi | undefined;
let source: TemporalSource | undefined;

function nativeTemporal(): TemporalApi | undefined {
  // Guard against a partial or stubbed global.
  const candidate = (globalThis as { Temporal?: { Now?: { instant?: unknown } } }).Temporal;
  return typeof candidate?.Now?.instant === 'function'
    ? (candidate as unknown as TemporalApi)
    : undefined;
}

/** Loads Temporal once. Call before rendering anything time-based. */
export async function loadTemporal(): Promise<TemporalApi> {
  if (api) return api;
  const native = nativeTemporal();
  if (native) {
    api = native;
    source = 'native';
  } else {
    const mod = await import('temporal-polyfill');
    // The polyfill tracks the same spec as TypeScript's esnext.temporal lib.
    api = mod.Temporal;
    source = 'polyfill';
  }
  return api;
}

/** The loaded Temporal API. Throws if loadTemporal() hasn't finished. */
export function T(): TemporalApi {
  if (!api) throw new Error('Temporal is not loaded yet: await loadTemporal() first.');
  return api;
}

export function temporalSource(): TemporalSource | undefined {
  return source;
}
