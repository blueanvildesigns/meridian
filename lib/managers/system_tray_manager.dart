import 'dart:io';
import 'package:tray_manager/tray_manager.dart';
import 'package:window_manager/window_manager.dart';

class SystemTrayManager with TrayListener {
  static final SystemTrayManager _instance = SystemTrayManager._internal();
  factory SystemTrayManager() => _instance;
  SystemTrayManager._internal();

  Future<void> init() async {
    trayManager.addListener(this);

    String iconPath = Platform.isWindows
        ? 'assets/images/app_icon.ico'
        : 'assets/images/tray_icon.png';

    await trayManager.setIcon(iconPath);
    await trayManager.setToolTip('Meridian');

    Menu menu = Menu(
      items: [
        MenuItem(
          key: 'show_window',
          label: 'Show Meridian',
        ),
        MenuItem.separator(),
        MenuItem(
          key: 'exit_app',
          label: 'Quit',
        ),
      ],
    );

    await trayManager.setContextMenu(menu);
  }

  void remove() {
    trayManager.removeListener(this);
    trayManager.destroy();
  }


  @override
  void onTrayIconMouseDown() {
    windowManager.show();
    windowManager.focus();
  }

  @override
  void onTrayIconRightMouseDown() {
    trayManager.popUpContextMenu();
  }

  @override
  void onTrayMenuItemClick(MenuItem menuItem) {
    if (menuItem.key == 'show_window') {
      windowManager.show();
      windowManager.focus();
    } else if (menuItem.key == 'exit_app') {
      windowManager.destroy();
      exit(0);
    }
  }
}