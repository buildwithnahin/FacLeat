import 'package:equatable/equatable.dart';

/// Mirrors the Prisma `NotificationSeverity` enum on the web app
/// (`INFO` / `WARNING` / `CRITICAL`).
enum NotificationSeverity { info, warning, critical }

NotificationSeverity _severityFromJson(String? raw) {
  switch (raw) {
    case 'WARNING':
      return NotificationSeverity.warning;
    case 'CRITICAL':
      return NotificationSeverity.critical;
    case 'INFO':
    default:
      return NotificationSeverity.info;
  }
}

/// One row from `GET /notifications`, `GET /notifications/:id/read`'s
/// response, or a live event pushed over `GET /sse/notifications`.
class NotificationItem extends Equatable {
  const NotificationItem({
    required this.id,
    required this.recipientId,
    required this.branchId,
    required this.severity,
    required this.module,
    required this.title,
    required this.body,
    required this.href,
    required this.readAt,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) => NotificationItem(
        id: json['id'] as String,
        recipientId: json['recipientId'] as String? ?? '',
        branchId: json['branchId'] as String?,
        severity: _severityFromJson(json['severity'] as String?),
        module: json['module'] as String? ?? '',
        title: json['title'] as String? ?? '',
        body: json['body'] as String?,
        href: json['href'] as String?,
        readAt: json['readAt'] != null ? DateTime.tryParse(json['readAt'] as String) : null,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      );

  final String id;
  final String recipientId;
  final String? branchId;
  final NotificationSeverity severity;
  final String module;
  final String title;
  final String? body;
  final String? href;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isUnread => readAt == null;

  @override
  List<Object?> get props =>
      [id, recipientId, branchId, severity, module, title, body, href, readAt, createdAt];
}
