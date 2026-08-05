import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thin wrapper around [FlutterSecureStorage].
///
/// Holds the refresh token plus a handful of small on-device preferences
/// (theme, app-lock PIN/flags, notification prefs, language) — nothing here
/// is ever business data, so it's fine for all of it to live in the same
/// key-value store as the refresh token. The access token stays in memory
/// only (see [core/network/api_client.dart]).
class SecureStorage {
  SecureStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const String _refreshTokenKey = 'refresh_token';
  static const String _themeModeKey = 'theme_mode';

  // App lock (Phase 6). PIN is never stored in the clear — only a salted
  // hash. `appLockEnabled` gates whether the lock screen is shown at all;
  // `appLockBiometricEnabled` is meaningless unless a PIN has also been set,
  // since the PIN is always the fallback when biometrics fail/are cancelled.
  static const String _appLockEnabledKey = 'app_lock_enabled';
  static const String _appLockPinHashKey = 'app_lock_pin_hash';
  static const String _appLockPinSaltKey = 'app_lock_pin_salt';
  static const String _appLockBiometricEnabledKey = 'app_lock_biometric_enabled';

  // Notification prefs (Phase 6, client-side only — there is no backend
  // model for these, they only affect local sound/vibration feedback).
  static const String _notifSoundEnabledKey = 'notif_sound_enabled';
  static const String _notifVibrateEnabledKey = 'notif_vibrate_enabled';
  static const String _notifMutedSeveritiesKey = 'notif_muted_severities';

  // Language (Phase 6 scaffold — infra only, only 'en' has real content).
  static const String _languageCodeKey = 'language_code';

  Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> setRefreshToken(String token) =>
      _storage.write(key: _refreshTokenKey, value: token);

  Future<void> clearRefreshToken() => _storage.delete(key: _refreshTokenKey);

  Future<String?> getThemeMode() => _storage.read(key: _themeModeKey);

  Future<void> setThemeMode(String mode) =>
      _storage.write(key: _themeModeKey, value: mode);

  Future<bool> getAppLockEnabled() async => (await _storage.read(key: _appLockEnabledKey)) == 'true';

  Future<void> setAppLockEnabled(bool value) =>
      _storage.write(key: _appLockEnabledKey, value: value ? 'true' : 'false');

  Future<String?> getAppLockPinHash() => _storage.read(key: _appLockPinHashKey);

  Future<String?> getAppLockPinSalt() => _storage.read(key: _appLockPinSaltKey);

  Future<void> setAppLockPin({required String hash, required String salt}) async {
    await _storage.write(key: _appLockPinHashKey, value: hash);
    await _storage.write(key: _appLockPinSaltKey, value: salt);
  }

  Future<void> clearAppLockPin() async {
    await _storage.delete(key: _appLockPinHashKey);
    await _storage.delete(key: _appLockPinSaltKey);
  }

  Future<bool> getAppLockBiometricEnabled() async =>
      (await _storage.read(key: _appLockBiometricEnabledKey)) == 'true';

  Future<void> setAppLockBiometricEnabled(bool value) =>
      _storage.write(key: _appLockBiometricEnabledKey, value: value ? 'true' : 'false');

  /// Clears every app-lock key — used when the user disables the lock
  /// entirely, or as the "forgot PIN" escape hatch (paired with a logout).
  Future<void> clearAppLock() async {
    await _storage.delete(key: _appLockEnabledKey);
    await _storage.delete(key: _appLockPinHashKey);
    await _storage.delete(key: _appLockPinSaltKey);
    await _storage.delete(key: _appLockBiometricEnabledKey);
  }

  Future<bool> getNotifSoundEnabled() async => (await _storage.read(key: _notifSoundEnabledKey)) != 'false';

  Future<void> setNotifSoundEnabled(bool value) =>
      _storage.write(key: _notifSoundEnabledKey, value: value ? 'true' : 'false');

  Future<bool> getNotifVibrateEnabled() async => (await _storage.read(key: _notifVibrateEnabledKey)) != 'false';

  Future<void> setNotifVibrateEnabled(bool value) =>
      _storage.write(key: _notifVibrateEnabledKey, value: value ? 'true' : 'false');

  /// Comma-separated severity names (`INFO`, `WARNING`, `CRITICAL`) that
  /// should NOT trigger sound/vibration. The notification is still delivered
  /// and shown in the list either way — muting only silences the alert.
  Future<Set<String>> getNotifMutedSeverities() async {
    final raw = await _storage.read(key: _notifMutedSeveritiesKey);
    if (raw == null || raw.isEmpty) return const {};
    return raw.split(',').toSet();
  }

  Future<void> setNotifMutedSeverities(Set<String> severities) =>
      _storage.write(key: _notifMutedSeveritiesKey, value: severities.join(','));

  Future<String> getLanguageCode() async => (await _storage.read(key: _languageCodeKey)) ?? 'en';

  Future<void> setLanguageCode(String code) => _storage.write(key: _languageCodeKey, value: code);
}

final Provider<SecureStorage> secureStorageProvider = Provider<SecureStorage>(
  (ref) => SecureStorage(const FlutterSecureStorage()),
);
