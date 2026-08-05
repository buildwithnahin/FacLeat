import 'package:flutter/material.dart';

/// Every PIN entry screen (lock, setup, change) uses the same fixed-length
/// PIN so the UX is predictable across all three flows.
const int appLockPinLength = 4;

/// Row of filled/empty dots showing progress toward [appLockPinLength]
/// digits entered. Purely presentational — shared by every PIN screen.
class PinDotsIndicator extends StatelessWidget {
  const PinDotsIndicator({super.key, required this.filledCount});

  final int filledCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < appLockPinLength; i++)
          AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            margin: const EdgeInsets.symmetric(horizontal: 8),
            width: 16,
            height: 16,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i < filledCount
                  ? theme.colorScheme.primary
                  : theme.colorScheme.onSurface.withValues(alpha: 0.12),
            ),
          ),
      ],
    );
  }
}

/// The 0-9 + backspace number pad shared by the lock screen, the setup
/// screen, and the change-PIN screen. Each caller supplies its own key
/// prefixes so widget/integration tests can target the right screen's pad.
class PinPad extends StatelessWidget {
  const PinPad({
    super.key,
    required this.digitKeyPrefix,
    required this.backspaceKey,
    required this.onDigit,
    required this.onBackspace,
    this.enabled = true,
  });

  /// Digit buttons get keys `'${digitKeyPrefix}_0'` .. `'${digitKeyPrefix}_9'`.
  final String digitKeyPrefix;

  /// Key for the backspace button.
  final String backspaceKey;

  final ValueChanged<int> onDigit;
  final VoidCallback onBackspace;
  final bool enabled;

  Widget _buildKey(BuildContext context, {Key? key, Widget? child, VoidCallback? onPressed}) {
    final theme = Theme.of(context);
    return SizedBox(
      width: 76,
      height: 76,
      child: Material(
        key: key,
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: enabled ? onPressed : null,
          child: Center(
            child: DefaultTextStyle(
              style: theme.textTheme.headlineSmall!.copyWith(fontWeight: FontWeight.w600),
              child: child ?? const SizedBox.shrink(),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final rows = <List<Widget>>[
      for (var row = 0; row < 3; row++)
        [
          for (var col = 0; col < 3; col++)
            _buildKey(
              context,
              key: Key('${digitKeyPrefix}_${row * 3 + col + 1}'),
              onPressed: () => onDigit(row * 3 + col + 1),
              child: Text('${row * 3 + col + 1}'),
            ),
        ],
    ];

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final row in rows) Row(mainAxisAlignment: MainAxisAlignment.center, children: row),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(width: 76, height: 76),
            _buildKey(
              context,
              key: Key('${digitKeyPrefix}_0'),
              onPressed: () => onDigit(0),
              child: const Text('0'),
            ),
            _buildKey(
              context,
              key: Key(backspaceKey),
              onPressed: onBackspace,
              child: Icon(Icons.backspace_outlined, color: theme.colorScheme.onSurface, size: 22),
            ),
          ],
        ),
      ],
    );
  }
}
