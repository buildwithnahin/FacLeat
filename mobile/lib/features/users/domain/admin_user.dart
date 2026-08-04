import 'package:equatable/equatable.dart';

/// A branch reference as nested under a user (`defaultBranch`, or
/// `branchAccesses[].branch`).
class BranchRef extends Equatable {
  const BranchRef({
    required this.id,
    required this.name,
    required this.code,
    this.companyId,
  });

  factory BranchRef.fromJson(Map<String, dynamic> json) => BranchRef(
        id: json['id'] as String,
        name: json['name'] as String,
        code: json['code'] as String,
        companyId: json['companyId'] as String?,
      );

  final String id;
  final String name;
  final String code;
  final String? companyId;

  @override
  List<Object?> get props => [id, name, code, companyId];
}

/// One `UserBranchAccess` join row: `{branch: {...}}`.
class UserBranchAccess extends Equatable {
  const UserBranchAccess({required this.branch});

  factory UserBranchAccess.fromJson(Map<String, dynamic> json) => UserBranchAccess(
        branch: BranchRef.fromJson(json['branch'] as Map<String, dynamic>),
      );

  final BranchRef branch;

  @override
  List<Object?> get props => [branch];
}

/// The role summary nested under a user's `roles[].role`.
class UserRoleLink extends Equatable {
  const UserRoleLink({required this.id, required this.name, this.isSystem = false});

  factory UserRoleLink.fromJson(Map<String, dynamic> json) => UserRoleLink(
        id: json['id'] as String,
        name: json['name'] as String,
        isSystem: json['isSystem'] as bool? ?? false,
      );

  final String id;
  final String name;
  final bool isSystem;

  @override
  List<Object?> get props => [id, name, isSystem];
}

/// The employee profile linked to a user account.
class EmployeeRef extends Equatable {
  const EmployeeRef({
    required this.id,
    required this.code,
    required this.firstName,
    required this.lastName,
    this.designation,
    this.department,
  });

  factory EmployeeRef.fromJson(Map<String, dynamic> json) => EmployeeRef(
        id: json['id'] as String,
        code: json['code'] as String,
        firstName: json['firstName'] as String,
        lastName: json['lastName'] as String,
        designation: json['designation'] as String?,
        department: json['department'] as String?,
      );

  final String id;
  final String code;
  final String firstName;
  final String lastName;
  final String? designation;
  final String? department;

  String get fullName => '$firstName $lastName';

  @override
  List<Object?> get props => [id, code, firstName, lastName, designation, department];
}

/// A user as returned by `GET /users` / `GET /users/:id`.
class AdminUser extends Equatable {
  const AdminUser({
    required this.id,
    required this.email,
    required this.name,
    this.phone,
    this.status = 'ACTIVE',
    this.branchAccessType = 'OWN_BRANCH_ONLY',
    this.employee,
    this.defaultBranch,
    this.branchAccesses = const [],
    this.roles = const [],
  });

  factory AdminUser.fromJson(Map<String, dynamic> json) => AdminUser(
        id: json['id'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String?,
        status: json['status'] as String? ?? 'ACTIVE',
        branchAccessType: json['branchAccessType'] as String? ?? 'OWN_BRANCH_ONLY',
        employee: json['employee'] != null
            ? EmployeeRef.fromJson(json['employee'] as Map<String, dynamic>)
            : null,
        defaultBranch: json['defaultBranch'] != null
            ? BranchRef.fromJson(json['defaultBranch'] as Map<String, dynamic>)
            : null,
        branchAccesses: (json['branchAccesses'] as List<dynamic>? ?? const [])
            .map((e) => UserBranchAccess.fromJson(e as Map<String, dynamic>))
            .toList(),
        roles: (json['roles'] as List<dynamic>? ?? const [])
            .map((e) => UserRoleLink.fromJson((e as Map<String, dynamic>)['role'] as Map<String, dynamic>))
            .toList(),
      );

  final String id;
  final String email;
  final String name;
  final String? phone;
  final String status;
  final String branchAccessType;
  final EmployeeRef? employee;
  final BranchRef? defaultBranch;
  final List<UserBranchAccess> branchAccesses;
  final List<UserRoleLink> roles;

  bool get isActive => status == 'ACTIVE';

  String get primaryRoleName => roles.isNotEmpty ? roles.first.name : 'No role assigned';

  /// Two-letter initials derived from [name], for the list/detail avatar.
  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) {
      return parts.first.substring(0, parts.first.length >= 2 ? 2 : 1).toUpperCase();
    }
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  /// Human summary of branch access: "All branches", "Own branch" (with the
  /// branch name), or "N branches" / the single branch name when a specific
  /// subset is assigned.
  String get branchAccessSummary {
    switch (branchAccessType) {
      case 'ALL_BRANCHES':
        return 'All branches';
      case 'ASSIGNED_BRANCHES':
        if (branchAccesses.isEmpty) return 'No branches assigned';
        if (branchAccesses.length == 1) return branchAccesses.first.branch.name;
        return '${branchAccesses.length} branches';
      case 'OWN_BRANCH_ONLY':
      default:
        return defaultBranch?.name ?? 'Own branch';
    }
  }

  @override
  List<Object?> get props => [
        id,
        email,
        name,
        phone,
        status,
        branchAccessType,
        employee,
        defaultBranch,
        branchAccesses,
        roles,
      ];
}
