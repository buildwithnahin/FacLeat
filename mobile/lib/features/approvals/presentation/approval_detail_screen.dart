import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/app_colors.dart';
import '../../dashboard/application/me_provider.dart';
import '../application/approvals_providers.dart';
import '../data/approvals_repository.dart';
import '../domain/approval_request.dart';
import 'approvals_list_screen.dart' show approvalStatusColor, approvalStatusLabel;

enum _Decision { approve, reject, requestChanges, cancel }

class ApprovalDetailScreen extends ConsumerStatefulWidget {
  const ApprovalDetailScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<ApprovalDetailScreen> createState() => _ApprovalDetailScreenState();
}

class _ApprovalDetailScreenState extends ConsumerState<ApprovalDetailScreen> {
  final _noteController = TextEditingController();
  _Decision? _submitting;

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _decide(_Decision decision) async {
    final labels = {
      _Decision.approve: ('Approve this request?', 'Approve', AppColors.success),
      _Decision.reject: ('Reject this request?', 'Reject', AppColors.danger),
      _Decision.requestChanges: ('Request changes on this request?', 'Request changes', AppColors.warning),
      _Decision.cancel: ('Cancel this request?', 'Cancel request', AppColors.danger),
    };
    final (title, actionLabel, color) = labels[decision]!;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: const Text('This action will be recorded and cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Back'),
          ),
          FilledButton(
            key: const Key('confirmDecisionButton'),
            style: FilledButton.styleFrom(backgroundColor: color),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(actionLabel),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _submitting = decision);
    try {
      final repo = ref.read(approvalsRepositoryProvider);
      final note = _noteController.text.trim();
      switch (decision) {
        case _Decision.approve:
          await repo.approve(widget.id, note: note.isEmpty ? null : note);
        case _Decision.reject:
          await repo.reject(widget.id, note: note.isEmpty ? null : note);
        case _Decision.requestChanges:
          await repo.requestChanges(widget.id, note: note.isEmpty ? null : note);
        case _Decision.cancel:
          await repo.cancel(widget.id, note: note.isEmpty ? null : note);
      }
      ref.invalidate(approvalDetailProvider(widget.id));
      ref.invalidate(approvalsListProvider);
      ref.invalidate(approvalQueueStatsProvider);
      HapticFeedback.lightImpact();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_successMessage(decision)),
          backgroundColor: color,
        ),
      );
    } on ApprovalApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Could not submit your decision')));
    } finally {
      if (mounted) setState(() => _submitting = null);
    }
  }

  String _successMessage(_Decision decision) {
    switch (decision) {
      case _Decision.approve:
        return 'Request approved';
      case _Decision.reject:
        return 'Request rejected';
      case _Decision.requestChanges:
        return 'Changes requested';
      case _Decision.cancel:
        return 'Request cancelled';
    }
  }

  @override
  Widget build(BuildContext context) {
    final requestAsync = ref.watch(approvalDetailProvider(widget.id));
    final meAsync = ref.watch(meProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Approval request')),
      body: requestAsync.when(
        loading: () => const _ApprovalDetailShimmer(),
        error: (error, stackTrace) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline, size: 40, color: Theme.of(context).colorScheme.error),
                const SizedBox(height: 12),
                const Text('Could not load this request'),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => ref.invalidate(approvalDetailProvider(widget.id)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (request) => _ApprovalDetailBody(
          request: request,
          currentUserId: meAsync.valueOrNull?.id,
          noteController: _noteController,
          submitting: _submitting,
          onDecide: _decide,
        ),
      ),
    );
  }
}

class _ApprovalDetailBody extends StatelessWidget {
  const _ApprovalDetailBody({
    required this.request,
    required this.currentUserId,
    required this.noteController,
    required this.submitting,
    required this.onDecide,
  });

