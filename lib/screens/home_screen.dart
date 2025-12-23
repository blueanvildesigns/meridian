import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:meridian/providers/clock_provider.dart';
import 'package:meridian/widgets/clock_card.dart';
import 'package:meridian/widgets/time_controls.dart';
import 'package:meridian/widgets/city_search.dart';
import 'package:meridian/widgets/window_title_bar.dart';
import 'package:url_launcher/url_launcher.dart';
// 1. NEW IMPORTS
import 'package:meridian/utils/style_helper.dart';
import 'package:meridian/providers/settings_provider.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  Future<void> _launchAboutUrl() async {
    final Uri url = Uri.parse('https://blueanvildesigns.github.io/meridian');
    if (!await launchUrl(url)) {
      throw Exception('Could not launch $url');
    }
  }

  @override
  Widget build(BuildContext context) {
    // Listen to both providers
    final provider = Provider.of<ClockProvider>(context);
    final settings = Provider.of<SettingsProvider>(context);

    // 2. Determine Background Color based on Theme
    // Glass: Keep your existing translucent white
    // Minimalist: Use the solid "Clay" color (neuBaseColor)
    final Color appBackgroundColor = settings.currentTheme == AppTheme.neumorphic
        ? StyleHelper.neuBaseColor
        : const Color(0xFFF0F4F8).withOpacity(0.85);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: BoxDecoration(
          color: appBackgroundColor, // Applied here
        ),
        child: Column(
          children: [
            const WindowTitleBar(),
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
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          provider.isLive ? "LIVE" : "JUMP MODE",
                          style: const TextStyle(
                            color: Color(0xFF2563EB),
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      IconButton(
                        icon: const Icon(Icons.info_outline, color: Color(0xFF64748B)),
                        tooltip: 'About Blue Anvil',
                        onPressed: _launchAboutUrl,
                        iconSize: 20,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: ReorderableListView.builder(
                buildDefaultDragHandles: false,
                padding: const EdgeInsets.only(top: 0, bottom: 100),
                itemCount: provider.cities.length,
                proxyDecorator: (child, index, animation) {
                  return Material(
                    color: Colors.transparent,
                    elevation: 0,
                    child: child,
                  );
                },
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
      bottomNavigationBar: const TimeControls(),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,

      // 3. NEW FAB IMPLEMENTATION
      floatingActionButton: GestureDetector(
        onTap: () async {
          final String? selectedZone = await showSearch<String?>(
            context: context,
            delegate: CitySearchDelegate(),
          );
          if (selectedZone != null && context.mounted) {
            final name = selectedZone.split('/').last.replaceAll('_', ' ');
            Provider.of<ClockProvider>(context, listen: false)
                .addCity(name, selectedZone);
          }
        },
        child: Container(
          height: 56,
          width: 56,
          // Decoration handles the look (Indigo Orb vs Clay Button)
          decoration: StyleHelper.getFabDecoration(settings.currentTheme),
          child: Icon(
            Icons.add,
            // Icon color handles contrast (White vs Dark Grey)
            color: StyleHelper.getFabIconColor(settings.currentTheme),
            size: 30,
          ),
        ),
      ),
    );
  }
}