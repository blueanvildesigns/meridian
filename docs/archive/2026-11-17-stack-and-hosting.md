# Decision: stack, time library, city data, hosting

Date: 2026-11-17
Source: design interview, round 3.

## Decisions

1. **UI: React + TypeScript + Vite.** Static single-page app, no backend (consistent with the local-only decision).
2. **Time math: Temporal with a polyfill.** Use the native Temporal API where present (Chrome 144+, Firefox 139+) and a polyfill (`temporal-polyfill` or `@js-temporal/polyfill`) elsewhere. As of mid-2026, stable Safari was reported as not yet shipping Temporal, though sources conflict. Verify current support before locking the polyfill strategy. Time zone rules still come from the browser's `Intl`, so rule updates arrive with browser updates. Pin an exact polyfill version and cover Jump with tests.
3. **City data: GeoNames subset.** Filter GeoNames (CC BY 4.0) to a bounded set of cities, map each to an IANA zone, and bundle as static JSON with aliases (e.g. Mumbai, San Francisco, PST). Requires an attribution line (put it on the About page). Exact population threshold and alias source to be decided during implementation planning.
4. **Hosting: the user's GCP setup.** Static files. The exact mechanism (Cloud Storage + CDN/load balancer, Firebase Hosting, or the existing VM) is still open; a static SPA does not need the VM. Domain and cost to be decided.

## Open follow-ups

- Confirm Safari Temporal status and pick the polyfill.
- Choose the GCP hosting mechanism and domain.
- Set the GeoNames filter threshold and how aliases are sourced.
