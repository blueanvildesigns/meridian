import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:window_manager/window_manager.dart';

class SettingsProvider extends ChangeNotifier {
  double _windowOpacity = 0.95;
  bool _alwaysOnTop = false;

  double get windowOpacity => _windowOpacity;
  bool get alwaysOnTop => _alwaysOnTop;

  SettingsProvider() {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();

    _windowOpacity = prefs.getDouble('windowOpacity') ?? 0.95;
    _alwaysOnTop = prefs.getBool('alwaysOnTop') ?? false;

    await windowManager.setOpacity(_windowOpacity);
    await windowManager.setAlwaysOnTop(_alwaysOnTop);

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
}