# Meridian: Reverse-Engineering Spec

Status: written 2026-11-17 against `main` @ `a095275` ("Added theme picker and neumorphism theme option"). Read-only analysis. No source files were changed.

## Read this first: the app is not a meeting coordinator

The brief describes an app that "helps coordinate meeting times across people in different time zones". **The code does not do that.** Meridian is a **world clock**: a reorderable list of city cards with a **"Jump"** feature that previews one chosen time-of-day across every card. There are **no people, teams, working hours, availability, overlap calculations, suggested meeting times, or saved meetings** anywhere in the code, in any commit, or on any branch:

- `git log --all -G "meeting|overlap|working.?hours|availability|attendee|person|people|team"` only matches README, LICENSE and website commits.
- `origin/feature/branding`, `origin/feature/settings-panel` and `origin/feature/system-tray` contain no commits that aren't already on `main`.

The "meeting" framing exists only in marketing copy: `README.md:26` ("Planning a meeting across 3 timezones"), `index.html:7`, `:294` and `:350`. Much of the brief (overlap logic, working hours crossing midnight, people/teams data model) therefore comes back as **"does not exist"**. See Open question 1.

### How claims are marked

| Tag | Meaning |
|---|---|
| **[RAN]** | I executed it: analyzer, tests, or a probe script that copies the app's logic verbatim with an injected clock. |
| **[READ]** | I traced the code path by hand but did not execute it. |
| **UNVERIFIED** | Inference. Plausible, but not confirmed. |

### What I could and couldn't run

- **No native build or launch was possible.** This machine (CachyOS Linux) has no Flutter SDK, and the repo has no `linux/` runner. It targets Windows and macOS only. Building for Linux would need `flutter create --platforms=linux .`, which writes into the repo, plus `cmake` and `ninja`, which aren't installed. **Whether the app still launches on Windows or macOS is UNVERIFIED.**
- What I did instead: I installed a throwaway **Flutter 3.50.0 / Dart 3.14.0** (current stable) in a session scratch directory and copied the repo there. In the copy I ran `pub get`, `flutter analyze` and `flutter test`. I also ran (a) a pure-Dart probe that copies `getCityData` and `_pickTime` line for line with an injected "now", under `TZ=America/Chicago`, and (b) widget tests against the real `ClockProvider` and `TimeControls` classes. The original repo was not touched. Results are in the sections below and in the Appendix.
- `flutter pub get --enforce-lockfile` **fails** on Flutter 3.50. Nine SDK-pinned transitive packages have moved (e.g. `vector_math 2.2.0 → 2.4.4`, `meta 1.17.0 → 1.19.0`). A normal `pub get` resolves fine without changing any direct dependency. **[RAN]**
- Library code compiles on 3.50. The analyzer reports no errors under `lib/`, and the widget tests compiled and ran `ClockProvider` and `TimeControls`. **[RAN]**

---

## 1. Tech stack and structure

| Aspect | Finding |
|---|---|
| Language | Dart (SDK constraint `>=3.2.3 <4.0.0`; the lockfile requires Dart ≥3.9 / Flutter ≥3.35) |
| UI framework | Flutter, Material 3 widgets |
| State management | `provider` (`ChangeNotifierProvider` ×2 via `MultiProvider`) |
| Build system | Flutter tool, i.e. CMake (Windows runner) and Xcode (macOS runner). No Makefile or scripts. |
| Platforms actually supported | **Windows and macOS** (README badge; `Platform.isWindows` / `isMacOS` branches in `lib/main.dart:53-63`). `android/` and `ios/` are untouched `flutter create` scaffolding (`com.example.meridian`). The app calls `windowManager.ensureInitialized()` unconditionally at startup, so it would almost certainly fail on mobile (**UNVERIFIED**). No `linux/` or `web/` folders. |
| CI | `.github/workflows/build_mac.yaml`: macOS release build on every push to `main`. It uses a floating `stable` channel, doesn't run tests, and has no Windows job. The comment at line 29 mentions `--no-codesign`, but the flag isn't passed. |
| Size | ~1,450 lines of Dart in 12 files under `lib/`, plus one test file. |
| License | GPL-3.0 (`LICENSE`) |

### Dependencies (`pubspec.yaml`, versions from `pubspec.lock`, "latest" from `flutter pub outdated` on 2026-11-17 [RAN])

