import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:meridian/providers/clock_provider.dart';
import 'package:meridian/widgets/clock_card.dart';
import 'package:meridian/widgets/time_controls.dart';
import 'package:meridian/widgets/city_search.dart';
import 'package:meridian/widgets/window_title_bar.dart';
import 'package:url_launcher/url_launcher.dart';
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

  // Helper to trigger the Add City Search
  Future<void> _showAddCitySearch(BuildContext context) async {
    final String? selectedZone = await showSearch<String?>(
      context: context,
      delegate: CitySearchDelegate(),
    );
    if (selectedZone != null && context.mounted) {
      final name = selectedZone.split('/').last.replaceAll('_', ' ');
      Provider.of<ClockProvider>(context, listen: false)
          .addCity(name, selectedZone);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ClockProvider>(context);
    final settings = Provider.of<SettingsProvider>(context);

    // Check if we are in Minimalist Mode
    final bool isMinimalist = settings.currentTheme == AppTheme.neumorphic;

    // Determine Background Color
    final Color appBackgroundColor = isMinimalist
        ? StyleHelper.neuBaseColor
    // FIX: Glass background uses the user-controlled opacity slider
        : const Color(0xFFF0F4F8).withOpacity(settings.windowOpacity);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // --- LAYER 1: BACKGROUND ---
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                color: appBackgroundColor,
              ),
            ),
          ),

          // --- LAYER 2: CONTENT ---
          Column(
            children: [
              const WindowTitleBar(),

              // --- HEADER SECTION ---
              Container(
                padding: const EdgeInsets.fromLTRB(24, 10, 24, 20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // LEFT SIDE: TITLE (Dynamic)
                    Row(
                      children: [
                        if (isMinimalist)
                        // MINIMALIST: Neumorphic Box Title
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            decoration: StyleHelper.getNeumorphicHeaderDecoration(),
                            child: const Text(
                              "World Clock",
                              style: TextStyle(
                                color: Color(0xFF3E4E5E), // Dark Grey
                                fontWeight: FontWeight.bold,
                                fontSize: 20,
                                fontFamily: 'Segoe UI', // Sans Serif
                              ),
                            ),
                          )
                        else
                        // GLASS: Standard Text Title
                          const Text(
                            "World Clock",
                            style: TextStyle(
                                color: Color(0xFF1E293B),
                                fontWeight: FontWeight.bold,
                                fontSize: 28,
                                fontFamily: 'IBM Plex Serif',
                                shadows: [
                                  Shadow(
                                    offset: Offset(0, 1),
                                    blurRadius: 2,
                                    color: Colors.white, // White Glow
                                  ),
                                ]
                            ),
                          ),

                        const SizedBox(width: 16),

                        // MINIMALIST ONLY: "Add City" Button in Header
                        if (isMinimalist)
                          GestureDetector(
                            onTap: () => _showAddCitySearch(context),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              decoration: StyleHelper.getNeumorphicHeaderDecoration(),
                              child: Row(
                                children: const [
                                  Icon(Icons.add, size: 18, color: Color(0xFF3E4E5E)),
                                  SizedBox(width: 8),
                                  Text(
                                    "Add City",
                                    style: TextStyle(
                                      color: Color(0xFF3E4E5E),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      fontFamily: 'Segoe UI',
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),

                    // RIGHT SIDE: Info Icon
                    IconButton(
                      icon: const Icon(Icons.info_outline, color: Color(0xFF64748B)),
                      tooltip: 'About Blue Anvil',
                      onPressed: _launchAboutUrl,
                      iconSize: 20,
                    ),
                  ],
                ),
              ),

              // --- LIST CONTENT ---
              Expanded(
                child: ReorderableListView.builder(
                  buildDefaultDragHandles: false,
                  // Adjust padding: Minimalist doesn't need huge bottom padding anymore
                  // because the FAB is gone! Glass still needs it.
                  padding: EdgeInsets.only(top: 0, bottom: isMinimalist ? 100 : 120),
                  itemCount: provider.cities.length,
                  proxyDecorator: (child, index, animation) {
                    final city = provider.cities[index];
                    return Material(
                      color: Colors.transparent,
                      elevation: 0,
                      child: ClockCard(
                        key: ValueKey(city),
                        city: city,
                        index: index,
                        isDragging: true, // Trigger Clean Lift effect
                      ),
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

          // --- LAYER 3: FAB (GLASS ONLY) ---
          if (!isMinimalist)
            Positioned(
              bottom: 110,
              right: 25,
              child: GestureDetector(
                onTap: () => _showAddCitySearch(context),
                child: Container(
                  height: 56,
                  width: 56,
                  decoration: StyleHelper.getFabDecoration(settings.currentTheme),
                  child: Icon(
                    Icons.add,
                    color: StyleHelper.getFabIconColor(settings.currentTheme),
                    size: 30,
                  ),
                ),
              ),
            ),

          // --- LAYER 4: TIME CONTROLS ---
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: TimeControls(),
          ),
        ],
      ),
    );
  }
}