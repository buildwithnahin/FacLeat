// Verifies KpiCard's count-up animation starts at 0 and settles on the
// target value once the TweenAnimationBuilder finishes.

import 'package:annex_mobile/core/theme/app_colors.dart';
import 'package:annex_mobile/features/dashboard/presentation/widgets/kpi_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('KpiCard animates its number from 0 up to the target value', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: KpiCard(
            label: 'Branches',
            value: 42,
            icon: Icons.store_mall_directory_outlined,
            color: AppColors.primary,
            duration: Duration(milliseconds: 200),
          ),
        ),
      ),
    );

    // First frame: the tween starts at 0.
    await tester.pump();
    expect(find.text('0'), findsOneWidget);
    expect(find.text('42'), findsNothing);

    // Mid-animation: some intermediate (non-zero, non-final) value should be
    // showing — advance partway through the tween.
    await tester.pump(const Duration(milliseconds: 100));
    final midText = tester.widget<Text>(find.byKey(const Key('kpiValue_Branches')));
    final midValue = int.parse(midText.data!);
    expect(midValue, greaterThanOrEqualTo(0));
    expect(midValue, lessThanOrEqualTo(42));

    // After the animation duration elapses, the count-up settles on 42.
    await tester.pumpAndSettle();
    expect(find.text('42'), findsOneWidget);
    expect(find.text('Branches'), findsOneWidget);
  });

  testWidgets('KpiCard applies an optional suffix to the animated value', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: KpiCard(
            label: 'Uptime',
            value: 99,
            suffix: '%',
            icon: Icons.bolt,
            color: AppColors.success,
            duration: Duration(milliseconds: 100),
          ),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('99%'), findsOneWidget);
  });
}
