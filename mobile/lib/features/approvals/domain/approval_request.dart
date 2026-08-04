import 'package:equatable/equatable.dart';

/// A single approver-role entry nested under an [ApprovalRequest] as
/// returned by `GET /approvals` and `GET /approvals/:id`.
class ApprovalRule extends Equatable {
  const ApprovalRule({
    required this.id,
    required this.name,
    this.approverRoles = const [],
    this.escalateAfterHours,
  });

  factory ApprovalRule.fromJson(Map<String, dynamic> json) => ApprovalRule(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        approverRoles: (json['approverRoles'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(),
        escalateAfterHours: json['escalateAfterHours'] as int?,
      );

  final String id;
  final String name;
  final List<String> approverRoles;
  final int? escalateAfterHours;

  @override
  List<Object?> get props => [id, name, approverRoles, escalateAfterHours];
}

/// The user who filed the approval request, per the nested `requestedBy`.
class ApprovalRequester extends Equatable {
  const ApprovalRequester({required this.id, required this.name, required this.email});

  factory ApprovalRequester.fromJson(Map<String, dynamic> json) => ApprovalRequester(
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

/// One step in an [ApprovalRequest]'s approval chain, from the
/// `ApprovalStep` Prisma model.
class ApprovalStep extends Equatable {
  const ApprovalStep({
    required this.id,
    required this.requestId,
    required this.sequence,
    required this.approverRole,
    required this.status,
    required this.createdAt,
    this.approverId,
    this.decidedAt,
    this.note,
  });

  factory ApprovalStep.fromJson(Map<String, dynamic> json) => ApprovalStep(
        id: json['id'] as String? ?? '',
        requestId: json['requestId'] as String? ?? '',
        sequence: json['sequence'] as int? ?? 0,
        approverRole: json['approverRole'] as String? ?? '',
        approverId: json['approverId'] as String?,
        status: json['status'] as String? ?? 'WAITING',
        decidedAt: json['decidedAt'] != null ? DateTime.tryParse(json['decidedAt'] as String) : null,
        note: json['note'] as String?,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      );

  final String id;
  final String requestId;
  final int sequence;
  final String approverRole;
  final String? approverId;
  final String status;
  final DateTime? decidedAt;
  final String? note;
  final DateTime createdAt;

  @override
  List<Object?> get props =>
      [id, requestId, sequence, approverRole, approverId, status, decidedAt, note, createdAt];
}

/// An approval request, as returned by `GET /approvals`, `GET /approvals/:id`,
/// and (in a thinner shape — no [rule], empty [steps], no [requestedBy]) by
/// the four decision endpoints (`approve` / `reject` / `request-changes` /
/// `cancel`). Callers that need the full shape after a decision should
/// refetch via `GET /approvals/:id` rather than trust the decision response.
class ApprovalRequest extends Equatable {
  const ApprovalRequest({
    required this.id,
    required this.module,
    required this.action,
    required this.entityType,
    required this.entityId,
    required this.title,
    required this.requestedById,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.ruleId,
    this.rule,
    this.summary,
    this.amount,
    this.currency,
    this.branchId,
    this.requestedBy,
    this.decidedAt,
    this.note,
    this.steps = const [],
  });

  factory ApprovalRequest.fromJson(Map<String, dynamic> json) => ApprovalRequest(
        id: json['id'] as String? ?? '',
        ruleId: json['ruleId'] as String?,
        rule: json['rule'] is Map
            ? ApprovalRule.fromJson(Map<String, dynamic>.from(json['rule'] as Map))
            : null,
        module: json['module'] as String? ?? '',
        action: json['action'] as String? ?? '',
        entityType: json['entityType'] as String? ?? '',
        entityId: json['entityId'] as String? ?? '',
        title: json['title'] as String? ?? '',
        summary: json['summary'] as String?,
        amount: json['amount'] as String?,
        currency: json['currency'] as String?,
        branchId: json['branchId'] as String?,
        requestedById: json['requestedById'] as String? ?? '',
        requestedBy: json['requestedBy'] is Map
            ? ApprovalRequester.fromJson(Map<String, dynamic>.from(json['requestedBy'] as Map))
            : null,
        status: json['status'] as String? ?? 'PENDING',
        decidedAt: json['decidedAt'] != null ? DateTime.tryParse(json['decidedAt'] as String) : null,
        note: json['note'] as String?,
        steps: (json['steps'] as List<dynamic>? ?? const [])
            .map((e) => ApprovalStep.fromJson(e as Map<String, dynamic>))
            .toList(),
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ?? DateTime.now(),
      );

  final String id;
  final String? ruleId;
  final ApprovalRule? rule;
  final String module;
  final String action;
  final String entityType;
  final String entityId;
  final String title;
  final String? summary;

  /// Decimal serialized as a string by the backend (e.g. `"1250.5000"`).
  /// Parse with `double.tryParse` at the presentation layer.
  final String? amount;
  final String? currency;
  final String? branchId;
  final String requestedById;
  final ApprovalRequester? requestedBy;
  final String status;
  final DateTime? decidedAt;
  final String? note;
  final List<ApprovalStep> steps;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// Parsed [amount], or `null` when absent / unparsable.
  double? get amountValue => amount != null ? double.tryParse(amount!) : null;

  /// Whether the current status still allows a decision (approve / reject /
  /// request changes) — mirrors the backend's own gating logic.
  bool get isDecidable => status == 'PENDING' || status == 'CHANGES_REQUESTED';

  @override
  List<Object?> get props => [
        id,
        ruleId,
        rule,
        module,
        action,
        entityType,
        entityId,
        title,
        summary,
        amount,
        currency,
        branchId,
        requestedById,
        requestedBy,
        status,
        decidedAt,
        note,
        steps,
        createdAt,
        updatedAt,
      ];
}
