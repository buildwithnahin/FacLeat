import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

import '../../../core/storage/secure_storage.dart';
import '../domain/app_lock_status.dart';

class AppLockState extends Equatable {
  const AppLockState({
    this.status = AppLockStatus.disabled,
    this.failedAttempts = 0,
    this.lockedOutUntil,
  });

  final AppLockStatus status;

  /// Consecutive wrong-PIN guesses since the last successful `verifyPin`
  /// (or since `enable()`/`changePin()` reset it). Drives the brute-force
  /// lockout in `verifyPin` — see [lockedOutUntil].
  final int failedAttempts;

  /// Set once [failedAttempts] hits a lockout threshold inside `verifyPin`;
  /// `null` means no lockout is in effect. Compare against `DateTime.now()`
  /// via [isLockedOut] rather than reading this directly — it isn't cleared
  /// the instant the cooldown elapses, only recomputed against the clock.
  /// In-memory only: a cold app restart clears it, same as [failedAttempts].
  final DateTime? lockedOutUntil;

  bool get isLocked => status == AppLockStatus.locked;

  /// True while a PIN-attempt cooldown is active. `verifyPin` short-circuits
  /// to `false` (no hashing, no further attempt counted) whenever this is
  /// true, and the lock screen can read it to show a "try again in Ns"
  /// message instead of (or in addition to) "Incorrect PIN".
  bool get isLockedOut => lockedOutUntil != null && DateTime.now().isBefore(lockedOutUntil!);

  AppLockState copyWith({
    AppLockStatus? status,
    int? failedAttempts,
    DateTime? lockedOutUntil,
  }) {
    return AppLockState(
      status: status ?? this.status,
      failedAttempts: failedAttempts ?? this.failedAttempts,
      lockedOutUntil: lockedOutUntil ?? this.lockedOutUntil,
    );
  }

  @override
  List<Object?> get props => [status, failedAttempts, lockedOutUntil];
}

/// Single source of truth for the app-lock feature — an OPTIONAL PIN +
/// biometric gate the user turns on from Settings (never forced on first
/// login). Once enabled, the gate is re-armed only on a real
/// background/foreground cycle (see `AppLockLifecycleObserver`) — there is
/// no idle/inactivity timer by design.
///
/// Integration note for the router: gate authenticated routes with
/// `ref.read(appLockControllerProvider).status == AppLockStatus.locked`
/// (redirect to the lock screen when true) inside the same `redirect:`
/// callback that already checks `AuthController`'s status, and add a
/// `ref.listen<AppLockState>(appLockControllerProvider, ...)` to the
/// existing `_RouterRefreshNotifier` (mirroring how it already listens to
/// `authControllerProvider`) so the router re-evaluates when `lock()` fires.
class AppLockController extends Notifier<AppLockState> {
  /// Consecutive wrong-PIN guesses allowed before a cooldown kicks in. A
  /// 4-digit PIN (`appLockPinLength`) is only 10,000 combinations, so
  /// unlimited undelayed guessing is a real brute-force surface even though
  /// it requires physical access to the unlocked device.
  static const int _maxAttemptsBeforeLockout = 5;

  /// Flat 30-second cooldown, re-applied every time another
  /// [_maxAttemptsBeforeLockout] wrong guesses accumulate (5, 10, 15, ...).
  /// Deliberately not escalating: this is a local, physical-access-only
  /// PIN pad (see the constant-time-compare note on [_constantTimeEquals]
  /// for the same reasoning) — a flat cooldown already cuts the practical
  /// guess rate to ~2/minute, and an escalating/doubling scheme would add
  /// extra state and edge cases (persistence across restarts, cap tuning)
  /// without a proportionate benefit for this threat model.
  static const Duration _lockoutDuration = Duration(seconds: 30);

