import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/roles_repository.dart';
import '../domain/permission.dart';
import '../domain/role.dart';

/// All roles visible to the current session, per `GET /roles`.
final FutureProvider<List<MobileRole>> rolesListProvider = FutureProvider<List<MobileRole>>(
  (ref) => ref.watch(rolesRepositoryProvider).list(),
);

/// A single role by id, per `GET /roles/:id`. Kept separate from
/// [rolesListProvider] so the detail/edit screen can refetch (and get the
/// full up-to-date permission set) without reloading the whole list.
final FutureProviderFamily<MobileRole, String> roleDetailProvider =
    FutureProvider.family<MobileRole, String>(
  (ref, id) => ref.watch(rolesRepositoryProvider).getById(id),
);

/// The flat list of all ~110 grantable permissions, per `GET /permissions`.
/// The permission-matrix UI groups these by `module` client-side.
final FutureProvider<List<MobilePermission>> permissionsProvider =
    FutureProvider<List<MobilePermission>>(
  (ref) => ref.watch(rolesRepositoryProvider).listPermissions(),
);
