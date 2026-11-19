# Meridian Web: Design Spec

Status: approved 2026-11-17. Companion to `docs/spec.md` (behaviour). This file covers look, layout, components and states.
Source mockups: the Artifacts canvas "Meridian Web: Design Canvas" (board names below). The canvas is not in this repo; where a value below is marked "from mockup" it is not pinned here and should be confirmed against the canvas.

## 1. Principles
- Calm, legible, utilitarian. A glanceable clock board, not a dashboard.
- Never encode meaning by colour alone: day/night uses card tone plus icon plus label.
- Every interactive target is at least 44x44 px.
- Works with keyboard and screen reader; every pointer gesture has a keyboard path.
- Responsive from 360 px phones to wide desktops. Dialogs on desktop become full sheets on phone.

## 2. Design tokens
Implement as CSS custom properties. Light is the default; dark applies when Appearance resolves to dark (system or override).

### Colour, light
| Token | Value | Use |
|---|---|---|
| page | #EEF2F8 | app background |
| surface | #FFFFFF | day cards, panels, inputs |
| fg | #14213D | primary text |
| muted | #4A5A75 | secondary text |
| line | #D5DDEA | borders, dividers |
| accent | #2F4BD0 | primary button fill |
| accent-text | #1D3AB0 | links, LIVE label |
| control-border | #6F82A3 | secondary button border |
| night-card | #14213D (text #F4F7FF, muted #B9C6E0) | night cards |
| day-icon | #8A4200 | sun icon and label on day cards |
| night-icon | #F2C078 | moon icon and label on night cards |
| warn-bg / warn-border / warn-text | #FFF4D6 / #E3B341 / #4A2F00 | banners (storage error, Jump) |
| warn-accent | #A86F0C (dashed card border; darkened from #C58A1B to reach 3:1, owner 2026-11-18, decision R-7), #8A4200 (icon) | unrecognized-zone card |
| disabled | bg #C9D1E3, text #4A5A75 | disabled primary button |
Jump banner amber and the "Jump reference" tag: from mockup (JumpActive).

### Colour, dark (deep navy)
| Token | Value |
|---|---|
| page | #0B1426 |
| night-card | #14213D, border #2C3C63, text #F4F7FF, muted #B9C6E0 |
| day-card (softened) | bg #DCE6F7, text #14213D, muted #3F5070, line #B4C3DE, chip bg #C4D3F5, chip text #1D3AB0, icon #8A4200 |
| accent | #8FB0FF; primary button fill #8FB0FF with text #0B1426 |
| control-border | #7A8DB3 |
| dialog panel | #14213D, border #2C3C63, backdrop #050A14 |
Dark warn and error colours: not mocked; derive and verify contrast.
Contrast: verify every text/background pair meets WCAG AA (4.5:1 body, 3:1 large text and icons) in both modes with an automated check.

### Type
- IBM Plex Serif 500/600: wordmark, dialog titles, city names, clock digits.
- IBM Plex Sans 400/500/600: all other text.
- Self-host the fonts (no third-party font requests). Sizes from mockup: wordmark 30 (24 phone), dialog title 22, city name 20, clock 40, body 14-16, labels 13.

### Shape and spacing
- Radius: cards 16, dialogs 20, buttons and inputs 10-12, pills 999.
- Page padding 32 desktop / 16 phone; grid gap 20; card min-height about 214 (desktop list), min column width 268.
- Dialog panel 600 wide on desktop; shadow 0 24px 60px rgba(0,0,0,0.35).

## 3. Components
- **Header**: logo + "Meridian" wordmark left; Settings (gear) and About (info) icon buttons right.
- **Status pill**: "LIVE · Showing the current time" with a filled dot.
- **Buttons**: primary (accent fill), secondary (white, control-border), icon (transparent, 44x44), segmented control (radiogroup, selected = fg fill).
- **Clock card** (board: Main, Mobile, DarkMain, DarkMobile): day/night icon + label top left; drag handle and more-options button top right; city name; time (serif, 40) with AM/PM or 24h; relative-day chip; date; zone abbreviation; UTC offset; difference from my time. Day card light, night card dark, per real sunrise/sunset.
- **Add-city tile** at the end of the grid.
- **Dialog / sheet**: title, close, content, footer with primary Done. Focus trap, Esc closes, focus returns to the opener.
- **Search result row** (AddCity*): city, region and country, local time, UTC offset and abbreviation, match tag, Add / Added state.
- **Popover / bottom sheet** (CardMenu*, JumpPicker, JumpPhone): popover on desktop, bottom sheet on phone.
- **Banner**: amber, role alert, dismissible.
- **Toast**: bottom, "<City> removed" with Undo; duration open (spec section 8).
- **Radiogroup** for Settings options with icons for Appearance.

## 4. Screens and states (board names)
| Screen | Boards |
|---|---|
| Clock list | Main, Mobile |
| Add city | AddCity, AddCityAirport, AddCityZone, AddCityEmpty, AddCityPhone |
| Jump | JumpActive, JumpPicker, JumpPickerGap, JumpPickerOverlap, JumpPhone |
| Card menu | CardMenu, CardMenuRename, CardMenuRemoved, CardMenuPhone |
| Dark mode and Settings | DarkMain, DarkMobile, Settings (interactive) |
| About | About, AboutPhone |
| Empty list | EmptyList, EmptyListPhone |
| Errors | ErrorStorage, ErrorZone, ErrorPhone |

## 5. Behaviour that affects visuals
- Appearance: System by default (prefers-color-scheme), override Light/Dark stored locally. Settings changes apply live. Avoid a flash of the wrong theme on load (set the theme before first paint).
- Time format: Browser default / 12-hour / 24-hour, applied everywhere times appear, including dialogs.
- Jump active: clocks stop ticking, amber banner (Copy link, Change, Reset to live), reference card tagged.
- Reduced motion: respect prefers-reduced-motion for drag, dialog and toast animation.
- Live regions: do not announce every clock tick. Announce Added, removed, Jump applied and errors.

## 6. Accessibility checklist
- Touch targets at least 44x44.
- Focus ring visible in both themes.
- Drag reorder has Move up/down in the card menu.
- Dialogs: role dialog, labelled, focus trap, Esc.
- Icons paired with text labels for day/night.
- Banner uses role alert; toasts use role status.
- Test with keyboard only and one screen reader before release.

## 7. Content
- Voice: plain and short. Credits and licence copy lives in About (GeoNames CC BY 4.0 required).
- Placeholders to finalise: About version string and site URL; airport-data credit pending its licence.

## 8. Performance and deployment
Bundle and data-size budgets, caching, headers and launch gating are in `docs/hosting-plan.md` (sections 3, 4, 8). They are requirements, not suggestions: the free hosting tier has a 10 GB/month transfer limit.
