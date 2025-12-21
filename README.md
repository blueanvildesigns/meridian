# Meridian

![Meridian Banner](preview.png)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Flutter](https://img.shields.io/badge/Built%20with-Flutter-02569B.svg?logo=flutter)](https://flutter.dev)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey.svg)]()
[![Status](https://img.shields.io/badge/Status-Beta-orange.svg)]()

**Meridian** is a modern, cross-platform world clock designed for aesthetics and utility. Built with Flutter, it features a frameless "Glassmorphism" UI that blends seamlessly into your desktop environment while providing powerful time-tracking tools for remote teams.

---

## ✨ Features

* **💎 Glassmorphism UI:** A fully transparent, blurred window effect (Acrylic on Windows, Sidebar effect on macOS) that looks native and modern.
* **🌍 Live World Clock:** Track unlimited cities with real-time accuracy.
* **⏩ Jump Mode (Time Travel):** Instantly fast-forward time to see what "3:00 PM next Tuesday" looks like for your team in Tokyo, London, and New York.
* **🖱️ Frameless Design:** A custom, drag-and-drop window title bar that maximizes screen real estate.
* **💾 Auto-Save:** Remembers your window position, size, and selected cities between sessions.

## 📸 Screenshots

| Live Mode | Jump Mode |
|:---:|:---:|
| | |
| *Clean, distraction-free interface* | *Planning a meeting across 3 timezones* |

## 🚀 Getting Started

Meridian is built with **Flutter**. To build it from source, ensure you have the [Flutter SDK](https://docs.flutter.dev/get-started/install) installed.

### Prerequisites
* Flutter SDK (3.0 or higher)
* Visual Studio (for Windows C++ build tools) or Xcode (for macOS)

### Installation

1.  **Clone the repo**
    ```bash
    git clone [https://github.com/blueanvildesigns/meridian.git](https://github.com/blueanvildesigns/meridian.git)
    cd meridian
    ```

2.  **Install Dependencies**
    ```bash
    flutter pub get
    ```

3.  **Run the App**
    ```bash
    # For Windows
    flutter run -d windows

    # For macOS
    flutter run -d macos
    ```

## 🛠️ Architecture

* **State Management:** `Provider`
* **Window Handling:** `window_manager` & `flutter_acrylic`
* **Persistence:** `shared_preferences`
* **Time:** `timezone` package with native IANA database

## 🗺️ Roadmap

* [x] v1.0: Core Clock & Jump Mode
* [x] v1.1: Blue Anvil Branding & About Page
* [ ] **In Progress:** System Tray / Menu Bar support (Minimize to background)
* [ ] Settings Panel (Custom opacity & themes)

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the GNU General Public License v3.0. See `LICENSE` for more information.

## ⚒️ About Blue Anvil

**Meridian** is a project by **Blue Anvil Designs**. We build tools that bridge the gap between utility and art.

[Website](https://blueanvildesigns.github.io/meridian) • [GitHub](https://github.com/blueanvildesigns)
