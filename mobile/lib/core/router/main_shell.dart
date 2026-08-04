import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../widgets/app_drawer.dart';

/// Lets any screen inside the shell open the shared drawer via
/// `mainShellScaffoldKey.currentState?.openDrawer()`, since the Drawer lives
/// on this outer Scaffold while each tab renders its own inner Scaffold (for
/// its own AppBar title/actions) — a GlobalKey is the simplest bridge
/// between the two without threading a callback through every screen.
final GlobalKey<ScaffoldState> mainShellScaffoldKey = GlobalKey<ScaffoldState>();

/// Persistent chrome for the authenticated app: a bottom nav bar across the
/// five primary sections (Home, Roles, Users, Reports, Audit) plus a shared
/// drawer for secondary actions (theme, logout).
class MainShell extends StatelessWidget {
  const MainShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: mainShellScaffoldKey,
      drawer: const AppDrawer(),
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        key: const Key('mainBottomNav'),
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: _onDestinationSelected,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.admin_panel_settings_outlined),
            selectedIcon: Icon(Icons.admin_panel_settings),
            label: 'Roles',
          ),
          NavigationDestination(
            icon: Icon(Icons.group_outlined),
            selectedIcon: Icon(Icons.group),
            label: 'Users',
          ),
          NavigationDestination(
            icon: Icon(Icons.insert_chart_outlined),
            selectedIcon: Icon(Icons.insert_chart),
            label: 'Reports',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history),
            label: 'Audit',
          ),
        ],
      ),
    );
  }
}

/// Opens the shared drawer from a leading hamburger button. Used as the
/// `leading:` of every tab screen's own AppBar.
class DrawerMenuButton extends StatelessWidget {
  const DrawerMenuButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      key: const Key('openDrawerButton'),
      icon: const Icon(Icons.menu),
      tooltip: 'Menu',
      onPressed: () => mainShellScaffoldKey.currentState?.openDrawer(),
    );
  }
}
