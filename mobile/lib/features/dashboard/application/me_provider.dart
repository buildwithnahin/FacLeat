import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

/// The current user's full profile, as returned by `GET /me`.
class MeProfile extends Equatable {
  const MeProfile({
    required this.id,
    required this.email,
    required this.name,
    this.roles = const [],
    this.permissions = const [],
    this.activeBranchId,
    this.activeCompanyId,
  });

  factory MeProfile.fromJson(Map<String, dynamic> json) => MeProfile(
        id: json['id'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
        roles: (json['roles'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(),
        permissions: (json['permissions'] as List<dynamic>? ?? const [])
            .map((e) => e.toString())
            .toList(),
        activeBranchId: json['activeBranchId'] as String?,
        activeCompanyId: json['activeCompanyId'] as String?,
      );

  final String id;
  final String email;
  final String name;
  final List<String> roles;
  final List<String> permissions;
  final String? activeBranchId;
  final String? activeCompanyId;

  @override
  List<Object?> get props =>
      [id, email, name, roles, permissions, activeBranchId, activeCompanyId];
}

final FutureProvider<MeProfile> meProvider = FutureProvider<MeProfile>((ref) async {
  final dio = ref.watch(apiClientProvider);
  final response = await dio.get<Map<String, dynamic>>('/me');
  final data = response.data!['data'] as Map<String, dynamic>;
  return MeProfile.fromJson(data);
});
