import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/users_repository.dart';
import '../domain/admin_user.dart';

/// All users visible to the current session, per `GET /users`.
final FutureProvider<List<AdminUser>> usersListProvider = FutureProvider<List<AdminUser>>(
  (ref) => ref.watch(usersRepositoryProvider).list(),
);

/// A single user by id, per `GET /users/:id`.
final FutureProviderFamily<AdminUser, String> userDetailProvider =
    FutureProvider.family<AdminUser, String>(
  (ref, id) => ref.watch(usersRepositoryProvider).getById(id),
);
