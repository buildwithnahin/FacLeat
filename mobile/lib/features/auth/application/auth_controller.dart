import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/secure_storage.dart';
import '../../app_lock/application/app_lock_controller.dart';
import '../../notifications/application/notifications_providers.dart';
import '../data/auth_repository.dart';
import '../domain/auth_exception.dart';
import '../domain/mobile_user.dart';

enum AuthStatus {
  /// Still restoring the session on app start — router keeps the user on
  /// the splash screen while in this state.
  unknown,
  authenticated,
  unauthenticated,
}

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.accessToken,
    this.user,
    this.isLoading = false,
    this.errorMessage,
  });

  final AuthStatus status;
  final String? accessToken;
  final MobileUser? user;
  final bool isLoading;
  final String? errorMessage;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    AuthStatus? status,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      accessToken: accessToken,
      user: user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }

  @override
  List<Object?> get props => [status, accessToken, user, isLoading, errorMessage];
}

/// Single source of truth for the mobile session. UI reads this to drive the
/// login screen (loading / error) and the router redirect; [ApiClient]'s auth
/// interceptor reads/updates it directly to keep the in-memory access token
/// current across silent refreshes.
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    return const AuthState();
  }

  /// Called once on app start (from the splash screen). Attempts a silent
  /// refresh using the stored refresh token; falls back to unauthenticated.
  Future<void> tryRestoreSession() async {
    final storage = ref.read(secureStorageProvider);
    final refreshToken = await storage.getRefreshToken();
    if (refreshToken == null) {
      state = const AuthState(status: AuthStatus.unauthenticated);
      return;
    }
    try {
      final repo = ref.read(authRepositoryProvider);
      final tokens = await repo.refresh(refreshToken);
      await storage.setRefreshToken(tokens.refreshToken);
      state = AuthState(
        status: AuthStatus.authenticated,
        accessToken: tokens.accessToken,
      );
    } catch (_) {
      await storage.clearRefreshToken();
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final repo = ref.read(authRepositoryProvider);
      final result = await repo.login(
        email: email,
        password: password,
        deviceLabel: 'flutter-mobile',
      );
      await ref.read(secureStorageProvider).setRefreshToken(result.tokens.refreshToken);
      state = AuthState(
        status: AuthStatus.authenticated,
        accessToken: result.tokens.accessToken,
        user: result.user,
      );
      return true;
    } on AuthException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.message);
      return false;
    } catch (_) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Something went wrong. Please try again.',
      );
      return false;
    }
  }

  Future<void> logout() async {
    final storage = ref.read(secureStorageProvider);
    final refreshToken = await storage.getRefreshToken();
    if (refreshToken != null) {
      await ref.read(authRepositoryProvider).logout(refreshToken);
    }
    await storage.clearRefreshToken();
    // A regular logout must also clear App Lock — otherwise a second user
    // signing into the same device inherits the first user's still-`unlocked`
    // app-lock state with no PIN prompt (see AppLockController.disable()'s
    // doc comment for the full scenario this prevents).
    await ref.read(appLockControllerProvider.notifier).disable();
    await teardownNotificationsSse(ref);
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Called by the API client's auth interceptor after a successful silent
  /// refresh triggered by a 401 response.
  void updateAccessToken(String token) {
    state = AuthState(
      status: AuthStatus.authenticated,
      accessToken: token,
      user: state.user,
    );
  }
}

final NotifierProvider<AuthController, AuthState> authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
