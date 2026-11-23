// Pages allowed to send bug reports. The Origin header is easy to fake outside a browser, so this
// only stops other websites from using a visitor's browser to post reports; App Check does the rest.

const ALLOWED = new Set([
  'https://meridian.blueanvildesigns.io',
  'https://meridian-web-a5829.web.app',
  'https://meridian-web-a5829.firebaseapp.com',
]);

/** Hosting preview channels: https://meridian-web-a5829--<channel>-<hash>.web.app */
const PREVIEW = /^https:\/\/meridian-web-a5829--[a-z0-9-]+\.(?:web\.app|firebaseapp\.com)$/;

/** The Vite dev server and the Hosting emulator. */
const LOCAL = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

export function isAllowedOrigin(origin: string, { emulator }: { emulator: boolean }): boolean {
  return ALLOWED.has(origin) || PREVIEW.test(origin) || (emulator && LOCAL.test(origin));
}
