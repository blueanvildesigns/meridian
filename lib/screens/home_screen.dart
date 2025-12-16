import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:meridian/providers/clock_provider.dart'; // UPDATED IMPORT
import 'package:meridian/widgets/clock_card.dart';       // UPDATED IMPORT
import 'package:meridian/widgets/time_controls.dart';    // UPDATED IMPORT
import 'package:meridian/widgets/city_search.dart';      // UPDATED IMPORT

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ClockProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF0F4F8),

      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              "Meridian", // <--- UPDATED TITLE
              style: TextStyle(
                color: Color(0xFF1E293B),
                fontWeight: FontWeight.bold,
                fontSize: 28,
              ),
            ),
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
          ],
        ),
        toolbarHeight: 80,
      ),

      body: ReorderableListView.builder(
        buildDefaultDragHandles: false,
        padding: const EdgeInsets.only(top: 10, bottom: 100),
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