| Package | Locked | Latest | Used for | Notes |
|---|---|---|---|---|
| `timezone` | 0.9.4 | 0.11.2 | All zone math, zone list | **Bundles tzdata 2024a** (see §3), now 2.5 years stale. |
| `window_manager` | 0.4.3 | 0.7.0 | Frameless window, opacity, always-on-top, hide-on-close, bounds | Three major versions behind. Pulls in **discontinued** `screen_retriever_*` 0.2.0 (replaced by `nativeapi`). |
| `tray_manager` | 0.5.2 | 0.9.0 | Tray icon and menu | Pulls in **discontinued** `menu_base` 0.1.1. |
| `flutter_acrylic` | 1.1.4 | 1.1.4 | Acrylic/vibrancy window effect | No newer version. Maintenance status UNVERIFIED. |
| `google_fonts` | 6.3.3 | 9.0.0 | IBM Plex Serif text theme | Downloads fonts **at runtime** from Google (see §5, §6). |
| `shared_preferences` | 2.5.4 | 2.5.6 | All persistence | Uses the legacy `SharedPreferences.getInstance()` API. |
| `provider` | 6.1.5+1 | current | State | |
| `url_launcher` | 6.3.2 | 6.3.3 | "About" link | |
| `intl` | 0.19.0 | 0.20.3 | **Nothing**. Declared but never imported in `lib/`. [READ] | Dead dependency. |
| `flutter_lints` (dev) | 3.0.2 | n/a | Lints | |

Platform deprecation: on Flutter ≥3.47, `package:flutter/material.dart` **itself is deprecated** in favour of `package:material_ui/material_ui.dart`, and all 10 UI files import it. Other deprecations are listed in §7. **[RAN]**

### Map of what lives where

```
lib/
  main.dart                       Startup: window, acrylic, tz DB init, window-bounds restore, tray, providers; MeridianApp (MaterialApp + window listener)
  models/city.dart                City {name, timezoneId}. The entire domain model (5 lines).
  providers/clock_provider.dart   City list, live/jumped time, 1 s ticker, getCityData() (all time display logic), persistence of cities
  providers/settings_provider.dart  Theme (glass|neumorphic), window opacity, always-on-top, persisted and applied to the native window
  managers/system_tray_manager.dart Tray icon, Show/Quit menu
  screens/home_screen.dart        Main screen: title bar, header, reorderable card list, add-city FAB, TimeControls
  screens/settings_screen.dart    Settings dialog
  widgets/clock_card.dart         One city card
  widgets/city_search.dart        Full-screen IANA zone search (SearchDelegate)
  widgets/time_controls.dart      Bottom bar: jump-zone dropdown, Jump (time picker), Reset-to-live; contains the jump time math
  widgets/window_title_bar.dart   Custom title bar: drag area, settings, minimize/maximize/close
  utils/style_helper.dart         Hardcoded colours, decorations and fonts for both themes
test/widget_test.dart             Unmodified Flutter template test (broken, see §7)
assets/images/                    app_icon.ico (Windows tray), tray_icon.png (macOS tray)
index.html, logo.png, preview.png, Screenshot*.png   Marketing site (GitHub Pages), not part of the app
windows/, macos/                  Flutter-generated native runners (stock, apart from generated plugin registrants)
android/, ios/                    Unused scaffolding
```

---

## 2. Features and user flows

Every behaviour below is what the code does. Where docs claim more, that's called out.

### 2.1 Launch [READ]
1. `main()` (`lib/main.dart:14`) initialises `window_manager` and `flutter_acrylic`, then loads the bundled tz database with `tz.initializeTimeZones()` from `package:timezone/data/latest.dart`.
2. It reads `window_width/height/x/y` from SharedPreferences. It shows the window at 500×800 (minimum 400×600) with a hidden native title bar and a transparent background, restoring the saved size and position if present (otherwise it centres). There is **no check that the saved position is on a connected screen.**
3. After showing the window it initialises the tray icon, sets `setPreventClose(true)` so Close hides instead of quitting, and applies the window effect: Acrylic with tint `0xCC222222` on Windows, `sidebar` vibrancy on macOS.
4. `ClockProvider()` loads the cities asynchronously and starts a 1-second `Timer.periodic`. `SettingsProvider()` loads theme, opacity and always-on-top and applies them to the native window.
5. Default cities, used when nothing is saved: **My Local Time** (`Local`), **New York** (`America/New_York`), **London** (`Europe/London`), **Tokyo** (`Asia/Tokyo`). `clock_provider.dart:100-105`.

### 2.2 Viewing clocks (live mode) [READ]
- Every second the timer calls `notifyListeners()`, which **rebuilds the whole `HomeScreen`**, because `Provider.of<ClockProvider>(context)` listens at the top of `home_screen.dart:37`.
- Each `ClockCard` (`clock_card.dart`) shows:
  - **City name** (bold).
  - **Relative day label**: `Today`, `Tomorrow`, `Yesterday`, `+N Days` or `-N Days`. Tomorrow and later are orange (`"warning"`); yesterday and earlier are red (`"error"`). This is the city's calendar date compared with **your local real date** (see §3.5).
  - **Time** in a hand-rolled 12-hour `h:mm AM/PM` format. There is no 24-hour option, no seconds, no date, no UTC offset and no zone abbreviation.
  - A **night style** (dark card, light text) when the city's hour is `< 6` or `>= 18`.
  - A **delete** button and a **drag handle**.

