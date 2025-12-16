import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:meridian/providers/clock_provider.dart'; // UPDATED IMPORT
import 'package:meridian/screens/home_screen.dart';      // UPDATED IMPORT

void main() {
  tz.initializeTimeZones();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ClockProvider()),
      ],
      child: const MeridianApp(),
    ),
  );
}

class MeridianApp extends StatelessWidget {
  const MeridianApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Meridian', // <--- UPDATED TITLE
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Segoe UI',
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.indigo,
          background: const Color(0xFFF0F4F8),
        ),
      ),
      home: HomeScreen(),
    );
  }
}