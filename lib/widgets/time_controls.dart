import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:timezone/timezone.dart' as tz;
import '../providers/clock_provider.dart';

class TimeControls extends StatelessWidget {
  const TimeControls({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<ClockProvider>(context);

    String _getZoneName(String zoneId) {
      if (zoneId == 'Local') return 'My Local Time';
      return zoneId.split('/').last.replaceAll('_', ' ');
    }

    Future<void> _pickTime() async {
      final String targetZoneId = provider.jumpZoneId;
      final DateTime nowLocal = DateTime.now();

      TimeOfDay initialTime;
      if (targetZoneId == 'Local') {
        initialTime = TimeOfDay.fromDateTime(nowLocal);
      } else {
        final location = tz.getLocation(targetZoneId);
        final targetNow = tz.TZDateTime.from(nowLocal, location);
        initialTime = TimeOfDay.fromDateTime(targetNow);
      }

      final String headerText = targetZoneId == 'Local'
          ? "SELECT LOCAL TIME"
          : "SELECT ${_getZoneName(targetZoneId).toUpperCase()} TIME";

      final TimeOfDay? picked = await showTimePicker(
        context: context,
        initialTime: initialTime,
        helpText: headerText,
        initialEntryMode: TimePickerEntryMode.input,
        builder: (context, child) {
          return MediaQuery(
            data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: false),
            child: child!,
          );
        },
      );

      if (picked != null) {
        DateTime rawResult;

        if (targetZoneId == 'Local') {
          DateTime pickedDateTime = DateTime(
              nowLocal.year, nowLocal.month, nowLocal.day,
              picked.hour, picked.minute
          );
          if (pickedDateTime.isBefore(nowLocal)) {
            pickedDateTime = pickedDateTime.add(const Duration(days: 1));
          }
          rawResult = pickedDateTime;

        } else {
          final location = tz.getLocation(targetZoneId);
          final tz.TZDateTime targetNow = tz.TZDateTime.from(nowLocal, location);

          tz.TZDateTime pickedTarget = tz.TZDateTime(
              location,
              targetNow.year, targetNow.month, targetNow.day,
              picked.hour, picked.minute
          );

          if (pickedTarget.isBefore(targetNow)) {
            pickedTarget = pickedTarget.add(const Duration(days: 1));
          }
          rawResult = pickedTarget;
        }

        final DateTime safeLocalTarget = DateTime.fromMillisecondsSinceEpoch(
            rawResult.millisecondsSinceEpoch,
            isUtc: false
        );

        provider.setCustomTime(safeLocalTarget);
      }
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey[200]!)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.grey[100],
                  borderRadius: BorderRadius.circular(12),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: provider.jumpZoneId,
                    icon: const Icon(Icons.arrow_drop_down, color: Colors.indigo),
                    items: [
                      const DropdownMenuItem(
                        value: 'Local',
                        child: Text("My Local Time", style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                      ...provider.cities
                          .where((city) => city.timezoneId != 'Local')
                          .map((city) {
                        return DropdownMenuItem(
                          value: city.timezoneId,
                          child: Text(city.name),
                        );
                      }).toList(),
                    ],
                    onChanged: (String? newValue) {
                      if (newValue != null) {
                        provider.setJumpZone(newValue);
                      }
                    },
                  ),
                ),
              ),

              const SizedBox(width: 10),

              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _pickTime,
                  icon: const Icon(Icons.access_time_filled, color: Colors.white),
                  label: const Text("Jump", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.indigo,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                ),
              ),

              if (!provider.isLive) ...[
                const SizedBox(width: 10),
                IconButton(
                  onPressed: () => provider.setCustomTime(null),
                  icon: const Icon(Icons.restore, color: Colors.red),
                  tooltip: "Reset to Live",
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.red[50],
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.all(12),
                  ),
                ),
              ]
            ],
          ),
        ],
      ),
    );
  }
}