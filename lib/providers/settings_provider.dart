import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:window_manager/window_manager.dart';

enum AppTheme {
  glass,
  neumorphic,
}

class SettingsProvider extends ChangeNotifier {
  double _windowOpacity = 0.95;
  bool _alwaysOnTop = false;
  AppTheme _currentTheme = AppTheme.glass;

  double get windowOpacity => _windowOpacity;
  bool get alwaysOnTop => _alwaysOnTop;
  AppTheme get currentTheme => _currentTheme;

  SettingsProvider() {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();

    _windowOpacity = prefs.getDouble('windowOpacity') ?? 0.95;
    _alwaysOnTop = prefs.getBool('alwaysOnTop') ?? false;

    int themeIndex = prefs.getInt('appTheme') ?? 0;
    if (themeIndex >= 0 && themeIndex < AppTheme.values.length) {
      _currentTheme = AppTheme.values[themeIndex];
    } else {
      _currentTheme = AppTheme.glass;
    }

    await windowManager.setOpacity(_windowOpacity);
    await windowManager.setAlwaysOnTop(_alwaysOnTop);

    if (_currentTheme == AppTheme.neumorphic) {
      await windowManager.setBackgroundColor(const Color(0xFFE0E5EC));
    } else {
      await windowManager.setBackgroundColor(Colors.transparent);
    }

    notifyListeners();
  }

  Future<void> setWindowOpacity(double value) async {
    _windowOpacity = value;
    await windowManager.setOpacity(value);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('windowOpacity', value);

    notifyListeners();
  }

  Future<void> setAlwaysOnTop(bool value) async {
    _alwaysOnTop = value;
    await windowManager.setAlwaysOnTop(value);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('alwaysOnTop', value);

    notifyListeners();
  }

  Future<void> setTheme(AppTheme theme) async {
    _currentTheme = theme;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('appTheme', theme.index);

    if (theme == AppTheme.neumorphic) {
      await windowManager.setBackgroundColor(const Color(0xFFE0E5EC));
      await windowManager.setOpacity(1.0);
    } else {
      await windowManager.setBackgroundColor(Colors.transparent);
      await windowManager.setOpacity(_windowOpacity);
    }

    notifyListeners();
  }
}