  @override
  AppLockState build() {
    // Mirrors ThemeModeController's pattern: return a safe synchronous
    // default immediately (disabled — never blocks/flashes a lock screen
    // for users who haven't opted in), then resolve the real persisted
    // state asynchronously and update. If app-lock is enabled, this flips
    // to `locked` shortly after — the router listener above picks it up.
    unawaited(_restore());
    return const AppLockState();
  }

  Future<void> _restore() async {
    final enabled = await ref.read(secureStorageProvider).getAppLockEnabled();
    state = AppLockState(status: enabled ? AppLockStatus.locked : AppLockStatus.disabled);
  }

  /// Sets up App Lock for the first time (or re-enables it after a
  /// `disable()`): hashes + stores [pin], marks the feature enabled, and
  /// unlocks immediately — the user just proved they know the PIN by
  /// setting it, so there's no reason to immediately re-lock them out.
  Future<void> enable(String pin) async {
    final storage = ref.read(secureStorageProvider);
    final salt = _generateSalt();
    final hash = _hashPin(pin, salt);
    await storage.setAppLockPin(hash: hash, salt: salt);
    await storage.setAppLockEnabled(true);
    state = const AppLockState(status: AppLockStatus.unlocked);
  }

  /// Turns App Lock off entirely: wipes the stored PIN/biometric flag and
  /// resets [state] to a fresh `AppLockState` (`disabled`, zero
  /// `failedAttempts`, no `lockedOutUntil`) — the same as a brand-new
  /// install. This is also the right call for a *real* account logout (not
  /// the lock screen's own "Log out instead" escape hatch): without it, a
  /// device left `unlocked` by one user would hand the next user who logs
  /// in on the same device an already-unlocked app until the next
  /// background/foreground cycle re-arms the lock. Call this from the
  /// logout flow, e.g. `ref.read(appLockControllerProvider.notifier).disable()`.
  Future<void> disable() async {
    await ref.read(secureStorageProvider).clearAppLock();
    state = const AppLockState(status: AppLockStatus.disabled);
  }

  /// Hashes [pin] with the stored salt and compares against the stored
  /// hash (constant-time — see [_constantTimeEquals]). On a match, unlocks,
  /// resets the failed-attempt/lockout counters, and returns true. On a
  /// mismatch (or if no PIN has been set at all), returns false and leaves
  /// [state]'s `status` untouched so the lock screen can show its
  /// shake/error feedback — but bumps `failedAttempts`, and once
  /// [_maxAttemptsBeforeLockout] consecutive misses accumulate, sets
  /// `lockedOutUntil` [_lockoutDuration] into the future.
  ///
  /// While `state.isLockedOut` is true, this returns false immediately
  /// without touching the stored hash/salt or the attempt counter at all —
  /// callers (the lock screen) should check `state.isLockedOut` /
  /// `state.lockedOutUntil` to show a "try again in Ns" message rather than
  /// a plain "Incorrect PIN" for these calls.
  Future<bool> verifyPin(String pin) async {
    if (state.isLockedOut) return false;

    final storage = ref.read(secureStorageProvider);
    final hash = await storage.getAppLockPinHash();
    final salt = await storage.getAppLockPinSalt();
    if (hash == null || salt == null) return false;

    final candidate = _hashPin(pin, salt);
    if (!_constantTimeEquals(candidate, hash)) {
      final attempts = state.failedAttempts + 1;
      final justLockedOut = attempts % _maxAttemptsBeforeLockout == 0;
      state = state.copyWith(
        failedAttempts: attempts,
        lockedOutUntil: justLockedOut ? DateTime.now().add(_lockoutDuration) : null,
      );
      return false;
    }

    state = const AppLockState(status: AppLockStatus.unlocked);
    return true;
  }

