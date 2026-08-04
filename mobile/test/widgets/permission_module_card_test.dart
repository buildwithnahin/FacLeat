// Widget tests for PermissionModuleCard — the header "select all" control
// must toggle every permission in the module, and its tri-state indicator
// (all / partial / none) must track the selected-keys set correctly.

import 'package:annex_mobile/features/roles/domain/permission.dart';
import 'package:annex_mobile/features/roles/presentation/widgets/permission_module_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _permissions = [
  MobilePermission(id: '1', key: 'inventory:read', module: 'inventory', action: 'read'),
  MobilePermission(id: '2', key: 'inventory:write', module: 'inventory', action: 'write'),
  MobilePermission(id: '3', key: 'inventory:transfer', module: 'inventory', action: 'transfer'),
];

/// Small stateful harness so tapping the header checkbox / a single row can
/// mutate the `selectedKeys` set the same way `role_form_screen.dart` does,
/// letting the test assert on the resulting UI state rather than only the
/// callback invocation.
class _Harness extends StatefulWidget {
  const _Harness({this.initialSelected = const {}});

  final Set<String> initialSelected;

  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  late Set<String> selected = {...widget.initialSelected};
  int toggleAllCallCount = 0;
  bool? lastToggleAllValue;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: PermissionModuleCard(
          module: 'inventory',
          permissions: _permissions,
          selectedKeys: selected,
          initiallyExpanded: true,
          onToggle: (key) => setState(() {
            if (selected.contains(key)) {
              selected.remove(key);
            } else {
              selected.add(key);
            }
          }),
          onToggleAll: (selectAll) {
            toggleAllCallCount++;
            lastToggleAllValue = selectAll;
            setState(() {
              if (selectAll) {
                selected.addAll(_permissions.map((p) => p.key));
              } else {
                selected.removeAll(_permissions.map((p) => p.key));
              }
            });
          },
        ),
      ),
    );
  }
}

void main() {
  testWidgets('header checkbox selects every permission in the module when none are selected',
      (tester) async {
    await tester.pumpWidget(const _Harness());
    await tester.pumpAndSettle();

    expect(find.text('0 of 3 selected'), findsOneWidget);

    await tester.tap(find.byKey(const Key('module-checkbox-inventory')));
    await tester.pumpAndSettle();

    final state = tester.state<_HarnessState>(find.byType(_Harness));
    expect(state.toggleAllCallCount, 1);
    expect(state.lastToggleAllValue, isTrue);
    expect(state.selected, {'inventory:read', 'inventory:write', 'inventory:transfer'});
    expect(find.text('3 of 3 selected'), findsOneWidget);
  });

  testWidgets('header checkbox clears every permission in the module when all are selected',
      (tester) async {
    await tester.pumpWidget(
      const _Harness(initialSelected: {'inventory:read', 'inventory:write', 'inventory:transfer'}),
    );
    await tester.pumpAndSettle();

    expect(find.text('3 of 3 selected'), findsOneWidget);

    await tester.tap(find.byKey(const Key('module-checkbox-inventory')));
    await tester.pumpAndSettle();

    final state = tester.state<_HarnessState>(find.byType(_Harness));
    expect(state.lastToggleAllValue, isFalse);
    expect(state.selected, isEmpty);
    expect(find.text('0 of 3 selected'), findsOneWidget);
  });

  testWidgets('tapping a single permission row toggles only that permission', (tester) async {
    await tester.pumpWidget(const _Harness(initialSelected: {'inventory:read'}));
    await tester.pumpAndSettle();

    expect(find.text('1 of 3 selected'), findsOneWidget);

    await tester.tap(find.byKey(const Key('perm-checkbox-inventory:write')));
    await tester.pumpAndSettle();

    final state = tester.state<_HarnessState>(find.byType(_Harness));
    expect(state.selected, {'inventory:read', 'inventory:write'});
    expect(find.text('2 of 3 selected'), findsOneWidget);
  });

  testWidgets('shows partial state (neither fully checked nor unchecked) when some are selected',
      (tester) async {
    await tester.pumpWidget(const _Harness(initialSelected: {'inventory:read'}));
    await tester.pumpAndSettle();

    final checkbox = tester.widget<Checkbox>(find.byKey(const Key('module-checkbox-inventory')));
    expect(checkbox.value, isNull); // tristate "partial" is represented as null
  });
}
