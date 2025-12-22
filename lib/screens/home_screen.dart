import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:meridian/providers/clock_provider.dart';
import 'package:meridian/widgets/clock_card.dart';
import 'package:meridian/widgets/time_controls.dart';
import 'package:meridian/widgets/city_search.dart';
import 'package:meridian/widgets/window_title_bar.dart';
import 'package:url_launcher/url_launcher.dart';

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
    final provider = Provider.of<ClockProvider>(context);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF0F4F8).withOpacity(0.85),
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
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
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
        backgroundColor: Colors.indigo,
        shape: const CircleBorder(),
        child: const Icon(Icons.add, color: Colors.white, size: 30),
      ),
    );
  }
}