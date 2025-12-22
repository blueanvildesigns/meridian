import 'package:flutter/material.dart';
import 'package:meridian/providers/settings_provider.dart';
import 'package:provider/provider.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:window_manager/window_manager.dart';
import 'package:flutter_acrylic/flutter_acrylic.dart';
import 'package:meridian/providers/clock_provider.dart';
import 'package:meridian/screens/home_screen.dart';
import 'package:meridian/managers/system_tray_manager.dart';
import 'dart:io';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await windowManager.ensureInitialized();
  await Window.initialize();
  tz.initializeTimeZones();

  final prefs = await SharedPreferences.getInstance();
  final double? width = prefs.getDouble('window_width');
  final double? height = prefs.getDouble('window_height');
  final double? x = prefs.getDouble('window_x');
  final double? y = prefs.getDouble('window_y');

  WindowOptions windowOptions = const WindowOptions(
    title: 'Meridian',
    size: Size(500, 800),
    minimumSize: Size(400, 600),
    center: true,
    skipTaskbar: false,
    titleBarStyle: TitleBarStyle.hidden,
    backgroundColor: Colors.transparent,
  );

  windowManager.waitUntilReadyToShow(windowOptions, () async {
    if (width != null && height != null) {
      await windowManager.setSize(Size(width, height));
    }

    if (x != null && y != null) {
      await windowManager.setPosition(Offset(x, y));
    } else {
      await windowManager.center();
    }

    await windowManager.show();
    await windowManager.focus();

    await SystemTrayManager().init();
    await windowManager.setPreventClose(true);

    if (Platform.isWindows) {
      await Window.setEffect(
        effect: WindowEffect.acrylic,
        color: const Color(0xCC222222),
      );
    } else if (Platform.isMacOS) {
      await Window.setEffect(
        effect: WindowEffect.sidebar,
        color: Colors.transparent,
      );
    }
    // 0xCC = ~80% opacity. 222222 = Dark Tint.
  });

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ClockProvider()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
      ],
      child: const MeridianApp(),
    ),
  );
}

class MeridianApp extends StatefulWidget {
  const MeridianApp({super.key});

  @override
  State<MeridianApp> createState() => _MeridianAppState();
}

class _MeridianAppState extends State<MeridianApp> with WindowListener {

  @override
  void initState() {
    super.initState();
    windowManager.addListener(this);
  }

  @override
  void dispose() {
    windowManager.removeListener(this);
    super.dispose();
  }

  Future<void> _saveWindowState() async {
    final prefs = await SharedPreferences.getInstance();
    final bounds = await windowManager.getBounds();
    await prefs.setDouble('window_x', bounds.topLeft.dx);
    await prefs.setDouble('window_y', bounds.topLeft.dy);
    await prefs.setDouble('window_width', bounds.size.width);
    await prefs.setDouble('window_height', bounds.size.height);
  }

  @override
  void onWindowMoved() {
    _saveWindowState();
  }

  @override
  void onWindowResized() {
    _saveWindowState();
  }

  @override
  void onWindowClose() async {
    bool isPreventClose = await windowManager.isPreventClose();
    if (isPreventClose) {
      await windowManager.hide();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Meridian',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        textTheme: GoogleFonts.ibmPlexSerifTextTheme(
          Theme.of(context).textTheme,
        ),
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.indigo,
          background: Colors.transparent,
        ),
        scaffoldBackgroundColor: Colors.transparent, // <--- CRITICAL
      ),
      home: const HomeScreen(),
    );
  }
}