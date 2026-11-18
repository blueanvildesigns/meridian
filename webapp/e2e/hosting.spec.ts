import { expect, test } from '@playwright/test';

// These run against scripts/serve-dist.ts, which applies firebase.json's headers and rewrites.

test('serves the shell with security headers, noindex and no caching', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-robots-tag']).toContain('noindex');
  expect(h['cache-control']).toBe('no-cache');
});

test('serves hashed assets as immutable', async ({ page }) => {
  const responses: { url: string; cache: string | undefined }[] = [];
  page.on('response', (r) => {
    if (new URL(r.url()).pathname.startsWith('/assets/')) {
      responses.push({ url: r.url(), cache: r.headers()['cache-control'] });
    }
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(responses.length).toBeGreaterThan(0);
  for (const r of responses) expect(r.cache, r.url).toBe('public, max-age=31536000, immutable');
});

test('rewrites unknown paths to the app', async ({ page }) => {
  await page.goto('/no/such/route');
  await expect(page.getByRole('heading', { level: 1, name: 'Meridian' })).toBeVisible();
});

test('runs under the production CSP with no violations', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations: string[] };
    w.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // The inline theme script is allowed only by its hash: if the hash drifted, this attribute is missing.
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const violations = await page.evaluate(
    () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
  );
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

test('asks search engines not to index the pre-launch site', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
});
