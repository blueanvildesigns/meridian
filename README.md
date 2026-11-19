# Meridian

A world clock for planning across time zones, in your browser: **<https://meridian.blueanvildesigns.io>**

- Keep a list of cities and see each one's time, day and offset at a glance.
- Jump to any moment to see it everywhere at once, and share that moment as a link.
- Works on phones and desktops, in light and dark, and is built to work with a keyboard and screen readers.

## Privacy

No accounts, no analytics, no cookies, and no requests to anyone else's servers. Your cities and settings stay in your browser.

## The code

The web app is in [`webapp/`](webapp/): React, TypeScript and Vite, served as a static site from Firebase Hosting. [`webapp/README.md`](webapp/README.md) covers building, testing and deploying it. The specs and every decision made along the way are in [`docs/`](docs/).

The original Meridian desktop app, built with Flutter for Windows and macOS, is still in this repository, in `lib/` and the platform folders.

## Licences

- The web app: MIT, © 2026 Blue Anvil Designs ([`webapp/LICENSE`](webapp/LICENSE)). City data from [GeoNames](https://www.geonames.org/) under CC BY 4.0, airport codes from [OurAirports](https://ourairports.com/), public domain.
- The Flutter app: GNU GPL v3 ([`LICENSE`](LICENSE)).

## Blue Anvil Designs

Meridian is a [Blue Anvil Designs](https://blueanvildesigns.com) project. If it's useful to you, you can [support it on Ko-fi](https://ko-fi.com/grahamtholomew).
