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
  const AppLockState({this.status = AppLockStatus.disabled});

  final AppLockStatus status;

  bool get isLocked => status == AppLockStatus.locked;

  AppLockState copyWith({AppLockStatus? status}) {
    return AppLockState(status: status ?? this.status);
  }

  @override
  List<Object?> get props => [status];
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

  /// Turns App Lock off entirely and wipes the stored PIN/biometric flag.
  Future<void> disable() async {
    await ref.read(secureStorageProvider).clearAppLock();
    state = const AppLockState(status: AppLockStatus.disabled);
  }

  /// Hashes [pin] with the stored salt and compares against the stored
  /// hash. On a match, unlocks and returns true. On a mismatch (or if no
  /// PIN has been set at all), returns false and leaves [state] untouched
  /// so the lock screen can show its shake/error feedback.
  Future<bool> verifyPin(String pin) async {
    final storage = ref.read(secureStorageProvider);
    final hash = await storage.getAppLockPinHash();
    final salt = await storage.getAppLockPinSalt();
    if (hash == null || salt == null) return false;

    final candidate = _hashPin(pin, salt);
    if (candidate != hash) return false;

    state = const AppLockState(status: AppLockStatus.unlocked);
    return true;
  }

  /// Verifies [currentPin] first — throwing [AppLockException] with a
  /// user-facing message if it doesn't match — then stores [newPin] as the
  /// new PIN.
  Future<void> changePin(String currentPin, String newPin) async {
    final storage = ref.read(secureStorageProvider);
    final hash = await storage.getAppLockPinHash();
    final salt = await storage.getAppLockPinSalt();
    if (hash == null || salt == null || _hashPin(currentPin, salt) != hash) {
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
}

final NotifierProvider<AppLockController, AppLockState> appLockControllerProvider =
    NotifierProvider<AppLockController, AppLockState>(AppLockController.new);
