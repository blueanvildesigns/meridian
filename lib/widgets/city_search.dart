import 'package:flutter/material.dart';
import 'package:timezone/timezone.dart' as tz;

class CitySearchDelegate extends SearchDelegate<String?> {
  final List<String> _zones = tz.timeZoneDatabase.locations.keys.toList();

  @override
  List<Widget>? buildActions(BuildContext context) {
    return [
      IconButton(icon: const Icon(Icons.clear), onPressed: () => query = ''),
    ];
  }

  @override
  Widget? buildLeading(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: () => close(context, null),
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    return buildSuggestions(context);
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    final suggestions = _zones.where((zone) {
      return zone.toLowerCase().contains(query.toLowerCase());
    }).toList();

    return ListView.builder(
      itemCount: suggestions.length,
      itemBuilder: (context, index) {
        final zone = suggestions[index];
        final parts = zone.split('/');
        final city = parts.last.replaceAll('_', ' ');
        final region = parts.first;

        return ListTile(
          leading: const Icon(Icons.public, color: Colors.grey),
          title: Text(city),
          subtitle: Text(region),
          onTap: () {
            close(context, zone);
          },
        );
      },
    );
  }
}