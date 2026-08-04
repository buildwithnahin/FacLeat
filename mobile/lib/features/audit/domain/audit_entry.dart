import 'package:equatable/equatable.dart';

class AuditActor extends Equatable {
  const AuditActor({required this.id, required this.name, required this.email});

  factory AuditActor.fromJson(Map<String, dynamic> json) => AuditActor(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? 'Unknown',
        email: json['email'] as String? ?? '',
      );

  final String id;
  final String name;
  final String email;

  @override
  List<Object?> get props => [id, name, email];
}

class AuditBranch extends Equatable {
  const AuditBranch({required this.id, required this.name, required this.code});

  factory AuditBranch.fromJson(Map<String, dynamic> json) => AuditBranch(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        code: json['code'] as String? ?? '',
      );

  final String id;
  final String name;
  final String code;

  @override
  List<Object?> get props => [id, name, code];
}

/// One row from `GET /audit`, or the full detail from `GET /audit/:id`
/// (which additionally populates [before]/[after] with the JSONB diff).
class AuditEntry extends Equatable {
  const AuditEntry({
    required this.id,
    required this.module,
    required this.action,
    required this.entityType,
    required this.entityId,
    required this.before,
    required this.after,
    required this.ip,
    required this.userAgent,
    required this.createdAt,
    this.actor,
    this.branch,
  });

  factory AuditEntry.fromJson(Map<String, dynamic> json) => AuditEntry(
        id: json['id'] as String,
        module: json['module'] as String? ?? '',
        action: json['action'] as String? ?? '',
        entityType: json['entityType'] as String? ?? '',
        entityId: json['entityId'] as String? ?? '',
        before: json['before'],
        after: json['after'],
        ip: json['ip'] as String?,
        userAgent: json['userAgent'] as String?,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
        actor: json['actor'] is Map
            ? AuditActor.fromJson(Map<String, dynamic>.from(json['actor'] as Map))
            : null,
        branch: json['branch'] is Map
            ? AuditBranch.fromJson(Map<String, dynamic>.from(json['branch'] as Map))
            : null,
      );

  final String id;
  final String module;
  final String action;
  final String entityType;
  final String entityId;
  final dynamic before;
  final dynamic after;
  final String? ip;
  final String? userAgent;
  final DateTime createdAt;
  final AuditActor? actor;
  final AuditBranch? branch;

  @override
  List<Object?> get props =>
      [id, module, action, entityType, entityId, before, after, ip, userAgent, createdAt, actor, branch];
}