  /// Verifies [currentPin] first (constant-time — see
  /// [_constantTimeEquals]) — throwing [AppLockException] with a
  /// user-facing message if it doesn't match — then stores [newPin] as the
  /// new PIN. Also resets the `verifyPin` failed-attempt/lockout counters,
  /// same as a successful `verifyPin` would.
  Future<void> changePin(String currentPin, String newPin) async {
    final storage = ref.read(secureStorageProvider);
    final hash = await storage.getAppLockPinHash();
    final salt = await storage.getAppLockPinSalt();
    if (hash == null || salt == null || !_constantTimeEquals(_hashPin(currentPin, salt), hash)) {
      throw const AppLockException('Current PIN is incorrect');
    }

    final newSalt = _generateSalt();
    final newHash = _hashPin(newPin, newSalt);
    await storage.setAppLockPin(hash: newHash, salt: newSalt);
    state = const AppLockState(status: AppLockStatus.unlocked);
  }

  /// Attempts a biometric unlock. Returns false (never throws) whenever
  /// biometric unlock isn't enabled, isn't supported/enrolled on this
  /// device (e.g. always on web — `local_auth` has no web implementation),
  /// or the prompt fails/is cancelled — the caller always falls back to
  /// the PIN pad, biometrics are never the only way in.
  Future<bool> tryBiometricUnlock() async {
    try {
      final biometricEnabled = await ref.read(secureStorageProvider).getAppLockBiometricEnabled();
      if (!biometricEnabled) return false;

      final auth = LocalAuthentication();
      final supported = await auth.isDeviceSupported();
      final canCheck = await auth.canCheckBiometrics;
      if (!supported || !canCheck) return false;

      final didAuthenticate = await auth.authenticate(
        localizedReason: 'Unlock Annex Admin',
        options: const AuthenticationOptions(biometricOnly: true),
      );
      if (!didAuthenticate) return false;

      state = const AppLockState(status: AppLockStatus.unlocked);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// True only when: the platform supports local authentication, the
  /// device actually has a biometric enrolled, AND a PIN has already been
  /// set (biometrics are an enhancement on the PIN, never a replacement —
  /// so offering the toggle before a PIN exists would be misleading).
  Future<bool> isBiometricAvailable() async {
    try {
      final pinHash = await ref.read(secureStorageProvider).getAppLockPinHash();
      if (pinHash == null) return false;

      final auth = LocalAuthentication();
      final supported = await auth.isDeviceSupported();
      if (!supported) return false;

      final canCheck = await auth.canCheckBiometrics;
      if (!canCheck) return false;

      final enrolled = await auth.getAvailableBiometrics();
      return enrolled.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  /// Re-arms the lock. Called by `AppLockLifecycleObserver` on a real
  /// background transition. No-op unless currently `unlocked` (nothing to
  /// do if the feature is `disabled`, and re-locking an already-`locked`
  /// app is a harmless but pointless state write).
  void lock() {
    if (state.status == AppLockStatus.unlocked) {
      state = const AppLockState(status: AppLockStatus.locked);
    }
  }

  String _generateSalt() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return base64Encode(bytes);
  }

  String _hashPin(String pin, String salt) {
    return sha256.convert(utf8.encode('$salt$pin')).toString();
  }

  /// Constant-time equality check for two hex digest strings. `package:crypto`
  /// doesn't expose a constant-time compare, so this is a small manual one:
  /// XOR every character pair and accumulate the differences in `result`
  /// rather than returning as soon as a mismatch is found, so the number of
  /// loop iterations (and therefore the time taken) never depends on *where*
  /// the first differing character is.
  ///
  /// Low real-world severity here — PIN entry needs physical device access,
  /// and this is a local, in-process comparison with no network-observable
  /// timing surface — but cheap to do properly.
  bool _constantTimeEquals(String a, String b) {
    if (a.length != b.length) return false;
    var result = 0;
    for (var i = 0; i < a.length; i++) {
      result |= a.codeUnitAt(i) ^ b.codeUnitAt(i);
    }
    return result == 0;
  }
}

final NotifierProvider<AppLockController, AppLockState> appLockControllerProvider =
    NotifierProvider<AppLockController, AppLockState>(AppLockController.new);
