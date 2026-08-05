import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../reports/application/report_provider.dart';
import '../../users/application/users_providers.dart';
import '../application/announcements_providers.dart';
import '../data/announcements_repository.dart';

const int _kTitleMaxLength = 200;
const int _kBodyMaxLength = 5000;

enum _Audience { all, branch, department, user }

extension on _Audience {
  String get apiValue {
    switch (this) {
      case _Audience.all:
        return 'ALL';
      case _Audience.branch:
        return 'BRANCH';
      case _Audience.department:
        return 'DEPARTMENT';
      case _Audience.user:
        return 'USER';
    }
  }

  String get label {
    switch (this) {
      case _Audience.all:
        return 'All';
      case _Audience.branch:
        return 'Branch';
      case _Audience.department:
        return 'Department';
      case _Audience.user:
        return 'User';
    }
  }
}

enum _SendState { idle, sending, sent }

/// Compose screen for broadcasting a new announcement to all users, one
/// branch, one department (free-text), or one specific user.
class AnnouncementComposeScreen extends ConsumerStatefulWidget {
  const AnnouncementComposeScreen({super.key});

  @override
  ConsumerState<AnnouncementComposeScreen> createState() => _AnnouncementComposeScreenState();
}

class _AnnouncementComposeScreenState extends ConsumerState<AnnouncementComposeScreen> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  final _departmentController = TextEditingController();

  _Audience _audience = _Audience.all;
  String? _branchId;
  String? _userId;

  _SendState _sendState = _SendState.idle;
  String? _errorMessage;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    _departmentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final body = _bodyController.text.trim();

    String? validationError;
    if (title.isEmpty) {
      validationError = 'Title is required';
    } else if (title.length > _kTitleMaxLength) {
      validationError = 'Title must be $_kTitleMaxLength characters or fewer';
    } else if (body.isEmpty) {
      validationError = 'Message is required';
    } else if (body.length > _kBodyMaxLength) {
      validationError = 'Message must be $_kBodyMaxLength characters or fewer';
    } else if (_audience == _Audience.branch && _branchId == null) {
      validationError = 'Select a branch';
    } else if (_audience == _Audience.department && _departmentController.text.trim().isEmpty) {
      validationError = 'Enter a department';
    } else if (_audience == _Audience.user && _userId == null) {
      validationError = 'Select a user';
    }

    if (validationError != null) {
      setState(() => _errorMessage = validationError);
      return;
    }

    setState(() {
      _sendState = _SendState.sending;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(announcementsRepositoryProvider);
      final result = await repo.create(
        title: title,
        body: body,
        audienceType: _audience.apiValue,
        audienceBranchId: _audience == _Audience.branch ? _branchId : null,
        audienceDepartment:
            _audience == _Audience.department ? _departmentController.text.trim() : null,
        audienceUserId: _audience == _Audience.user ? _userId : null,
      );

      ref.invalidate(announcementsListProvider);
      HapticFeedback.mediumImpact();

      if (!mounted) return;
      setState(() => _sendState = _SendState.sent);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Announcement sent to ${result.recipientCount ?? 0} recipients')),
      );
      await Future<void>.delayed(const Duration(milliseconds: 400));
      if (!mounted) return;
      if (context.canPop()) {
        context.pop();
      }
    } on AnnouncementApiException catch (e) {
      setState(() {
        _sendState = _SendState.idle;
        _errorMessage = e.message;
      });
    } catch (_) {
      setState(() {
        _sendState = _SendState.idle;
        _errorMessage = 'Something went wrong. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final busy = _sendState == _SendState.sending;

    return Scaffold(
      appBar: AppBar(title: const Text('New announcement')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
        children: [
          TextField(
            key: const Key('announcementTitleField'),
            controller: _titleController,
            enabled: !busy,
            maxLength: _kTitleMaxLength,
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          const SizedBox(height: 4),
          TextField(
            key: const Key('announcementBodyField'),
            controller: _bodyController,
            enabled: !busy,
            maxLines: 6,
            maxLength: _kBodyMaxLength,
            decoration: const InputDecoration(
              labelText: 'Message',
              alignLabelWithHint: true,
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Text('Audience', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          SegmentedButton<_Audience>(
            key: const Key('announcementAudienceSegment'),
            segments: [
              for (final option in _Audience.values)
                ButtonSegment(value: option, label: Text(option.label)),
            ],
            selected: {_audience},
            onSelectionChanged: busy
                ? null
                : (selection) => setState(() {
                      _audience = selection.first;
                      _errorMessage = null;
                    }),
          ),
          const SizedBox(height: 12),
          _AudiencePicker(
            audience: _audience,
            branchId: _branchId,
            onBranchChanged: (value) => setState(() => _branchId = value),
            departmentController: _departmentController,
            userId: _userId,
            onUserChanged: (value) => setState(() => _userId = value),
            enabled: !busy,
          ),
          if (_errorMessage != null)
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Text(
                _errorMessage!,
                key: const Key('announcementFormErrorText'),
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ).animate().shakeX(hz: 4, amount: 6),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: _SendButton(state: _sendState, onPressed: _submit),
        ),
      ),
    );
  }
}

/// The conditional second picker shown under the audience segmented button:
/// a branch dropdown, a free-text department field, or a user dropdown —
/// nothing for `ALL`.
class _AudiencePicker extends ConsumerWidget {
  const _AudiencePicker({
    required this.audience,
    required this.branchId,
    required this.onBranchChanged,
    required this.departmentController,
    required this.userId,
    required this.onUserChanged,
    required this.enabled,
  });

  final _Audience audience;
  final String? branchId;
  final ValueChanged<String?> onBranchChanged;
  final TextEditingController departmentController;
  final String? userId;
  final ValueChanged<String?> onUserChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    switch (audience) {
      case _Audience.all:
        return const SizedBox.shrink();

      case _Audience.branch:
        final branchesAsync = ref.watch(branchesProvider);
        return branchesAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: LinearProgressIndicator(),
          ),
          error: (error, stackTrace) => Text(
            'Could not load branches',
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
          data: (branches) => DropdownButtonFormField<String>(
            key: const Key('announcementBranchDropdown'),
            initialValue: branchId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Branch'),
            items: [
              for (final branch in branches)
                DropdownMenuItem(value: branch.id, child: Text(branch.name)),
            ],
            onChanged: enabled ? onBranchChanged : null,
          ),
        );

      case _Audience.department:
        return TextField(
          key: const Key('announcementDepartmentField'),
          controller: departmentController,
          enabled: enabled,
          decoration: const InputDecoration(
            labelText: 'Department',
            hintText: 'e.g. Sales, Accounts, HR',
          ),
        );

      case _Audience.user:
        final usersAsync = ref.watch(usersListProvider);
        return usersAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: LinearProgressIndicator(),
          ),
          error: (error, stackTrace) => Text(
            'Could not load users',
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
          data: (users) => DropdownButtonFormField<String>(
            key: const Key('announcementUserDropdown'),
            initialValue: userId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'User'),
            items: [
              for (final user in users)
                DropdownMenuItem(value: user.id, child: Text('${user.name} (${user.email})')),
            ],
            onChanged: enabled ? onUserChanged : null,
          ),
        );
    }
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({required this.state, required this.onPressed});

  final _SendState state;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      key: const Key('sendAnnouncementButton'),
      onPressed: state == _SendState.sending ? null : onPressed,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        transitionBuilder: (child, animation) => ScaleTransition(scale: animation, child: child),
        child: switch (state) {
          _SendState.idle => const Text('Send', key: ValueKey('idle')),
          _SendState.sending => const SizedBox(
              key: ValueKey('sending'),
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
            ),
          _SendState.sent => const Icon(Icons.check, key: ValueKey('sent'), color: Colors.white),
        },
      ),
    );
  }
}
