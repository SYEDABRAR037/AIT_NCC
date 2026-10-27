import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../auth/providers/auth_provider.dart';
import '../../leave/models/leave_model.dart';
import '../../leave/providers/leave_provider.dart';

class StaffLeaveReviewScreen extends StatefulWidget {
  const StaffLeaveReviewScreen({super.key});

  @override
  State<StaffLeaveReviewScreen> createState() => _StaffLeaveReviewScreenState();
}

class _StaffLeaveReviewScreenState extends State<StaffLeaveReviewScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LeaveProvider>().fetchReviewLeaves();
    });
  }

  bool _isCurrentStage(String role, String status) {
    switch (role) {
      case 'SENIOR':
        return status == 'SUBMITTED' || status == 'SENIOR_REVIEW';
      case 'PLATOON_SENIOR':
        return status == 'PLATOON_SENIOR_REVIEW';
      case 'ADMIN_ANO':
        return status == 'ANO_REVIEW';
      default:
        return false;
    }
  }

  List<String> _actions(String role) => switch (role) {
    'SENIOR' || 'PLATOON_SENIOR' => ['FORWARD', 'RETURN', 'REJECT', 'HOLD'],
    'ADMIN_ANO' => ['APPROVE', 'RETURN', 'REJECT', 'HOLD'],
    _ => const [],
  };

  Future<void> _review(
    LeaveModel leave,
    String action,
    LeaveProvider provider,
  ) async {
    final remarks = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('$action leave request'),
        content: TextField(
          controller: remarks,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: action == 'REJECT' || action == 'RETURN'
                ? 'Reason (recommended)'
                : 'Remarks (optional)',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) {
      remarks.dispose();
      return;
    }
    final success = await provider.processReview(
      leaveId: leave.id,
      action: action,
      remarks: remarks.text,
    );
    remarks.dispose();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          success
              ? 'Leave request updated.'
              : (provider.reviewErrorMessage ?? 'Leave review failed.'),
        ),
        backgroundColor: success ? AppColors.success : AppColors.error,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<LeaveProvider>();
    final role = context.watch<AuthProvider>().currentUser?.role ?? '';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave Review'),
        actions: [
          IconButton(
            onPressed: provider.fetchReviewLeaves,
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: provider.isLoadingReview && provider.reviewLeaves.isEmpty
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.navyPrimary),
            )
          : provider.reviewErrorMessage != null && provider.reviewLeaves.isEmpty
          ? _loadError(provider)
          : RefreshIndicator(
              onRefresh: provider.fetchReviewLeaves,
              child: provider.reviewLeaves.isEmpty
                  ? ListView(
                      children: const [
                        SizedBox(height: 180),
                        Center(child: Text('No leave applications to review.')),
                      ],
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: provider.reviewLeaves.length,
                      itemBuilder: (_, index) {
                        final leave = provider.reviewLeaves[index];
                        return _leaveCard(leave, role, provider);
                      },
                    ),
            ),
    );
  }

  Widget _loadError(LeaveProvider provider) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(provider.reviewErrorMessage!, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: provider.fetchReviewLeaves,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    ),
  );

  Widget _leaveCard(LeaveModel leave, String role, LeaveProvider provider) {
    final currentStage = _isCurrentStage(role, leave.status);
    final actions = currentStage ? _actions(role) : const <String>[];
    final dates =
        '${DateFormat('dd MMM yyyy').format(leave.startDate)} – ${DateFormat('dd MMM yyyy').format(leave.endDate)}';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    leave.applicantName ?? 'Cadet',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.navyPrimary,
                    ),
                  ),
                ),
                Chip(label: Text(leave.status.replaceAll('_', ' '))),
              ],
            ),
            if (leave.applicantRegimentalNumber != null)
              Text(
                '${leave.applicantRegimentalNumber}${leave.applicantPlatoon == null ? '' : ' • ${leave.applicantPlatoon}'}',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            const SizedBox(height: 8),
            Text(
              '${leave.leaveType} • $dates',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Text(leave.reason),
            for (final review in leave.reviewHistory)
              if (review.remarks?.isNotEmpty == true)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    '${review.reviewerRole} ${review.action}: ${review.remarks}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: actions
                    .map(
                      (action) => OutlinedButton(
                        onPressed: () => _review(leave, action, provider),
                        child: Text(action),
                      ),
                    )
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
