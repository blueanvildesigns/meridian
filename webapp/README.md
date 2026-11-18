# Meridian Web

The web rewrite of Meridian. Spec: [`../docs/spec.md`](../docs/spec.md), design: [`../docs/design-spec.md`](../docs/design-spec.md), decisions: [`../docs/decisions-log.md`](../docs/decisions-log.md).

## Develop

Requires Node 26 (see `.nvmrc`).

```bash
npm ci
npm run dev        # http://localhost:5173
npm run check      # lint, format, typecheck, unit tests, build, e2e
```

E2E runs against the production build, served by `npm run serve` (`scripts/serve-dist.ts`) with the headers, CSP and rewrites from `../firebase.json`, on Chromium, Firefox, WebKit and mobile Chromium. First run: `npx playwright install chromium firefox webkit`. Playwright's WebKit build needs Ubuntu libraries; on other Linux distributions run a subset locally, for example `npx playwright test --project=chromium --project=firefox`, and rely on CI for WebKit.
