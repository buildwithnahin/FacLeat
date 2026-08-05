import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/secure_storage.dart';

/// Holds the user's preferred language code (default `'en'`), persisting the
/// choice to secure storage and restoring it on app start — mirrors
/// [ThemeModeController]'s restore-then-write-through pattern. Infra-only
/// scaffold: only `'en'` has real content right now (see
/// `domain/language_option.dart`).
class LanguageController extends Notifier<String> {
  @override
  String build() {
    unawaited(_restore());
    return 'en';
  }

  Future<void> _restore() async {
    final stored = await ref.read(secureStorageProvider).getLanguageCode();
    state = stored;
  }

  Future<void> setLanguageCode(String code) async {
    state = code;
    await ref.read(secureStorageProvider).setLanguageCode(code);
  }
}

final NotifierProvider<LanguageController, String> languageProvider =
    NotifierProvider<LanguageController, String>(LanguageController.new);
