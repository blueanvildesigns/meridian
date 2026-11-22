# Meridian

A world clock for planning across time zones, in your browser: **<https://meridian.blueanvildesigns.io>**

- Keep a list of cities and see each one's time, day and offset at a glance.
- Jump to any moment to see it everywhere at once, and share that moment as a link.
- Works on phones and desktops, in light and dark, and is built to work with a keyboard and screen readers.

## Privacy

No accounts, no analytics, no cookies, and no requests to anyone else's servers. Your cities and settings stay in your browser.

The one exception is a bug report, and only when you press Send: the in-app form sends what you typed (and, if you leave the box ticked, the diagnostics it shows you) to Meridian's server, which files a public GitHub issue. To keep out spam, sending first loads Google reCAPTCHA, which Google's [privacy policy](https://policies.google.com/privacy) covers. Your saved cities are never sent.

## The code

The web app is in [`webapp/`](webapp/): React, TypeScript and Vite, served as a static site from Firebase Hosting. [`webapp/README.md`](webapp/README.md) covers building, testing and deploying it. The in-app bug report's one server function is in [`functions/`](functions/) ([`functions/README.md`](functions/README.md)). The specs and every decision made along the way are in [`docs/`](docs/).

The original Meridian desktop app, built with Flutter for Windows and macOS, is still in this repository, in `lib/` and the platform folders.

## Licences

- The web app: MIT, © 2026 Blue Anvil Designs ([`webapp/LICENSE`](webapp/LICENSE)). City data from [GeoNames](https://www.geonames.org/) under CC BY 4.0, airport codes from [OurAirports](https://ourairports.com/), public domain.
- The Flutter app: GNU GPL v3 ([`LICENSE`](LICENSE)).

## Blue Anvil Designs

Meridian is a [Blue Anvil Designs](https://blueanvildesigns.com) project. If it's useful to you, you can [support it on Ko-fi](https://ko-fi.com/grahamtholomew).
