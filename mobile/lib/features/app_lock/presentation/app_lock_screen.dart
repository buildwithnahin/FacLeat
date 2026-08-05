import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../auth/application/auth_controller.dart';
import '../application/app_lock_controller.dart';
import 'widgets/pin_pad.dart';

/// Full-screen PIN (+ optional biometric) gate shown whenever
/// `appLockControllerProvider`'s status is `AppLockStatus.locked`. The
/// router is expected to route here in place of any authenticated screen
/// while locked — see the integration note on `AppLockController`.
///
/// Biometric unlock is offered as a shortcut on top of the PIN, never a
/// replacement: the PIN pad is always visible underneath, and the only
/// other way out is the explicit "Log out instead" escape hatch at the
/// bottom (for a forgotten PIN) — there is no way to silently bypass the
/// lock.
class AppLockScreen extends ConsumerStatefulWidget {
  const AppLockScreen({super.key});

  @override
  ConsumerState<AppLockScreen> createState() => _AppLockScreenState();
}

class _AppLockScreenState extends ConsumerState<AppLockScreen> {
  final List<int> _digits = [];
  bool _biometricAvailable = false;
  bool _biometricChecked = false;
  bool _verifying = false;
  String? _error;
  int _shakeCount = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initBiometric());
  }

  Future<void> _initBiometric() async {
    final controller = ref.read(appLockControllerProvider.notifier);
    final available = await controller.isBiometricAvailable();
    if (!mounted) return;
    setState(() {
      _biometricAvailable = available;
      _biometricChecked = true;
    });
    if (available) {
      // Convenience auto-prompt on entry — the PIN pad stays visible as the
      // fallback the whole time, so a cancel/failure here is a no-op.
      unawaited(_attemptBiometric());
    }
  }

  Future<void> _attemptBiometric() async {
    final controller = ref.read(appLockControllerProvider.notifier);
    await controller.tryBiometricUnlock();
    // No success/failure branching needed here: on success the controller's
    // status flips to `unlocked` and the router (once wired) navigates
    // away; on failure nothing changes and the PIN pad is already visible.
  }

  void _onDigit(int digit) {
    if (_verifying || _digits.length >= appLockPinLength) return;
    setState(() {
      _error = null;
      _digits.add(digit);
    });
    if (_digits.length == appLockPinLength) {
      _submit();
    }
  }

  void _onBackspace() {
    if (_verifying || _digits.isEmpty) return;
    setState(() {
      _error = null;
      _digits.removeLast();
    });
  }

  Future<void> _submit() async {
    setState(() => _verifying = true);
    final pin = _digits.join();
    final ok = await ref.read(appLockControllerProvider.notifier).verifyPin(pin);
    if (!mounted) return;
    if (!ok) {
      setState(() {
        _verifying = false;
        _error = 'Incorrect PIN';
        _digits.clear();
        _shakeCount++;
      });
    } else {
      setState(() => _verifying = false);
    }
  }

  Future<void> _logoutInstead() async {
    await ref.read(appLockControllerProvider.notifier).disable();
    await ref.read(authControllerProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: const Icon(Icons.lock_outline, color: Colors.white, size: 32),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Annex Admin is locked',
                    style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Enter your PIN to continue',
                    style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 32),
                  if (_biometricChecked && _biometricAvailable) ...[
                    IconButton(
                      key: const Key('appLockBiometricButton'),
                      onPressed: _verifying ? null : _attemptBiometric,
                      iconSize: 40,
                      icon: Icon(Icons.fingerprint, color: theme.colorScheme.primary),
                      tooltip: 'Use biometric unlock',
                    ),
                    const SizedBox(height: 8),
                  ],
                  _shakeCount == 0
                      ? PinDotsIndicator(filledCount: _digits.length)
                      : Container(
                          key: ValueKey(_shakeCount),
                          child: PinDotsIndicator(filledCount: _digits.length),
                        ).animate().shakeX(hz: 5, amount: 8),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 20,
                    child: _error != null
                        ? Text(
                            _error!,
                            key: const Key('appLockErrorText'),
                            style: TextStyle(color: theme.colorScheme.error, fontWeight: FontWeight.w600),
                          )
                        : null,
                  ),
                  const SizedBox(height: 20),
                  PinPad(
                    digitKeyPrefix: 'appLockPinDigit',
                    backspaceKey: 'appLockBackspace',
                    onDigit: _onDigit,
                    onBackspace: _onBackspace,
                    enabled: !_verifying,
                  ),
                  const SizedBox(height: 24),
                  TextButton(
                    key: const Key('appLockLogoutInstead'),
                    onPressed: _logoutInstead,
                    style: TextButton.styleFrom(foregroundColor: AppColors.danger),
                    child: const Text('Log out instead'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
