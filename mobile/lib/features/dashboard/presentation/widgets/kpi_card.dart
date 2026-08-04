import 'package:flutter/material.dart';

/// A single KPI stat card with a count-up animation on its headline number.
///
/// The number tweens from 0 to [value] over [duration] using a plain
/// [TweenAnimationBuilder] — no extra animation package needed for a simple
/// linear int count-up. Entrance/stagger animation (fade + slide) is applied
/// by the caller via `flutter_animate`, not here, so this widget stays easy
/// to unit test in isolation.
class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.suffix = '',
    this.duration = const Duration(milliseconds: 800),
    this.onTap,
  });

  final String label;
  final int value;
  final IconData icon;
  final Color color;
  final String suffix;
  final Duration duration;

  /// When set, the whole card becomes tappable (with a ripple + chevron
  /// hint) to jump to whatever screen best explains this metric.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Material(
      color: theme.cardTheme.color ?? theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        key: Key('kpiCardTap_$label'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.16)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 19, color: color),
                  ),
                  const Spacer(),
                  if (onTap != null)
                    Icon(Icons.chevron_right, size: 18, color: theme.colorScheme.onSurfaceVariant),
                ],
              ),
              const SizedBox(height: 14),
              TweenAnimationBuilder<int>(
                key: ValueKey('kpiTween_${label}_$value'),
                tween: IntTween(begin: 0, end: value),
                duration: duration,
                curve: Curves.easeOutCubic,
                builder: (context, animatedValue, child) {
                  return Text(
                    '$animatedValue$suffix',
                    key: Key('kpiValue_$label'),
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  );
                },
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
