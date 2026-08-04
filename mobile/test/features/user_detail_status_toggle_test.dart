// Verifies UserDetailScreen's enable/disable switch: disabling an ACTIVE
// user must show a confirmation dialog first, while re-enabling a DISABLED
// user must call the API immediately with no confirmation step.

import 'package:annex_mobile/features/users/application/users_providers.dart';
import 'package:annex_mobile/features/users/data/users_repository.dart';
import 'package:annex_mobile/features/users/domain/admin_user.dart';
import 'package:annex_mobile/features/users/presentation/user_detail_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeUsersRepository extends UsersRepository {
  _FakeUsersRepository(this._afterToggle) : super(Dio());

  final AdminUser _afterToggle;
  final List<String> statusCalls = [];

  @override
  Future<AdminUser> setStatus(String id, String status) async {
    statusCalls.add(status);
    return _afterToggle;
  }
}

const _activeUser = AdminUser(
  id: 'u1',
  email: 'nadia@annex.local',
  name: 'Nadia Begum',
  status: 'ACTIVE',
);

const _disabledUser = AdminUser(
  id: 'u1',
  email: 'nadia@annex.local',
  name: 'Nadia Begum',
  status: 'DISABLED',
);

void main() {
  testWidgets('disabling an active user shows a confirmation dialog before calling the API',
      (tester) async {
    final fakeRepo = _FakeUsersRepository(_disabledUser);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          usersRepositoryProvider.overrideWithValue(fakeRepo),
          userDetailProvider('u1').overrideWith((ref) async => _activeUser),
          usersListProvider.overrideWith((ref) async => const []),
        ],
        child: const MaterialApp(home: UserDetailScreen(userId: 'u1')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('userStatusSwitch')), findsOneWidget);
    var switchWidget = tester.widget<Switch>(find.byKey(const Key('userStatusSwitch')));
    expect(switchWidget.value, isTrue);

    // Tap the switch: a confirmation dialog should appear, and the API must
    // NOT have been called yet.
    await tester.tap(find.byKey(const Key('userStatusSwitch')));
    await tester.pumpAndSettle();

    expect(find.text('Disable this user?'), findsOneWidget);
    expect(fakeRepo.statusCalls, isEmpty);

    // Cancel: dialog closes, still no API call.
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('Disable this user?'), findsNothing);
    expect(fakeRepo.statusCalls, isEmpty);

    // Tap again and confirm this time.
    await tester.tap(find.byKey(const Key('userStatusSwitch')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('confirmDisableButton')));
    await tester.pumpAndSettle();

    expect(fakeRepo.statusCalls, ['DISABLED']);
    expect(find.text('Nadia Begum has been disabled'), findsOneWidget);
  });

  testWidgets('enabling a disabled user calls the API immediately with no confirmation dialog',
      (tester) async {
    final fakeRepo = _FakeUsersRepository(_activeUser);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          usersRepositoryProvider.overrideWithValue(fakeRepo),
          userDetailProvider('u1').overrideWith((ref) async => _disabledUser),
          usersListProvider.overrideWith((ref) async => const []),
        ],
        child: const MaterialApp(home: UserDetailScreen(userId: 'u1')),
      ),
    );
    await tester.pumpAndSettle();

    final switchWidget = tester.widget<Switch>(find.byKey(const Key('userStatusSwitch')));
    expect(switchWidget.value, isFalse);

    await tester.tap(find.byKey(const Key('userStatusSwitch')));
    await tester.pumpAndSettle();

    // No confirmation dialog for re-enabling.
    expect(find.text('Disable this user?'), findsNothing);
    expect(fakeRepo.statusCalls, ['ACTIVE']);
    expect(find.text('Nadia Begum is now active'), findsOneWidget);
  });
}
