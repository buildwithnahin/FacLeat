import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/app_lock_controller.dart';
import '../domain/app_lock_status.dart';
import 'widgets/pin_pad.dart';

enum _ChangeStage { current, enter, confirm }

/// "Change PIN" flow, pushed from Settings' App Lock section (only visible
/// once App Lock is already enabled). Three steps: verify the current PIN,
/// enter a new one, confirm it — reusing the same PIN pad convention as the
/// lock and setup screens.
class AppLockChangePinScreen extends ConsumerStatefulWidget {
  const AppLockChangePinScreen({super.key});

  @override
  ConsumerState<AppLockChangePinScreen> createState() => _AppLockChangePinScreenState();
}

class _AppLockChangePinScreenState extends ConsumerState<AppLockChangePinScreen> {
  _ChangeStage _stage = _ChangeStage.current;
  final List<int> _digits = [];
  String? _currentPin;
  String? _newPin;
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

    switch (_stage) {
      case _ChangeStage.current:
        setState(() {
          _currentPin = pin;
          _digits.clear();
          _stage = _ChangeStage.enter;
        });
        return;
      case _ChangeStage.enter:
        setState(() {
          _newPin = pin;
          _digits.clear();
          _stage = _ChangeStage.confirm;
        });
        return;
      case _ChangeStage.confirm:
        if (pin != _newPin) {
          setState(() {
            _error = "New PINs don't match — try again";
            _digits.clear();
            _newPin = null;
            _stage = _ChangeStage.enter;
            _shakeCount++;
          });
          return;
        }
        await _submit();
    }
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await ref.read(appLockControllerProvider.notifier).changePin(_currentPin!, _newPin!);
      if (!mounted) return;
      Navigator.of(context).pop();
    } on AppLockException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.message;
        _digits.clear();
        _currentPin = null;
        _newPin = null;
        _stage = _ChangeStage.current;
        _shakeCount++;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'Something went wrong. Please try again.';
        _digits.clear();
        _currentPin = null;
        _newPin = null;
        _stage = _ChangeStage.current;
        _shakeCount++;
      });
    }
  }

  String get _title {
    switch (_stage) {
      case _ChangeStage.current:
        return 'Enter your current PIN';
      case _ChangeStage.enter:
        return 'Choose a new PIN';
      case _ChangeStage.confirm:
        return 'Confirm your new PIN';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Change PIN')),
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
                    child: const Icon(Icons.password_outlined, color: Colors.white, size: 32),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _title,
                    key: const Key('appLockChangePinTitle'),
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
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
                            key: const Key('appLockChangePinErrorText'),
                            style: TextStyle(color: theme.colorScheme.error, fontWeight: FontWeight.w600),
                          )
                        : null,
                  ),
                  const SizedBox(height: 20),
                  PinPad(
                    digitKeyPrefix: 'appLockChangePinDigit',
                    backspaceKey: 'appLockChangePinBackspace',
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
