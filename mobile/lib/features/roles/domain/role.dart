import 'package:equatable/equatable.dart';

import 'permission.dart';

/// One `RolePermission` join row as nested under a role: `{permission: {...}}`.
class RolePermissionLink extends Equatable {
  const RolePermissionLink({required this.permission});

  factory RolePermissionLink.fromJson(Map<String, dynamic> json) => RolePermissionLink(
        permission: MobilePermission.fromJson(json['permission'] as Map<String, dynamic>),
      );

  final MobilePermission permission;

  @override
  List<Object?> get props => [permission];
}

/// A role as returned by `GET /roles`, `GET /roles/:id`, `POST /roles`, and
/// `PATCH /roles/:id`.
class MobileRole extends Equatable {
  const MobileRole({
    required this.id,
    required this.name,
    this.companyId,
    this.description,
    this.isSystem = false,
    this.permissions = const [],
    this.userCount = 0,
  });

  factory MobileRole.fromJson(Map<String, dynamic> json) => MobileRole(
        id: json['id'] as String,
        companyId: json['companyId'] as String?,
        name: json['name'] as String,
        description: json['description'] as String?,
        isSystem: json['isSystem'] as bool? ?? false,
        permissions: (json['permissions'] as List<dynamic>? ?? const [])
            .map((e) => RolePermissionLink.fromJson(e as Map<String, dynamic>))
            .toList(),
        userCount: (json['_count'] as Map<String, dynamic>?)?['users'] as int? ?? 0,
      );

  final String id;
  final String? companyId;
  final String name;
  final String? description;
  final bool isSystem;
  final List<RolePermissionLink> permissions;
  final int userCount;

  /// Convenience view used to seed the permission-matrix `Set<String>` when
  /// editing an existing role.
  Set<String> get permissionKeys => permissions.map((p) => p.permission.key).toSet();

  bool get canDelete => !isSystem && userCount == 0;

  @override
  List<Object?> get props => [
        id,
        companyId,
        name,
        description,
        isSystem,
        permissions,
        userCount,
      ];
}
