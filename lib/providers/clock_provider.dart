import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/city.dart';

class ClockProvider with ChangeNotifier {
  List<City> _cities = [];

  DateTime _currentTime = DateTime.now();
  DateTime? _customTime;
  Timer? _timer;

  String _jumpZoneId = 'Local';

  List<City> get cities => _cities;
  bool get isLive => _customTime == null;
  String get jumpZoneId => _jumpZoneId;

  ClockProvider() {
    _loadData();
    _startTimer();
  }

  void setJumpZone(String zoneId) {
    _jumpZoneId = zoneId;
    notifyListeners();
  }

  void setCustomTime(DateTime? time) {
    _customTime = time;
    notifyListeners();
  }

  // --- CORE LOGIC ---
  Map<String, dynamic> getCityData(String timezoneId) {
    final DateTime referenceLocal = _customTime ?? DateTime.now();
    DateTime targetTime;

    if (timezoneId == 'Local') {
      targetTime = referenceLocal;
    } else {
      final location = tz.getLocation(timezoneId);
      targetTime = tz.TZDateTime.from(referenceLocal, location);
    }

    final hour = targetTime.hour;
    final minute = targetTime.minute.toString().padLeft(2, '0');
    final period = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
    final timeStr = "$displayHour:$minute $period";

    // Compare against REALITY
    final DateTime realNow = DateTime.now();
    final targetDate = DateTime(targetTime.year, targetTime.month, targetTime.day);
    final realDate = DateTime(realNow.year, realNow.month, realNow.day);

    final diff = targetDate.difference(realDate).inDays;

    String dayStr = "Today";
    String status = "neutral";

    if (diff == 1) {
      dayStr = "Tomorrow";
      status = "warning";
    } else if (diff > 1) {
      dayStr = "+$diff Days";
      status = "warning";
    } else if (diff == -1) {
      dayStr = "Yesterday";
      status = "error";
    } else if (diff < -1) {
      dayStr = "$diff Days";
      status = "error";
    }

    final isNight = targetTime.hour < 6 || targetTime.hour >= 18;

    return {
      "time": timeStr,
      "day": dayStr,
      "status": status,
      "isNight": isNight,
    };
  }

  // --- PERSISTENCE ---
  Future<void> _loadData() async {
    final prefs = await SharedPreferences.getInstance();
    final String? data = prefs.getString('saved_cities');

    if (data != null) {
      final List<dynamic> decoded = jsonDecode(data);
      _cities = decoded.map((item) => City(
          name: item['name'],
          timezoneId: item['id']
      )).toList();
    } else {
      _cities = [
        City(name: 'My Local Time', timezoneId: 'Local'),
        City(name: 'New York', timezoneId: 'America/New_York'),
        City(name: 'London', timezoneId: 'Europe/London'),
        City(name: 'Tokyo', timezoneId: 'Asia/Tokyo'),
      ];
    }
    notifyListeners();
  }

  Future<void> _saveData() async {
    final prefs = await SharedPreferences.getInstance();
    final String data = jsonEncode(_cities.map((c) => {
      'name': c.name,
      'id': c.timezoneId
    }).toList());
    await prefs.setString('saved_cities', data);
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (isLive) {
        _currentTime = DateTime.now();
        notifyListeners();
      }
    });
  }

  void addCity(String name, String timezoneId) {
    _cities.add(City(name: name, timezoneId: timezoneId));
    _saveData();
    notifyListeners();
  }

  void removeCity(int index) {
    _cities.removeAt(index);
    _saveData();
    notifyListeners();
  }

  void reorderCity(int oldIndex, int newIndex) {
    if (newIndex > oldIndex) newIndex -= 1;
    final item = _cities.removeAt(oldIndex);
    _cities.insert(newIndex, item);
    _saveData();
    notifyListeners();
  }
}