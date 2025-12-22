import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:meridian/providers/settings_provider.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10), // The "Frosted" effect
      child: Dialog(
        backgroundColor: Colors.transparent, // Let the blur show through
        elevation: 0,
        insetPadding: const EdgeInsets.all(20),
        child: Container(
          width: 350,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFFF0F4F8).withOpacity(0.90), // Light glass color
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
            mainAxisSize: MainAxisSize.min, // Shrink to fit content
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
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

              // Consumer listens to changes
              Consumer<SettingsProvider>(
                builder: (context, settings, child) {
                  return Column(
                    children: [
                      // 1. OPACITY SLIDER
                      const Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          "Window Opacity",
                          style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF475569)
                          ),
                        ),
                      ),
                      Slider(
                        value: settings.windowOpacity,
                        min: 0.2, // Don't let them make it invisible!
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

                      // 2. ALWAYS ON TOP
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text(
                          "Always on Top",
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF1E293B)
                          ),
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