# Decision: migration, license, branding

Date: 2026-11-17
Source: design interview, round 2.

## Decisions

1. **Migration: fresh start.** The web app does not import desktop data. Users re-add their cities. Revisit only if real users with saved lists turn up.
2. **License: relicense to a permissive license (MIT unless changed).** The desktop repo is GPL-3.0. Relicensing requires every contributor's agreement; the analysis found no evidence of other authors, but confirm with `git shortlog -sne --all` and check for contributed code before changing the license. The final choice (MIT vs another permissive license) is to be confirmed when the LICENSE file is replaced. Existing GPL-3.0 releases stay GPL-3.0 for those who already received them.
3. **Branding carried over:** Blue Anvil Designs branding, the Ko-fi link, and an About page.
4. **Not carried over:** the web app does not replace the existing marketing site (`index.html` on GitHub Pages). Their relationship is to be decided if the site is ever retired.
5. **Stack and hosting:** to be discussed as its own interview topic. No decision yet.
