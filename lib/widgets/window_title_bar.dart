import 'package:flutter/material.dart';
import 'package:window_manager/window_manager.dart';

class WindowTitleBar extends StatelessWidget {
  const WindowTitleBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      color: Colors.transparent, // Keep transparent for the glass look
      child: Row(
        children: [
          // 1. DRAGGABLE AREA
          Expanded(
            child: DragToMoveArea(
              child: Container(
                color: Colors.transparent, // Capture clicks/drags
                padding: const EdgeInsets.only(left: 16),
                alignment: Alignment.centerLeft,
                child: Text(
                  "Meridian",
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF1E293B), // Dark text for contrast
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),

          // 2. WINDOW CONTROLS
          _WindowButton(
            icon: Icons.remove,
            onPressed: () => windowManager.minimize(),
          ),
          // Maximize button (Optional)
          _WindowButton(
            icon: Icons.crop_square,
            onPressed: () async {
              if (await windowManager.isMaximized()) {
                windowManager.unmaximize();
              } else {
                windowManager.maximize();
              }
            },
          ),
          _WindowButton(
            icon: Icons.close,
            isClose: true,
            onPressed: () => windowManager.close(),
          ),
        ],
      ),
    );
  }
}

// --- HELPER CLASS ---
class _WindowButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  final bool isClose;

  const _WindowButton({
    required this.icon,
    required this.onPressed,
    this.isClose = false,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        hoverColor: isClose ? Colors.red : Colors.grey.withOpacity(0.2),
        child: SizedBox(
          width: 46,
          height: 40,
          child: Icon(
            icon,
            size: 16,
            // Use dark icons since your background is light/glass
            color: const Color(0xFF1E293B),
          ),
        ),
      ),
    );
  }
}