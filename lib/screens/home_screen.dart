import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:meridian/providers/clock_provider.dart';
import 'package:meridian/widgets/clock_card.dart';
import 'package:meridian/widgets/time_controls.dart';
import 'package:meridian/widgets/city_search.dart';
import 'package:meridian/widgets/window_title_bar.dart'; // Ensure this file exists from previous step

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ClockProvider>(context);

    return Scaffold(
      // 1. Make Scaffold Transparent so the Acrylic effect shows through
      backgroundColor: Colors.transparent,

      // 2. Add a Tint Layer
      // This container sits on top of the blur. We give it 85% opacity
      // so the text remains legible regardless of your desktop wallpaper.
      body: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF0F4F8).withOpacity(0.85),
        ),
        child: Column(
          children: [
            // --- A. CUSTOM WINDOW TITLE BAR ---
            // Handles dragging, minimizing, closing, etc.
            const WindowTitleBar(),

            // --- B. APP HEADER ---
            // Since we removed the standard AppBar, we rebuild the header here.
            Container(
              padding: const EdgeInsets.fromLTRB(24, 10, 24, 20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "World Clock",
                    style: TextStyle(
                      color: const Color(0xFF1E293B),
                      fontWeight: FontWeight.bold,
                      fontSize: 28,
                      // Note: Your global IBM Plex Serif theme applies here automatically
                    ),
                  ),
                  // Live/Jump Mode Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF), // Light Blue
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      provider.isLive ? "LIVE" : "JUMP MODE",
                      style: const TextStyle(
                        color: Color(0xFF2563EB), // Blue 600
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // --- C. SCROLLABLE LIST ---
            // Expanded takes up all remaining vertical space
            Expanded(
              child: ReorderableListView.builder(
                buildDefaultDragHandles: false, // We use our own drag handles
                padding: const EdgeInsets.only(top: 0, bottom: 100), // Space for FAB
                itemCount: provider.cities.length,
                onReorder: (oldIndex, newIndex) {
                  provider.reorderCity(oldIndex, newIndex);
                },
                itemBuilder: (context, index) {
                  final city = provider.cities[index];
                  return ClockCard(
                      key: ValueKey(city),
                      city: city,
                      index: index
                  );
                },
              ),
            ),
          ],
        ),
      ),

      // --- D. BOTTOM CONTROLS ---
      bottomNavigationBar: const TimeControls(),

      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,

      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          // Open the Search Screen
          final String? selectedZone = await showSearch<String?>(
            context: context,
            delegate: CitySearchDelegate(),
          );

          // If a city was picked, add it to the provider
          if (selectedZone != null && context.mounted) {
            final name = selectedZone.split('/').last.replaceAll('_', ' ');
            Provider.of<ClockProvider>(context, listen: false)
                .addCity(name, selectedZone);
          }
        },
        backgroundColor: Colors.indigo,
        shape: const CircleBorder(),
        child: const Icon(Icons.add, color: Colors.white, size: 30),
      ),
    );
  }
}