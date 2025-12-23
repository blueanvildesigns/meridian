import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/clock_provider.dart';
import '../models/city.dart';
import '../utils/style_helper.dart';
import '../providers/settings_provider.dart';

class ClockCard extends StatelessWidget {
  final City city;
  final int index;

  const ClockCard({super.key, required this.city, required this.index});

  @override
  Widget build(BuildContext context) {
    // 1. Listen to Providers
    final clockProvider = Provider.of<ClockProvider>(context);
    final settings = Provider.of<SettingsProvider>(context);

    final data = clockProvider.getCityData(city.timezoneId);
    final AppTheme currentTheme = settings.currentTheme;
    final bool isNight = data['isNight']; // <--- We use this now!

    // 2. Logic: Determine Colors
    Color baseTextColor = StyleHelper.getPrimaryTextColor(currentTheme, isNight: isNight);
    Color secondaryTextColor = StyleHelper.getSecondaryTextColor(currentTheme, isNight: isNight);

    // Time Color Logic
    Color timeColor;
    if (isNight) {
      // Night: Light Blue for contrast
      timeColor = const Color(0xFFBFDBFE);
    } else {
      // Day: Dark for Neumorphic, Indigo for Glass
      timeColor = currentTheme == AppTheme.neumorphic
          ? Colors.blueGrey.shade900
          : Colors.indigo;
    }

    // Status Color Logic
    Color statusColor;
    if (data['status'] == 'warning') {
      statusColor = isNight ? Colors.orangeAccent : Colors.deepOrange;
    } else if (data['status'] == 'error') {
      statusColor = Colors.redAccent;
    } else {
      statusColor = secondaryTextColor;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 20, left: 20, right: 20),

      // 3. APPLY DECORATION (Passing isNight)
      decoration: StyleHelper.getCardDecoration(currentTheme, isNight: isNight),

      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),

        // CITY NAME (With Dynamic Font)
        title: Text(
          city.name,
          style: StyleHelper.getThemeTextStyle(
            currentTheme,
            fontSize: 22, // Bumped up slightly for Serif readability
            fontWeight: FontWeight.bold,
            color: baseTextColor,
          ),
        ),

        // DAY / STATUS
        subtitle: Text(
          data['day'],
          style: StyleHelper.getThemeTextStyle(
            currentTheme,
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: statusColor,
          ),
        ),

        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // TIME DISPLAY (With Dynamic Font)
            Text(
              data['time'],
              style: StyleHelper.getThemeTextStyle(
                currentTheme,
                fontSize: 26,
                fontWeight: FontWeight.bold,
                color: timeColor,
              ),
            ),

            const SizedBox(width: 15),

            // DIVIDER
            Container(
              width: 1,
              height: 30,
              color: isNight ? Colors.white24 : Colors.grey[400],
            ),

            // DELETE BUTTON
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 20),
              color: isNight ? Colors.white54 : Colors.red[300],
              onPressed: () => clockProvider.removeCity(index),
            ),

            const SizedBox(width: 10),

            // DRAG HANDLE
            ReorderableDragStartListener(
              index: index,
              child: MouseRegion(
                cursor: SystemMouseCursors.grab,
                child: Icon(
                  Icons.drag_handle,
                  color: baseTextColor.withOpacity(0.5),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}