### 2.3 Add a city [READ, search behaviour RAN]
1. The user clicks the round **+** button (Glass theme) or the **"Add City"** pill in the header (Minimalist theme). `home_screen.dart:113-135, 188-205`.
2. `showSearch` opens `CitySearchDelegate` (`city_search.dart`). This is a full-screen list of **every key in the bundled tz database (431 entries)**, filtered by `zone.toLowerCase().contains(query.toLowerCase())`. Each row shows the last ID segment with `_` replaced by a space (e.g. "New York") and the first segment as subtitle (e.g. "America").
3. Tapping a row returns the raw IANA ID. `_showAddCitySearch` (`home_screen.dart:23`) derives the display name the same way (`split('/').last.replaceAll('_',' ')`), appends `City(name, id)` and saves.
4. There's **no de-duplication** and **no way to rename** a city.
5. Search problems, all [RAN]:
   - `"new york"` returns **0 results**, because the query has a space and the ID has an underscore. Only `"new_york"` or `"new"` work.
   - There are no city aliases. `"mumbai"`, `"san francisco"`, `"beijing"` and `"pst"` all return 0 results. `"india"` returns 19 `America/Indiana/*` zones and not `Asia/Kolkata`.
   - Backward-compat aliases appear as "cities". `US/Central` and `Canada/Central` both display as **"Central"**; the same happens for Eastern, Mountain and Pacific.
6. **"My Local Time" can't be re-added once deleted.** The search only offers IANA IDs, never the `Local` sentinel.

### 2.4 Remove a city [READ]
The trash icon calls `removeCity(index)`, which removes and saves immediately. There's no confirmation and no undo.

### 2.5 Reorder [READ]
Drag the handle (`ReorderableDragStartListener`). `reorderCity` applies the usual `newIndex -= 1` correction and saves.

### 2.6 Jump (the "meeting planning" feature) [READ, math RAN]
1. The bottom bar (`time_controls.dart`) has a dropdown with **"My Local Time"** plus every non-`Local` city, keyed by `timezoneId`.
2. Clicking **Jump** opens Flutter's `showTimePicker` in text-input mode, forced to 12-hour, titled "SELECT ⟨CITY⟩ TIME" and pre-filled with the current time in that zone.
3. The user can pick **only a time of day, not a date.** The code builds today's date in the target zone at that time. If that is earlier than now, it adds `Duration(days: 1)`. In other words: **"the next occurrence of HH:MM in that zone, within the next 24 hours."**
4. The resulting instant is stored as `_customTime` in `ClockProvider`. Every card then renders that instant and live ticking pauses.
5. A red **Reset** button appears and sets `_customTime = null` to return to live mode.
6. The jumped time is not persisted.
7. **The docs claim more than this.** The README's *"see what '3:00 PM next Tuesday' looks like"* is **impossible**, because there's no date picker. The website's *"See who will be asleep and who will be awake"* is only the 06:00–18:00 day/night card colouring. No working hours are involved.

### 2.7 Settings [READ]
The gear icon in the title bar opens `SettingsScreen`, a dialog with:
- **Visual Theme**: "Glass" (`AppTheme.glass`) or "Minimalist" (`AppTheme.neumorphic`). Minimalist sets the native window background to `#E0E5EC` and forces window opacity to 1.0.
- **Window Opacity** slider, 20–100%, shown in Glass only. It sets native window opacity **and** the background alpha (see §6).
- **Always on Top** switch.
- Every change is applied and saved immediately.

### 2.8 Window and tray [READ]
- A custom title bar provides the drag area, settings, minimize, a maximize/restore toggle, and close.
- **Close hides the window** (`onWindowClose`, `main.dart:119`). The app keeps running in the tray or menu bar.
- In the tray, left-click shows and focuses the window. Right-click opens a menu with "Show Meridian" and "Quit". Quit calls `windowManager.destroy()` and then `exit(0)`.
- Window position and size are saved **on every `onWindowMoved` / `onWindowResized` event**, which means four SharedPreferences writes per event during a drag.

### 2.9 About [READ]
The ⓘ icon opens `https://blueanvildesigns.github.io/meridian` in the default browser. If the launch fails it throws an unhandled `Exception`.

### Not present (searched for, not found)
People and contacts, teams, working hours, availability, overlap computation, meeting suggestions, saved meetings, calendar integration, sharing and export, notifications, reminders, clipboard, localisation, accessibility labels, and a 24-hour clock option.

---

## 3. Time zone logic

### 3.1 Representation [READ]
- `City.timezoneId` is a `String` holding either an **IANA zone ID** (e.g. `America/Chicago`) or the sentinel **`'Local'`**.
- There are no fixed UTC offsets and no custom zone objects. The IANA ID is the stored identity.
- The UI never shows an offset or abbreviation.

