import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/clock_provider.dart';
import '../models/city.dart';

class ClockCard extends StatelessWidget {
  final City city;
  final int index;

  const ClockCard({super.key, required this.city, required this.index});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ClockProvider>(context);
    final data = provider.getCityData(city.timezoneId);

    final bool isNight = data['isNight'];

    final Color cardBg = isNight ? const Color(0xFF1F2937) : Colors.white;
    final Color textColor = isNight ? Colors.white : const Color(0xFF1E293B);
    final Color timeColor = isNight ? const Color(0xFFBFDBFE) : Colors.indigo;
    final Color dragIconColor = isNight ? Colors.grey[600]! : Colors.grey[400]!;

    Color statusColor;
    if (data['status'] == 'warning') {
      statusColor = isNight ? const Color(0xFF60A5FA) : Colors.blue[700]!;
    } else if (data['status'] == 'error') {
      statusColor = isNight ? const Color(0xFFF87171) : Colors.red[700]!;
    } else {
      statusColor = isNight ? const Color(0xFF60A5FA) : Colors.grey;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12, left: 20, right: 20),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),

        title: Text(
          city.name,
          style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: textColor
          ),
        ),
        subtitle: Text(
          data['day'],
          style: TextStyle(
            color: statusColor,
            fontWeight: (isNight || data['status'] != 'neutral')
                ? FontWeight.bold
                : FontWeight.normal,
          ),
        ),

        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              data['time'],
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.bold,
                color: timeColor,
                fontFamily: 'Segoe UI',
              ),
            ),
            const SizedBox(width: 15),
            Container(width: 1, height: 30, color: isNight ? Colors.white24 : Colors.grey[300]),

            IconButton(
              icon: const Icon(Icons.delete_outline, size: 20),
              color: isNight ? Colors.red[200] : Colors.red[300],
              onPressed: () => provider.removeCity(index),
            ),

            const SizedBox(width: 10),

            ReorderableDragStartListener(
              index: index,
              child: MouseRegion(
                cursor: SystemMouseCursors.grab,
                child: Icon(Icons.drag_handle, color: dragIconColor),
              ),
            ),
          ],
        ),
      ),
    );
  }
}