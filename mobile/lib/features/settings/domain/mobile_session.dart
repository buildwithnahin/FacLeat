import 'package:equatable/equatable.dart';

/// One active login session for the current user, as returned by
/// `GET /auth/sessions` — backed by a `MobileRefreshToken` row.
class MobileSessionInfo extends Equatable {
  const MobileSessionInfo({
    required this.id,
    required this.deviceLabel,
    required this.createdAt,
    required this.expiresAt,
  });

  factory MobileSessionInfo.fromJson(Map<String, dynamic> json) => MobileSessionInfo(
        id: json['id'] as String,
        deviceLabel: json['deviceLabel'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        expiresAt: DateTime.parse(json['expiresAt'] as String),
      );

  final String id;
  final String? deviceLabel;
  final DateTime createdAt;
  final DateTime expiresAt;

  @override
  List<Object?> get props => [id, deviceLabel, createdAt, expiresAt];
}
