/// A user-facing authentication error, carrying the server's own error
/// string (e.g. "Invalid email or password", "This app is for system
/// administrators only") rather than a re-worded copy.
class AuthException implements Exception {
  const AuthException(this.message);

  final String message;

  @override
  String toString() => message;
}
