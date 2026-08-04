import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thin wrapper around [FlutterSecureStorage].
///
/// Only the refresh token and the user's theme preference are ever persisted
/// to disk. The access token stays in memory only (see [core/network/api_client.dart]).
class SecureStorage {
  SecureStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const String _refreshTokenKey = 'refresh_token';
  static const String _themeModeKey = 'theme_mode';

  Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> setRefreshToken(String token) =>
      _storage.write(key: _refreshTokenKey, value: token);

  Future<void> clearRefreshToken() => _storage.delete(key: _refreshTokenKey);

  Future<String?> getThemeMode() => _storage.read(key: _themeModeKey);

  Future<void> setThemeMode(String mode) =>
      _storage.write(key: _themeModeKey, value: mode);
}

final Provider<SecureStorage> secureStorageProvider = Provider<SecureStorage>(
  (ref) => SecureStorage(const FlutterSecureStorage()),
);
