import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../application/language_provider.dart';
import '../../domain/language_option.dart';

/// Card for the Settings screen listing every [supportedLanguages] entry.
/// Infra-only scaffold — only English has real content today, so
/// unavailable rows are shown greyed-out with a "Coming soon" badge and are
/// non-tappable. Matches the border/padding/rounded-corner convention of
/// `_AppearanceCard` in settings_screen.dart.
class LanguageSection extends ConsumerWidget {
  const LanguageSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final selected = ref.watch(languageProvider);

    return Container(
      decoration: BoxDecoration(
        color: theme.cardTheme.color ?? theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.5)),
      ),
      child: Column(
        key: const Key('languageOptionsList'),
        children: [
          for (var i = 0; i < supportedLanguages.length; i++) ...[
            if (i > 0) const Divider(height: 1),
            _LanguageRow(
              option: supportedLanguages[i],
              selected: supportedLanguages[i].code == selected,
            ),
          ],
        ],
      ),
    );
  }
}

class _LanguageRow extends ConsumerWidget {
  const _LanguageRow({required this.option, required this.selected});

  final LanguageOption option;
  final bool selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final disabledColor = theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5);

    return ListTile(
      key: Key('languageRow_${option.code}'),
      enabled: option.available,
      title: Text(
        option.label,
        style: theme.textTheme.bodyMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: option.available ? null : disabledColor,
        ),
      ),
      trailing: option.available
          ? (selected
              ? Icon(Icons.check_circle, color: AppColors.primary, key: const Key('languageSelectedCheck'))
              : const Icon(Icons.radio_button_unchecked))
          : Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'Coming soon',
                style: TextStyle(color: disabledColor, fontWeight: FontWeight.w700, fontSize: 10.5, letterSpacing: 0.3),
              ),
            ),
      onTap: option.available ? () => ref.read(languageProvider.notifier).setLanguageCode(option.code) : null,
    );
  }
}