  final ApprovalRequest request;
  final String? currentUserId;
  final TextEditingController noteController;
  final _Decision? submitting;
  final Future<void> Function(_Decision) onDecide;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final formatter = DateFormat('yyyy-MM-dd · HH:mm');
    final amountValue = request.amountValue;
    final isRequester = currentUserId != null && currentUserId == request.requestedById;
    final canDecide = request.isDecidable;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                request.title,
                key: const Key('approvalDetailTitle'),
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(width: 8),
            _StatusBadgeLarge(status: request.status),
          ],
        ).animate().fadeIn(duration: 300.ms).slideY(begin: 0.08, end: 0),
        const SizedBox(height: 4),
        Text(
          '${request.module} · ${request.action} · ${request.entityType}',
          style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        if (request.summary != null && request.summary!.isNotEmpty) ...[
          _DetailSection(
            title: 'Summary',
            children: [
              Text(request.summary!, style: theme.textTheme.bodyMedium),
            ],
          ),
          const SizedBox(height: 16),
        ],
        _DetailSection(
          title: 'Request details',
          children: [
            _DetailRow(icon: Icons.person_outline, label: 'Requested by', value: request.requestedBy?.name ?? 'Unknown'),
            if (amountValue != null)
              _DetailRow(
                icon: Icons.payments_outlined,
                label: 'Amount',
                value: '${NumberFormat.decimalPattern().format(amountValue)}${request.currency != null ? ' ${request.currency}' : ''}',
              ),
            _DetailRow(icon: Icons.tag, label: 'Entity', value: '${request.entityType} · ${request.entityId}'),
            _DetailRow(icon: Icons.schedule, label: 'Requested', value: formatter.format(request.createdAt)),
            if (request.decidedAt != null)
              _DetailRow(icon: Icons.event_available_outlined, label: 'Decided', value: formatter.format(request.decidedAt!)),
            if (request.note != null && request.note!.isNotEmpty)
              _DetailRow(icon: Icons.notes_outlined, label: 'Note', value: request.note!),
          ],
        ),
        const SizedBox(height: 16),
        _DetailSection(
          title: 'Approval chain',
          children: [
            if (request.steps.isEmpty)
              Text('No steps recorded', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant))
            else
              Column(
                key: const Key('approvalStepsList'),
                children: [
                  for (var i = 0; i < request.steps.length; i++)
                    _StepRow(step: request.steps[i], isLast: i == request.steps.length - 1),
                ],
              ),
          ],
        ),
        const SizedBox(height: 16),
        if (canDecide)
          _DecisionPanel(
            noteController: noteController,
            submitting: submitting,
            canDecide: canDecide,
            showCancel: isRequester && canDecide,
            onDecide: onDecide,
          ),
      ],
    );
  }
}

class _StatusBadgeLarge extends StatelessWidget {
  const _StatusBadgeLarge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = approvalStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        approvalStatusLabel(status),
        style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12, letterSpacing: 0.3),
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.step, required this.isLast});

  final ApprovalStep step;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = approvalStatusColor(step.status);
    final formatter = DateFormat('yyyy-MM-dd · HH:mm');

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 12,
                height: 12,
                margin: const EdgeInsets.only(top: 3),
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 2),
                    color: theme.dividerColor.withValues(alpha: 0.4),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Step ${step.sequence} · ${step.approverRole}',
                        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(width: 8),
                      _StatusBadgeLarge(status: step.status),
                    ],
                  ),
                  if (step.decidedAt != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Decided ${formatter.format(step.decidedAt!)}',
                      style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                  if (step.note != null && step.note!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(step.note!, style: theme.textTheme.bodySmall),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DecisionPanel extends StatelessWidget {
  const _DecisionPanel({
    required this.noteController,
    required this.submitting,
    required this.canDecide,
    required this.showCancel,
    required this.onDecide,
  });

  final TextEditingController noteController;
  final _Decision? submitting;
  final bool canDecide;
  final bool showCancel;
  final Future<void> Function(_Decision) onDecide;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final busy = submitting != null;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Decision', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            TextField(
              key: const Key('approvalNoteField'),
              controller: noteController,
              maxLines: 3,
              enabled: !busy,
              decoration: const InputDecoration(
                hintText: 'Add a note (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            if (canDecide) ...[
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      key: const Key('approveButton'),
                      style: FilledButton.styleFrom(backgroundColor: AppColors.success),
                      onPressed: busy ? null : () => onDecide(_Decision.approve),
                      icon: submitting == _Decision.approve
                          ? const _ButtonSpinner()
                          : const Icon(Icons.check),
                      label: const Text('Approve'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      key: const Key('rejectButton'),
                      style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
                      onPressed: busy ? null : () => onDecide(_Decision.reject),
                      icon: submitting == _Decision.reject
                          ? const _ButtonSpinner()
                          : const Icon(Icons.close),
                      label: const Text('Reject'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  key: const Key('requestChangesButton'),
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.warning, side: const BorderSide(color: AppColors.warning)),
                  onPressed: busy ? null : () => onDecide(_Decision.requestChanges),
                  icon: submitting == _Decision.requestChanges
                      ? const _ButtonSpinner(color: AppColors.warning)
                      : const Icon(Icons.edit_note_outlined),
                  label: const Text('Request changes'),
                ),
              ),
            ],
            if (showCancel) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  key: const Key('cancelRequestButton'),
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger, side: const BorderSide(color: AppColors.danger)),
                  onPressed: busy ? null : () => onDecide(_Decision.cancel),
                  icon: submitting == _Decision.cancel
                      ? const _ButtonSpinner(color: AppColors.danger)
                      : const Icon(Icons.block),
                  label: const Text('Cancel request'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ButtonSpinner extends StatelessWidget {
  const _ButtonSpinner({this.color = Colors.white});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 16,
      height: 16,
      child: CircularProgressIndicator(strokeWidth: 2, color: color),
    );
  }
}

class _DetailSection extends StatelessWidget {
  const _DetailSection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: theme.textTheme.bodyMedium),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _ApprovalDetailShimmer extends StatelessWidget {
  const _ApprovalDetailShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (var i = 0; i < 4; i++)
          Shimmer.fromColors(
            baseColor: base,
            highlightColor: highlight,
            child: Container(
              height: 90,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(16)),
            ),
          ),
      ],
    );
  }
}
