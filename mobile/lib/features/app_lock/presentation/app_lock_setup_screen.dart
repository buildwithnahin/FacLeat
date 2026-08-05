import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/app_lock_controller.dart';
import 'widgets/pin_pad.dart';

enum _SetupStage { enter, confirm }

/// "Set a PIN" flow, pushed from Settings when the user flips the App Lock
/// toggle on. Two steps — enter, then confirm — matching the change-PIN and
/// verify-PIN screens' visual language. On success, calls
/// `AppLockController.enable` and pops back to the caller (Settings), which
/// decides what happens next.
class AppLockSetupScreen extends ConsumerStatefulWidget {
  const AppLockSetupScreen({super.key});

  @override
  ConsumerState<AppLockSetupScreen> createState() => _AppLockSetupScreenState();
}

class _AppLockSetupScreenState extends ConsumerState<AppLockSetupScreen> {
  _SetupStage _stage = _SetupStage.enter;
  final List<int> _digits = [];
  String? _firstPin;
  String? _error;
  bool _saving = false;
  int _shakeCount = 0;

  void _onDigit(int digit) {
    if (_saving || _digits.length >= appLockPinLength) return;
    setState(() {
      _error = null;
      _digits.add(digit);
    });
    if (_digits.length == appLockPinLength) {
      _onPinComplete();
    }
  }

  void _onBackspace() {
    if (_saving || _digits.isEmpty) return;
    setState(() {
      _error = null;
      _digits.removeLast();
    });
  }

  Future<void> _onPinComplete() async {
    final pin = _digits.join();
    if (_stage == _SetupStage.enter) {
      setState(() {
        _firstPin = pin;
        _digits.clear();
        _stage = _SetupStage.confirm;
      });
      return;
    }

    if (pin != _firstPin) {
      setState(() {
        _error = "PINs don't match — try again";
        _digits.clear();
        _firstPin = null;
        _stage = _SetupStage.enter;
        _shakeCount++;
      });
      return;
    }

    setState(() => _saving = true);
    await ref.read(appLockControllerProvider.notifier).enable(pin);
    if (!mounted) return;
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isConfirm = _stage == _SetupStage.confirm;

    return Scaffold(
      appBar: AppBar(title: const Text('Set a PIN')),
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
                    child: Icon(
                      isConfirm ? Icons.check_circle_outline : Icons.pin_outlined,
                      color: Colors.white,
                      size: 32,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    isConfirm ? 'Confirm your PIN' : 'Choose a PIN',
                    key: const Key('appLockSetupTitle'),
                    style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isConfirm
                        ? 'Enter the same $appLockPinLength digits again'
                        : 'This PIN unlocks the app after it\'s closed or backgrounded',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 32),
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
                            key: const Key('appLockSetupErrorText'),
                            style: TextStyle(color: theme.colorScheme.error, fontWeight: FontWeight.w600),
                          )
                        : null,
                  ),
                  const SizedBox(height: 20),
                  PinPad(
                    digitKeyPrefix: 'appLockSetupPinDigit',
                    backspaceKey: 'appLockSetupBackspace',
                    onDigit: _onDigit,
                    onBackspace: _onBackspace,
                    enabled: !_saving,
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
