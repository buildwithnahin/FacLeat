import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../storage/secure_storage.dart';

/// Holds the user's preferred [ThemeMode] (light / dark / system), defaulting
/// to `system` and persisting the choice to secure storage under
/// `theme_mode`, restoring it on app start.
class ThemeModeController extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    unawaited(_restore());
    return ThemeMode.system;
  }

  Future<void> _restore() async {
    final stored = await ref.read(secureStorageProvider).getThemeMode();
    if (stored == null) return;
    state = _parse(stored);
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    state = mode;
    await ref.read(secureStorageProvider).setThemeMode(mode.name);
  }

  ThemeMode _parse(String value) {
    return ThemeMode.values.firstWhere(
      (mode) => mode.name == value,
      orElse: () => ThemeMode.system,
    );
  }
}

final NotifierProvider<ThemeModeController, ThemeMode> themeModeProvider =
    NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);
