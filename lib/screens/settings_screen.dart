import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:meridian/providers/settings_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
      child: Dialog(
        backgroundColor: Colors.transparent,
        elevation: 0,
        insetPadding: const EdgeInsets.all(20),
        child: Container(
          width: 350,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFFF0F4F8).withOpacity(0.90),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Colors.white.withOpacity(0.5),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // --- HEADER ---
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    "Settings",
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Color(0xFF64748B)),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const Divider(height: 30),

              // --- SETTINGS CONTENT ---
              Consumer<SettingsProvider>(
                builder: (context, settings, child) {
                  return Column(
                    children: [
                      // 1. THEME SWITCHER
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          "Visual Theme",
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF475569)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.grey[200],
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            // Glass Option
                            Expanded(
                              child: GestureDetector(
                                onTap: () => settings.setTheme(AppTheme.glass),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: settings.currentTheme == AppTheme.glass
                                        ? Colors.white
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                    boxShadow: settings.currentTheme == AppTheme.glass
                                        ? [
                                      BoxShadow(
                                          color: Colors.black.withOpacity(0.1),
                                          blurRadius: 4)
                                    ]
                                        : [],
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    "Glass",
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: settings.currentTheme == AppTheme.glass
                                          ? Colors.indigo
                                          : Colors.grey,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            // Neumorphic Option
                            Expanded(
                              child: GestureDetector(
                                onTap: () => settings.setTheme(AppTheme.neumorphic),
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: settings.currentTheme == AppTheme.neumorphic
                                        ? const Color(0xFFE0E5EC)
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                    boxShadow: settings.currentTheme == AppTheme.neumorphic
                                        ? [
                                      const BoxShadow(
                                          color: Colors.white,
                                          offset: Offset(-2, -2),
                                          blurRadius: 4),
                                      BoxShadow(
                                          color: Colors.blueGrey.shade300,
                                          offset: const Offset(2, 2),
                                          blurRadius: 4),
                                    ]
                                        : [],
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    "Minimalist",
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: settings.currentTheme == AppTheme.neumorphic
                                          ? Colors.blueGrey.shade800
                                          : Colors.grey,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // 2. OPACITY SLIDER (Conditional: Only for Glass)
                      if (settings.currentTheme == AppTheme.glass) ...[
                        const Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            "Window Opacity",
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF475569)),
                          ),
                        ),
                        Slider(
                          value: settings.windowOpacity,
                          min: 0.2,
                          max: 1.0,
                          activeColor: Colors.indigo,
                          onChanged: (value) {
                            settings.setWindowOpacity(value);
                          },
                        ),
                        Text(
                          "${(settings.windowOpacity * 100).toInt()}%",
                          style: const TextStyle(color: Colors.grey),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // 3. ALWAYS ON TOP
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text(
                          "Always on Top",
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF1E293B)),
                        ),
                        subtitle: const Text("Keep Meridian above other apps"),
                        value: settings.alwaysOnTop,
                        activeColor: Colors.indigo,
                        onChanged: (value) {
                          settings.setAlwaysOnTop(value);
                        },
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}