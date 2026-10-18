import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../models/staff_models.dart';
import '../providers/staff_provider.dart';

class StaffApprovalsScreen extends StatefulWidget {
  const StaffApprovalsScreen({super.key});

  @override
  State<StaffApprovalsScreen> createState() => _StaffApprovalsScreenState();
}

class _StaffApprovalsScreenState extends State<StaffApprovalsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<StaffProvider>(context, listen: false);
      if (provider.pendingApprovals.isEmpty) {
        provider.fetchPendingApprovals();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<StaffProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cadet Registration Approvals'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: () => provider.fetchPendingApprovals(),
          ),
        ],
      ),
      body: provider.isLoadingApprovals && provider.pendingApprovals.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.navyPrimary))
          : RefreshIndicator(
              onRefresh: () => provider.fetchPendingApprovals(),
              color: AppColors.navyPrimary,
              child: provider.pendingApprovals.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: provider.pendingApprovals.length,
                      itemBuilder: (ctx, i) => _buildApplicationCard(provider.pendingApprovals[i], provider),
                    ),
            ),
    );
  }

  Widget _buildApplicationCard(PendingApprovalModel app, StaffProvider provider) {
    final dateFormatted = app.createdAt != null
        ? DateFormat('dd MMM yyyy').format(app.createdAt!)
        : 'Submitted';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  app.fullName,
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppColors.navyPrimary),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    app.status,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 10, color: AppColors.warning),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),

            Text(
              'Regimental No: ${app.regimentalNumber}',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 2),

            Text(
              'Roll No: ${app.collegeRollNumber} • ${app.platoonName ?? "Platoon"} • ${app.year ?? "Year"}',
              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
            const SizedBox(height: 4),

            Text(
              'Email: ${app.email} • Applied: $dateFormatted',
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
            const SizedBox(height: 14),

            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                    onPressed: () => _openReviewDialog(context, app, 'APPROVE', provider),
                    child: const Text('APPROVE', style: TextStyle(fontSize: 12)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(foregroundColor: AppColors.error),
                    onPressed: () => _openReviewDialog(context, app, 'REJECT', provider),
                    child: const Text('REJECT', style: TextStyle(fontSize: 12)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _openReviewDialog(BuildContext context, PendingApprovalModel app, String action, StaffProvider provider) {
    final remarksController = TextEditingController(text: action == 'APPROVE' ? 'Application documents verified.' : '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('$action Application', style: const TextStyle(fontWeight: FontWeight.w800)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Cadet: ${app.fullName} (${app.regimentalNumber})'),
            const SizedBox(height: 12),
            TextField(
              controller: remarksController,
              decoration: const InputDecoration(labelText: 'Review Remarks / Reason'),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: action == 'APPROVE' ? AppColors.success : AppColors.error,
            ),
            onPressed: () async {
              final remarks = remarksController.text.trim();
              final messenger = ScaffoldMessenger.of(context);
              Navigator.pop(ctx);
              final success = await provider.processApprovalAction(
                cadetId: app.id,
                action: action,
                remarks: remarks.isNotEmpty ? remarks : '$action via mobile command portal.',
              );
              messenger.showSnackBar(
                SnackBar(
                  content: Text(success ? 'Application $action processed.' : 'Failed to process application.'),
                  backgroundColor: success ? AppColors.success : AppColors.error,
                ),
              );
            },
            child: Text('Confirm $action'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_turned_in_outlined, size: 54, color: AppColors.navyPrimary.withValues(alpha: 0.3)),
            const SizedBox(height: 14),
            const Text(
              'No Pending Cadet Applications',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'All newly registered cadet applications have been processed and verified.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
