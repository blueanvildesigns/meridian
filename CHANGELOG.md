# Changelog

All notable changes to the **Meridian** project will be documented in this file.

---

## [Unreleased / v1.2 Beta] - 2025-12-21

### ✨ New Features
* **Settings Panel:** Added a new glassmorphic settings dialog (accessible via the gear icon in the title bar).
* **Visual Customization:** Users can now adjust **Window Opacity** via a slider (20% - 100%).
* **"Always on Top" Mode:** Added a toggle to keep the clock floating above all other windows.
* **System Tray Support:**
    * App now minimizes to the System Tray (Windows) or Menu Bar (macOS) instead of exiting.
    * Added a context menu to the tray icon with "Show" and "Quit" options.
    * Added persistent background execution logic.

### 🛠 Improvements
* **State Persistence:** Settings (Opacity, Always on Top) are now saved automatically and restored on launch using `shared_preferences`.
* **Architecture:** Refactored state management to use `MultiProvider`, separating Clock logic from Settings logic.

---

## [v1.1.0] - 2025-12-20

### 🚀 Branding & SEO
* **Blue Anvil Integration:** Added the official Blue Anvil logo and branding to the website footer.
* **About Page:** Integrated an "Info" button in the app header that links to the project website.
* **Social Previews:** Added Open Graph and Twitter Card tags to the website. Links shared on Discord, Twitter, and LinkedIn now unfurl with a rich preview image (`preview.png`).

### 🐛 Fixes
* **Refactor:** Cleaned up `WindowTitleBar` logic to separate drag zones from button controls.
* **Tooltip:** Fixed text encoding issues ("Mojibake") in the System Tray tooltip.

---

## [v1.0.0] - 2025-12-05
* Initial Release.
* Glassmorphism UI.
* Live World Clock & Jump Mode.