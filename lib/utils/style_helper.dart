import 'package:flutter/material.dart';
import 'package:meridian/providers/settings_provider.dart';

class StyleHelper {
  // --- COLORS ---
  static const Color neuBaseColor = Color(0xFFE0E5EC);
  static const Color neuTextDark = Color(0xFF3E4E5E);
  static const Color neuTextLight = Color(0xFF9EA9B6);
  static const Color nightGlassColor = Color(0x66000000);

  // Night Gradient Colors
  static const Color nightCardTopLeft = Color(0xFF2C3E50);
  static const Color nightCardBottomRight = Color(0xFF111827);

  // --- 1. CARD DECORATION ---
  static BoxDecoration getCardDecoration(AppTheme theme, {required bool isNight}) {
    if (theme == AppTheme.neumorphic) {
      // --- MINIMALIST THEME ---
      if (isNight) {
        // Night: Tactile Gradient Tile
        return BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              nightCardTopLeft,    // Light hits here
              nightCardBottomRight, // Shadow settles here
            ],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: Colors.white.withOpacity(0.15),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              offset: const Offset(4, 4),
              blurRadius: 8,
            ),
          ],
        );
      } else {
        // Day: Clay Extrusion
        return BoxDecoration(
          color: neuBaseColor,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            const BoxShadow(
                color: Colors.white,
                offset: Offset(-8, -8),
                blurRadius: 16
            ),
            BoxShadow(
                color: Colors.blueGrey.shade300,
                offset: const Offset(8, 8),
                blurRadius: 16
            ),
          ],
        );
      }
    } else {
      // --- GLASS THEME (Default) ---
      return BoxDecoration(
        color: isNight ? nightGlassColor : Colors.white.withOpacity(0.4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isNight ? Colors.white.withOpacity(0.1) : Colors.white.withOpacity(0.6),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 16,
          ),
        ],
      );
    }
  }

  // --- 2. TEXT COLORS ---
  static Color getPrimaryTextColor(AppTheme theme, {required bool isNight}) {
    if (isNight) return Colors.white;
    if (theme == AppTheme.neumorphic) return neuTextDark;
    return const Color(0xFF1E293B);
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
      // MINIMALIST: Sans-Serif
      return TextStyle(
        fontFamily: 'Segoe UI',
        fontFamilyFallback: const ['Roboto', 'Arial', 'Sans-Serif'],
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
      );
    } else {
      // GLASS: Serif
      return TextStyle(
        fontFamily: 'IBM Plex Serif',
        fontFamilyFallback: const ['Georgia', 'Times New Roman', 'Serif'],
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
      );
    }
  }

  // ... inside StyleHelper class ...

  // --- 4. FAB DECORATION ---
  static BoxDecoration getFabDecoration(AppTheme theme) {
    if (theme == AppTheme.neumorphic) {
      // MINIMALIST: Tactile "Physical Button"
      return BoxDecoration(
        color: neuBaseColor, // Matches the background
        shape: BoxShape.circle,
        boxShadow: [
          // Light Top-Left
          const BoxShadow(
            color: Colors.white,
            offset: Offset(-6, -6),
            blurRadius: 10,
          ),
          // Dark Bottom-Right
          BoxShadow(
            color: Colors.blueGrey.shade300,
            offset: const Offset(6, 6),
            blurRadius: 10,
          ),
        ],
      );
    } else {
      // GLASS: Standard Floating Orb
      return BoxDecoration(
        color: Colors.indigo, // Matches the Jump Bar
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.indigo.withOpacity(0.4),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      );
    }
  }

  // --- 5. FAB ICON COLOR ---
  static Color getFabIconColor(AppTheme theme) {
    if (theme == AppTheme.neumorphic) {
      return Colors.blueGrey.shade800; // Dark grey to look etched in
    }
    return Colors.white; // White icon on the blue orb
  }
}