### 3.2 Zone data source [READ and RAN]
- Non-local zones come from the **`timezone` Dart package's embedded database**, loaded via `package:timezone/data/latest.dart`. It's compiled into the app binary and doesn't touch the OS. The README's "native IANA database" (`README.md:63`) is wrong.
- `timezone` 0.9.4 ships **tzdata 2024a** (its CHANGELOG says 0.9.3 updated to 2024a, and 0.9.4 didn't change data). [READ]
- The `latest` subset has **431 entries**. It includes some legacy aliases (`US/Eastern`, `Canada/*`, `GMT`, `UTC`) but not others (`Asia/Calcutta`, `Europe/Kiev`, `EST5EDT`, `Etc/*`). [RAN]
- `America/Ciudad_Juarez` and `America/Coyhaique` are **absent**, so users in those zones can't select them. [RAN]
- **Stale rules cause wrong times today.** With this data, `America/Asuncion` shows UTC−4 in April and July 2026. [RAN] Paraguay moved to permanent UTC−3 in late 2024 (tzdata 2024b). That date is from my knowledge of the tzdata release notes and was not checked in this session. So **Paraguay displays one hour off for roughly half of each year.** Any rule change after early 2024 has the same problem.
- **`'Local'` uses Dart's `DateTime.now()`**, which is the OS local time zone. `tz.setLocalLocation()` is **never called**, so the `timezone` package's own `tz.local` stays at its UTC default. It's unused, so that's harmless today but a trap. [READ]

### 3.3 Conversion algorithm (`ClockProvider.getCityData`, `clock_provider.dart:37-86`) [READ and RAN]
1. `reference = _customTime ?? DateTime.now()` gives an absolute instant.
2. For `Local`, `targetTime = reference`. Otherwise `targetTime = tz.TZDateTime.from(reference, tz.getLocation(id))`.
3. It formats `targetTime.hour` and `targetTime.minute`.

This is **instant-based conversion**, which is the correct approach. DST and fractional offsets come from the tz rules automatically. Verified correct at 2026-07-01T12:00Z [RAN]:

| Zone | Shown | Correct? |
|---|---|---|
| Asia/Kolkata (+5:30) | 5:30 PM | ✅ |
| Asia/Kathmandu (+5:45) | 5:45 PM | ✅ |
| Pacific/Chatham (+12:45) | 12:45 AM, "Tomorrow" | ✅ |
| Australia/Lord_Howe (30-minute DST: +10:30 / +11) | 10:30 PM in July, 11:00 PM in January | ✅ |
| America/St_Johns (−2:30 in summer) | 9:30 AM | ✅ |
| Pacific/Kiritimati (+14) | 2:00 AM, "Tomorrow" | ✅ |
| Pacific/Pago_Pago (−11) | 1:00 AM, "Today" | ✅ |

### 3.4 Day and night [READ]
`isNight = hour < 6 || hour >= 18` (`clock_provider.dart:78`). This is a fixed heuristic, not based on sunrise or sunset and not tied to working hours.

### 3.5 Relative day label [READ and RAN]
```dart
targetDate = DateTime(targetTime.year, targetTime.month, targetTime.day);   // built as a LOCAL-time midnight
realDate   = DateTime(realNow.year, realNow.month, realNow.day);            // local midnight
diff       = targetDate.difference(realDate).inDays;                        // Duration in hours ÷ 24, truncated
```
- It compares against the **real** local date, not the jumped reference. In Jump mode the label therefore means "relative to today", which is intentional per the `// Compare against REALITY` comment.
- **Bug: wrong label around local DST changes.** Both dates are local midnights, so across a spring-forward night the gap is 23 hours, and `inDays` truncates that to **0**. [RAN] Under `TZ=America/Chicago`, at 10:00 on 2026-03-08 (US spring-forward day), Tokyo is already 00:00 on 2026-03-09, but its card says **"Today"** instead of "Tomorrow". Jumping the Local card to 10:00 on 2026-03-09 also shows "Today". Fall-back days (25-hour gap) happen to come out right.

### 3.6 Jump math (`TimeControls._pickTime`, `time_controls.dart:18-84`) [READ and RAN]
The algorithm is described in §2.6. Edge cases, all reproduced with the verbatim logic:

| Case | Result | Expected | Verdict |
|---|---|---|---|
| London, now Sat 28 Mar 2026 12:00, pick 09:00 (UK springs forward that night) | **10:00 BST** Sun | 09:00 BST | ❌ The `+Duration(days:1)` adds 24 absolute hours, not one calendar day. |
| London, now Sat 24 Oct 2026 12:00, pick 09:00 (UK falls back that night) | **08:00 GMT** Sun | 09:00 GMT | ❌ Same cause. |
| Local = Chicago, now Sat 7 Mar 2026 12:00, pick 09:00 | **10:00** Sun 8 Mar | 09:00 | ❌ Same bug in the `Local` branch, which uses `DateTime.add`. |
| New York, spring-forward day, pick 02:30 (doesn't exist) | Silently 03:30 EDT | Warn, or ask | ⚠️ Shifted with no feedback. |
| New York, fall-back day, pick 01:30 (happens twice) | Silently 01:30 **EDT** (first occurrence) | Let the user choose | ⚠️ Ambiguity resolved silently. |
| Pick the current minute at hh:mm:30 | Jumps **24 hours ahead** | Now | ⚠️ `isBefore` includes the elapsed seconds. |
| Pick a time on a specific future date | Not possible | n/a | ❌ No date input. |

### 3.7 Overlap, availability, suggestions
**None.** No code computes overlapping hours, scores times or suggests slots. There's no working-hours concept, so "working hours that cross midnight in another zone" can't be evaluated. The closest thing is the user eyeballing Jump results against the day/night colouring.

### 3.8 Edge-case summary

| Edge case | Status | Evidence |
|---|---|---|
| Half-hour and 45-minute offsets (India, Nepal, Chatham, Newfoundland) | ✅ Displayed correctly | RAN §3.3 |
| DST in live display | ✅ Correct (instant-based) | RAN §3.3 |
| Zones with 30-minute DST (Lord Howe) | ✅ | RAN |
| ±12–14 hours / date line | ✅ Time and label correct | RAN |
| Day label on local DST-change days | ❌ Off by one | RAN §3.5 |
| Jump into tomorrow across a DST change (target or local) | ❌ Off by ±1 hour | RAN §3.6 |
| Nonexistent or repeated wall times | ⚠️ Silently resolved | RAN §3.6 |
| tz rule changes after 2024a (Paraguay etc.) | ❌ Wrong offsets | RAN §3.2 |
| New zones after 2022 (Ciudad Juárez, Coyhaique) | ❌ Not selectable | RAN §3.2 |
| Unknown or removed zone ID in saved data | ❌ `tz.getLocation` throws `LocationNotFoundException` inside `build`, so the card errors (UI effect UNVERIFIED). Possible after a tz-package upgrade drops an alias. | RAN (exception) |
| OS time zone changes while running | Probably follows (Dart re-reads the local offset); UNVERIFIED | |
| Working hours crossing midnight | N/A: feature doesn't exist | READ |
| 24-hour locales | Not supported; 12-hour forced everywhere | READ |

---

## 4. Data model and persistence

### 4.1 Model [READ]
```dart
class City { final String name; final String timezoneId; }   // lib/models/city.dart
enum AppTheme { glass, neumorphic }                         // lib/providers/settings_provider.dart
```
That's all. There is no ID, no ordering field (order = list position), and no people, teams, meetings or user profile.

### 4.2 Storage [READ]
Everything goes through `shared_preferences`. The plugin prefixes every key with `flutter.`.

| Key | Type | Written by | Notes |
|---|---|---|---|
| `saved_cities` | String (JSON array of `{name, id}`) | `ClockProvider._saveData` on add, remove and reorder | The defaults are **not** written until the first change. |
| `window_x`, `window_y`, `window_width`, `window_height` | double | `_MeridianAppState._saveWindowState` on every move/resize event | |
| `windowOpacity` | double (0.2–1.0) | `SettingsProvider.setWindowOpacity` | Default 0.95 |
| `alwaysOnTop` | bool | `SettingsProvider.setAlwaysOnTop` | |
| `appTheme` | int (enum index: 0 = glass, 1 = neumorphic) | `SettingsProvider.setTheme` | Index-based, so reordering the enum would corrupt saved values. |

Physical location (from the plugins' documented behaviour and this repo's identifiers; I couldn't inspect a real install, so **UNVERIFIED**):
- **Windows:** a JSON file at roughly `%APPDATA%\com.example\meridian\shared_preferences.json`. The `CompanyName` and `ProductName` come from `windows/runner/Runner.rc:92,98`.
- **macOS:** NSUserDefaults in the sandbox container, roughly `~/Library/Containers/com.example.meridian/Data/Library/Preferences/com.example.meridian.plist`.

Sample on-disk content (Windows JSON form, reconstructed from the code):
```json
{
  "flutter.saved_cities": "[{\"name\":\"My Local Time\",\"id\":\"Local\"},{\"name\":\"New York\",\"id\":\"America/New_York\"},{\"name\":\"Kolkata\",\"id\":\"Asia/Kolkata\"}]",
  "flutter.window_x": 812.0,
  "flutter.window_y": 140.0,
  "flutter.window_width": 500.0,
  "flutter.window_height": 800.0,
  "flutter.windowOpacity": 0.95,
  "flutter.alwaysOnTop": false,
  "flutter.appTheme": 0
}
```
Note that `saved_cities` is a JSON string nested inside the prefs store.

### 4.3 Robustness [RAN]
- If `saved_cities` is corrupt, `jsonDecode` throws an uncaught `FormatException` in the async `_loadData`. The user sees an **empty list**, not the defaults. The next add overwrites the corrupt value.
- There's no schema version, migration, or import/export.

---

## 5. Desktop-only dependencies

| Dependency | Where | What it does | Web situation (observation only) |
|---|---|---|---|
| `window_manager` | `main.dart`, `settings_provider.dart`, `window_title_bar.dart`, `system_tray_manager.dart` | Frameless window, custom drag/min/max/close, hide-on-close, window opacity, always-on-top, native background colour, size and position persistence | No equivalent. Browser tabs own their own chrome. |
| `flutter_acrylic` | `main.dart:17,53-63` | Acrylic (Windows) and vibrancy (macOS) blur behind the window | None. CSS `backdrop-filter` only blurs page content, not the desktop. |
| `tray_manager` | `managers/system_tray_manager.dart` | Tray or menu-bar icon, Show/Quit menu, keep running after close | None. Closest analogues are an installed PWA or a pinned tab. |
| `dart:io` (`Platform`, `exit`) | `main.dart`, `system_tray_manager.dart` | OS detection, process exit | Not available on web. |
| OS local time zone via `DateTime.now()` | `clock_provider.dart`, `time_controls.dart` | The `Local` card | The browser exposes the zone, e.g. `Intl.DateTimeFormat().resolvedOptions().timeZone`. |
| `shared_preferences` | providers, `main.dart` | Persistence | It has a web backend (localStorage), but window keys become meaningless and data is per-browser. |
| `url_launcher` | `home_screen.dart` | Open the About URL | Becomes a plain link. |
| `google_fonts` (runtime download) | `main.dart:133` | IBM Plex Serif | Works on web. On macOS, `Release.entitlements` has the app sandbox enabled but **no `com.apple.security.network.client`**, which google_fonts needs, so release macOS builds probably can't download the font (UNVERIFIED). |
| Hardcoded `'Segoe UI'` font | `style_helper.dart:105`, `home_screen.dart:87,129` | Minimalist theme text | Exists only on Windows; other platforms fall back. |
| Native time picker / search | n/a | Pure Flutter widgets, not OS dialogs | n/a |

Not used anywhere: OS notifications, clipboard, file dialogs, filesystem access beyond prefs, registry, auto-start, global hotkeys.

---

## 6. Problems and smells

### Bugs (confirmed)
1. **Jump-zone dropdown crashes on duplicate cities.** [RAN] `DropdownButton` asserts there's exactly one item per value (Flutter `dropdown.dart` line 1023 in 3.50). It's easy to hit: the defaults already include New York, so adding `America/New_York` again and selecting it in the dropdown triggers the assertion. In debug builds that's a red error screen. Release behaviour is UNVERIFIED (asserts are stripped, so it probably renders blank or wrong).
2. **Same crash when you delete the city currently selected for Jump.** `jumpZoneId` isn't reset in `removeCity`. [RAN]
3. **DST off-by-one-hour in Jump** across a target or local DST change. [RAN] §3.6
4. **"Today" instead of "Tomorrow"** on local spring-forward days. [RAN] §3.5
5. **Stale tz database** (2024a). Paraguay is wrong, newer zones are missing. [RAN] §3.2
6. **Corrupt prefs leave an empty city list**, with no fallback to defaults. [RAN] §4.3
7. **`ClockProvider` never cancels its timer.** There's no `dispose()`; the analyzer flags `_timer` as unused, and every widget test fails with "A Timer is still pending". [RAN]
8. **Opacity is applied twice** in Glass. The slider sets native `windowManager.setOpacity(v)` (fading the whole window, text included) **and** sets the background alpha to `v` (`home_screen.dart:47`), so at 20% the content is nearly invisible. [READ]
9. **Minimalist theme loses forced opacity after restart.** `setTheme(neumorphic)` forces opacity 1.0, but `_loadSettings` always re-applies the saved Glass slider value regardless of theme (`settings_provider.dart:36`). [READ]
10. **The acrylic effect is mostly hidden.** The window effect is a dark tint (`0xCC222222`), but `HomeScreen` paints an opaque light `#F0F4F8` layer at 95% on top. (Visual effect UNVERIFIED.)
11. **The IBM Plex Serif override probably never applies.** `StyleHelper.getThemeTextStyle` and `home_screen.dart:99` set `fontFamily: 'IBM Plex Serif'`, but google_fonts registers families as `IBMPlexSerif_<variant>` (`google_fonts_family_with_variant.dart:30`). Text with the explicit family therefore falls back to Georgia or Times unless the font is installed on the OS. [READ the package source; visual result UNVERIFIED.]
12. **"My Local Time" can't be restored after deletion.** [READ]
13. **Zone search misses city names with spaces** ("new york") and has no aliases. [RAN]
14. **No guard on restored window position.** If the monitor that held the window is disconnected, the window can reopen off-screen. Combined with hide-to-tray, it can look like the app never opened. [READ; scenario UNVERIFIED]

### Half-finished or dead
- `ClockProvider._currentTime` is written every second and never read (analyzer warning).
- `SystemTrayManager.remove()` is never called.
- `intl` dependency is unused.
- `android/` and `ios/` scaffolding is unused and would crash at startup.
- README roadmap lists Tray and Settings as not done; CHANGELOG says both shipped in "v1.2 Beta". The docs disagree with each other.
- The Settings dialog is always glass-styled, and the `TimeControls` bar is always plain white, in both themes. The Minimalist theme wasn't carried through.
- The theme is called `neumorphic` in code, "Minimalist" in the UI and `isMinimalist` in `home_screen.dart`. The last commits (`b8f2cc9 WIP`, `a095275`) are an in-progress theming pass.

### Hardcoded values
- The 06:00–18:00 night window, 12-hour format and default cities.
- Window size 500×800 and minimum 400×600.
- The About URL.
- Every colour (dozens of hex literals in `style_helper.dart`, `home_screen.dart`, `clock_card.dart` and `settings_screen.dart`), bypassing `ThemeData`.
- Bundle IDs `com.example.meridian` and macOS copyright "© 2025 com.example" (`macos/Runner/Configs/AppInfo.xcconfig`).

### Missing error handling
- `jsonDecode` (§4.3).
- `tz.getLocation` on stored IDs.
- `_launchAboutUrl` throws.
- No awaited error handling on any `windowManager` call.
- Fire-and-forget `_saveData()` futures.

### Performance
- The whole home screen rebuilds every second.
- Four preference writes per window move or resize event.

### Signs of unreviewed generated code
- Chatty marker comments: `// <--- CRITICAL` (`main.dart:140`), `// <--- We use this now!` (`clock_card.dart:28`), `// FIX: Restore Night Logic…`, `// [MINIMALIST] (Unchanged)`, `// --- 4. FAB DECORATION (Unchanged) ---`.
- Section numbering that jumps from 4 to 6 in `style_helper.dart`.
- A duplicated `// Time Color Logic // Inside ClockCard build method:` comment (`clock_card.dart:34-37`).
- The `"safeLocalTarget"` round-trip in `time_controls.dart:77`, which does nothing useful.
- A stringly-typed `Map<String, dynamic>` return from `getCityData`, with status strings `"warning"` and `"error"` used as colour codes.
- The CI comment about `--no-codesign`.
- The template test left untouched.
- README and website feature claims that the code doesn't implement (date jumps, "who's awake", "native IANA database").

### Security
- Small attack surface. No secrets, accounts or user-generated content beyond city names, and no inbound network.
- Outbound network: Google Fonts at runtime (a privacy and offline concern) and one hardcoded About URL.
- `DebugProfile.entitlements` has `network.server`, which is the Flutter template default for debugging and harmless.
- Distributed binaries are unsigned and un-notarised; the website tells macOS users to right-click → Open. That's a trust and distribution issue rather than a code flaw.

---

## 7. Tests

- **One test file:** `test/widget_test.dart`. It's the unmodified `flutter create` counter template. It pumps `const MyApp()`, which doesn't exist (the app class is `MeridianApp`), and looks for a counter the app doesn't have.
- **Result: fails to compile.** `Error: Couldn't find constructor 'MyApp'` (Flutter 3.50.0). **[RAN]**
- **Coverage: zero.** Nothing tests time math, persistence or widgets. CI doesn't run tests.
- Even a correct widget test touching `ClockProvider` would fail on the leaked periodic timer (bug 7). [RAN]
- `ios/RunnerTests` and `macos/RunnerTests` are empty native templates.
- `flutter analyze`: **38 issues** (1 error, 2 warnings, 35 infos). [RAN]
  - The error is the broken test.
  - The warnings are the unused `_currentTime` and `_timer` fields.
  - 31 of the infos are deprecations:
    - `package:flutter/material.dart` (×10 files)
    - `Color.withOpacity` (×17)
    - `ColorScheme.background` (`main.dart:138`)
    - `ReorderableListView.onReorder` (`home_screen.dart:171`)
    - `SwitchListTile.activeColor` (`settings_screen.dart:197`)
  - The other 4 infos are style lints.

---

## 8. Keep, drop, or rethink

Opinions, not a plan.

### Keep (the concept, ported faithfully)
- **The core interaction.** A personal list of places, each showing its local time, plus "pick a time in *one* place and see it everywhere." This is the real product, and it's simple and useful.
- **Instant-based conversion** (one absolute instant, rendered per zone). It's the right model and it handles fractional offsets and DST correctly today.
- **IANA zone IDs as the stored identity**, plus a user-facing name. Existing data is trivially migratable as a list of `{name, id}`.
- **Glanceable cues.** The relative-day label and the day/night card treatment work at a glance. Fix the bugs and keep the idea.
- **Drag-to-reorder** and the **"Local" card that follows the device's zone**.

### Drop
- Everything about window chrome: the custom title bar, minimize/maximize/close, hide-to-tray, tray menu, always-on-top, acrylic/vibrancy, window opacity, and window-bounds persistence.
- The `android/` and `ios/` scaffolding, the template test, the dead fields and the unused `intl` dependency.
- Runtime Google Fonts fetching (self-host the font if it stays).
- `StyleHelper`'s hand-rolled per-theme colour switching. Whatever theming exists should come from one coherent system, not hex literals spread across five files.
- The marketing claims the code never backed up. Either build them or stop claiming them.

### Rethink
- **Zone search.** Searching raw IANA IDs is the weakest part of the UX. It needs real city names, countries, common aliases (Mumbai, San Francisco, PST), tolerance for spaces versus underscores, and visible UTC offsets. Legacy aliases like `US/Central` should be hidden or labelled.
- **Time-zone data freshness.** A bundled tz snapshot goes stale silently (Paraguay is already wrong). Whatever the web app uses should get rule updates without a release.
- **Jump.** It needs a date as well as a time, calendar-day arithmetic in the target zone (not `+24h`), explicit handling of nonexistent and repeated times, and probably a draggable timeline instead of a modal picker.
- **Day labels.** Compare calendar dates, not truncated 24-hour durations. Consider showing the actual date and offset.
- **Locale.** 12- versus 24-hour time should follow the user, not be forced to 12-hour.
- **Persistence.** Prefs-in-one-machine becomes per-browser storage on the web. Whether there should be accounts, sync or shareable links depends on Open questions 1 and 5.
- **Themes.** Two half-finished themes. Pick one, or build a proper light/dark pair.
- **The meeting-coordination features the brief describes** (people, working hours, overlap, suggested times) **would be new design work**. There's no existing logic to port or validate, so the rewrite should treat them as greenfield and test them heavily, especially working hours that cross midnight and DST weeks where offsets between cities change.
- **Tests.** Time math is the product, so it should have the test coverage it never had. The probe cases in the Appendix are a ready-made starting set of regression tests.

---

## Open questions

1. **Scope.** The code is a world clock with a time-preview feature, not a meeting coordinator. Should the web app (a) port what exists, (b) add the people / working-hours / overlap features from the brief, or (c) do both, porting first? Is there another repo, branch or Gemini conversation that contains meeting logic? Nothing on any local or remote branch here does.
2. **Native verification.** Do you have a Windows or macOS machine to confirm the current app still builds and launches? Alternatively, I could try a Linux build in a scratch copy, which needs `cmake`, `ninja` and GTK dev packages installed on this machine.
3. **Existing users.** Are there users with saved city lists worth migrating? A web app can't read desktop prefs, so it would need an export/import path, or you could accept a fresh start.
4. **Themes and branding.** Keep Glass, Minimalist, both, or neither? Keep the Blue Anvil branding, Ko-fi link and About page? Does the web app replace the `index.html` marketing site?
5. **Accounts and sharing.** Is the web version single-user and local-only (like today), or should lists be shareable or synced? This decides the persistence approach.
6. **Licence.** The repo is GPL-3.0. For a hosted web app, do you want to stay on GPL, move to AGPL (which covers network use), or relicense? You appear to be the sole author, so relicensing is your call.
7. **Desktop apps.** Retire them once the web app ships, or keep them alive? This affects whether fixes like the dropdown crash and DST bugs are worth backporting.

---

## Appendix: probe output (verbatim logic, `TZ=America/Chicago`, Flutter 3.50.0 / Dart 3.14.0)

```
[B] "new york" -> 0 []   "new_york" -> 1 [America/New_York]   "mumbai" -> 0   "san francisco" -> 0
    "india" -> 19 [America/Indiana/Indianapolis, ...]
[D] Tokyo card at 2026-03-08 10:00 local -> raw 2026-03-09 00:00+0900, day: Today   (expected Tomorrow)
[E] now Sat 12:00 London, pick 09:00 -> 2026-03-29 10:00+0100   (expected 09:00 BST)
    now Sat 12:00 London, pick 09:00 -> 2026-10-25 08:00+0000   (expected 09:00 GMT)
[F] Local, now 2026-03-07 12:00, pick 09:00 -> 2026-03-08 10:00 (expected 09:00)
[G] NY pick 02:30 on spring-forward day -> 03:30-0400;  NY pick 01:30 on fall-back day -> 01:30-0400
[H] now 12:00:30, pick 12:00 -> next day 12:00
Asuncion 2026-04-15 12:00Z -> 08:00-0400; 2026-07-15 -> 08:00-0400   (tzdata 2024b+: permanent -0300)
Widget tests: duplicate jump zone -> "Failed assertion: line 1023 ... 'items == null ||'";
              removing selected jump zone -> same assertion;
              corrupt saved_cities -> FormatException, cities=0;
              all three -> "A Timer is still pending even after the widget tree was disposed" (ClockProvider._startTimer)
```

The probe scripts and the repo copy were kept in a temporary session directory and weren't added to the repo.
