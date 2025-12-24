import 'package:flutter/material.dart';
import 'package:meridian/providers/settings_provider.dart';

class StyleHelper {
  // --- COLORS ---
  static const Color neuBaseColor = Color(0xFFE0E5EC);
  static const Color neuTextDark = Color(0xFF3E4E5E);
  static const Color neuTextLight = Color(0xFF9EA9B6);

  // High Opacity Colors for Glass Mode (readability fixes)
  static final Color glassDayColor = Colors.white.withOpacity(0.95);
  static final Color glassNightColor = Colors.black.withOpacity(0.85); // Dark but visible

  static const Color nightCardTopLeft = Color(0xFF2C3E50);
  static const Color nightCardBottomRight = Color(0xFF111827);

  // --- 1. CARD DECORATION ---
  static BoxDecoration getCardDecoration(AppTheme theme, {
    required bool isNight,
    bool isDragging = false,
  }) {
    if (theme == AppTheme.neumorphic) {
      // [MINIMALIST] (Unchanged)
      if (isNight) {
        return BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [nightCardTopLeft, nightCardBottomRight],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.15), width: 1),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              offset: isDragging ? const Offset(8, 8) : const Offset(4, 4),
              blurRadius: isDragging ? 12 : 8,
            ),
          ],
        );
      } else {
        return BoxDecoration(
          color: neuBaseColor,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            if (!isDragging)
              const BoxShadow(color: Colors.white, offset: Offset(-8, -8), blurRadius: 16),
            BoxShadow(
              color: isDragging ? Colors.black.withOpacity(0.2) : Colors.blueGrey.shade300,
              offset: isDragging ? const Offset(12, 12) : const Offset(8, 8),
              blurRadius: isDragging ? 20 : 16,
            ),
          ],
        );
      }
    } else {
      // --- [GLASS THEME] ---
      // Fix: Restore Night Logic but keep HIGH OPACITY
      return BoxDecoration(
        // Night = Dark High Opacity | Day = White High Opacity
        color: isNight ? glassNightColor : glassDayColor,

        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          // Subtle white border for night, strong white border for day
          color: isNight ? Colors.white.withOpacity(0.2) : Colors.white.withOpacity(0.6),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: isDragging ? 24 : 16,
            offset: isDragging ? const Offset(0, 8) : Offset.zero,
          ),
        ],
      );
    }
  }

  // --- 2. TEXT COLORS ---
  static Color getPrimaryTextColor(AppTheme theme, {required bool isNight}) {
    // If it's Night (in ANY theme), we need white text to read against the dark card
    if (isNight) return Colors.white;

    // Day Mode:
    if (theme == AppTheme.neumorphic) return neuTextDark;
    return const Color(0xFF1E293B); // Dark Slate for Glass Day
  }

  static Color getSecondaryTextColor(AppTheme theme, {required bool isNight}) {
    if (isNight) return Colors.white70;

    if (theme == AppTheme.neumorphic) return neuTextLight;
    return const Color(0xFF64748B);
  }

  // --- 3. DYNAMIC FONT STYLE ---
  static TextStyle getThemeTextStyle(AppTheme theme, {
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.normal,
    Color? color,
  }) {
    if (theme == AppTheme.neumorphic) {
      return TextStyle(
        fontFamily: 'Segoe UI',
        fontFamilyFallback: const ['Roboto', 'Arial', 'Sans-Serif'],
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
      );
    } else {
      return TextStyle(
        fontFamily: 'IBM Plex Serif',
        fontFamilyFallback: const ['Georgia', 'Times New Roman', 'Serif'],
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
      );
    }
  }

  // --- 4. FAB DECORATION (Unchanged) ---
  static BoxDecoration getFabDecoration(AppTheme theme) {
    if (theme == AppTheme.neumorphic) {
      return BoxDecoration(
        color: neuBaseColor,
        shape: BoxShape.circle,
        boxShadow: [
          const BoxShadow(color: Colors.white, offset: Offset(-6, -6), blurRadius: 10),
          BoxShadow(color: Colors.blueGrey.shade300, offset: const Offset(6, 6), blurRadius: 10),
        ],
      );
    } else {
      return BoxDecoration(
        color: Colors.indigo,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: Colors.indigo.withOpacity(0.4), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      );
    }
  }

  static Color getFabIconColor(AppTheme theme) {
    if (theme == AppTheme.neumorphic) return Colors.blueGrey.shade800;
    return Colors.white;
  }

  // --- 6. HEADER ELEMENT DECORATION (Unchanged) ---
  static BoxDecoration getNeumorphicHeaderDecoration() {
    return BoxDecoration(
      color: neuBaseColor,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: Colors.white.withOpacity(0.4), width: 1),
      boxShadow: [
        const BoxShadow(color: Colors.white, offset: Offset(-4, -4), blurRadius: 8),
        BoxShadow(color: Colors.blueGrey.shade300, offset: const Offset(4, 4), blurRadius: 8),
      ],
    );
  }
}