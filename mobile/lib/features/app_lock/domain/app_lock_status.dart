/// Where the app-lock feature currently stands.
///
///  - [disabled]: the user has never turned App Lock on (the default —
///    App Lock is opt-in, never forced). No lock screen is ever shown.
///  - [locked]: App Lock is on and the app either just cold-started or was
///    just resumed from background — the lock screen must be shown before
///    any authenticated content is reachable.
///  - [unlocked]: App Lock is on, and the user has proven their identity
///    (PIN or biometric) for this foreground session. Stays unlocked until
///    the app is backgrounded again — there is deliberately no idle timer.
enum AppLockStatus {
  disabled,
  locked,
  unlocked,
}

/// A user-facing app-lock error (currently only raised by
/// `AppLockController.changePin` when the supplied current PIN doesn't
/// match what's stored) — carries a ready-to-display message, same
/// convention as `features/auth/domain/auth_exception.dart`.
class AppLockException implements Exception {
  const AppLockException(this.message);

  final String message;

  @override
  String toString() => message;
}
