import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/app_lock_controller.dart';

/// Drop-in wrapper for the app root (`main.dart` wraps `AnnexMobileApp` with
/// this) that re-arms App Lock on a real background/foreground cycle.
///
/// App Lock has deliberately NO idle/inactivity timer — the only trigger is
/// the app being closed/backgrounded and reopened. That maps to
/// [AppLifecycleState] transitions: this widget calls
/// `AppLockController.lock()` only when the state goes from `resumed` to
/// `paused`/`hidden`/`detached` (a real backgrounding), and explicitly
/// ignores `inactive` on its own — `inactive` also fires for transient
/// interruptions (a system dialog, the notification shade, an incoming
/// call) on some platforms, which must NOT lock the app.
///
/// The cold-start case (lock enabled + app just launched) doesn't need
/// handling here — `AppLockController.build()` already initializes to
/// `AppLockStatus.locked` whenever the persisted `appLockEnabled` flag is
/// true, before this widget's first lifecycle callback ever fires.
class AppLockLifecycleObserver extends ConsumerStatefulWidget {
  const AppLockLifecycleObserver({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<AppLockLifecycleObserver> createState() => _AppLockLifecycleObserverState();
}

class _AppLockLifecycleObserverState extends ConsumerState<AppLockLifecycleObserver>
    with WidgetsBindingObserver {
  AppLifecycleState _lastState = AppLifecycleState.resumed;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final cameFromResumed = _lastState == AppLifecycleState.resumed;
    final isRealBackgrounding = state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached;

    if (cameFromResumed && isRealBackgrounding) {
      ref.read(appLockControllerProvider.notifier).lock();
    }

    _lastState = state;
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
