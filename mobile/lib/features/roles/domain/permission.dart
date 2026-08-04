import 'package:equatable/equatable.dart';

/// A single grantable permission, as returned by `GET /permissions`.
///
/// `key` is the canonical `module:action` string used everywhere else
/// (role payloads, `AppSession.permissions`, etc); `module` / `action` are
/// exposed separately so the UI can group without re-splitting the key.
class MobilePermission extends Equatable {
  const MobilePermission({
    required this.id,
    required this.key,
    required this.module,
    required this.action,
  });

  factory MobilePermission.fromJson(Map<String, dynamic> json) => MobilePermission(
        id: json['id'] as String,
        key: json['key'] as String,
        module: json['module'] as String,
        action: json['action'] as String,
      );

  final String id;
  final String key;
  final String module;
  final String action;

  @override
  List<Object?> get props => [id, key, module, action];
}
