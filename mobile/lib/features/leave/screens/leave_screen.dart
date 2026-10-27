import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/leave_model.dart';
import '../providers/leave_provider.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<LeaveProvider>(context, listen: false);
      if (provider.leaves.isEmpty) {
        provider.fetchLeaves();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<LeaveProvider>();
    final role = context.watch<AuthProvider>().currentUser?.role;
    final canApply = role == 'CADET' || role == 'SENIOR' || role == 'PLATOON_SENIOR';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Leave Applications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: () => provider.fetchLeaves(),
          ),
        ],
      ),
      floatingActionButton: canApply ? FloatingActionButton.extended(
        backgroundColor: AppColors.navyPrimary,
        foregroundColor: AppColors.white,
        icon: const Icon(Icons.add),
        label: const Text('APPLY LEAVE', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.5)),
        onPressed: () => _openApplyLeaveDialog(context, provider),
      ) : null,
      body: provider.isLoading && provider.leaves.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.navyPrimary))
          : provider.errorMessage != null && provider.leaves.isEmpty
              ? _buildLoadError(provider)
          : RefreshIndicator(
              onRefresh: () => provider.fetchLeaves(),
              color: AppColors.navyPrimary,
              child: provider.leaves.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(16.0),
                      itemCount: provider.leaves.length,
                      itemBuilder: (ctx, i) => _buildLeaveCard(provider.leaves[i], provider),
                    ),
            ),
    );
  }

  Widget _buildLeaveCard(LeaveModel leave, LeaveProvider provider) {
    Color statusColor;
    Color statusBg;

    if (leave.isApproved) {
      statusColor = AppColors.success;
      statusBg = AppColors.successLight;
    } else if (leave.isRejected) {
      statusColor = AppColors.error;
      statusBg = AppColors.errorLight;
    } else if (leave.isCancelled) {
      statusColor = AppColors.textMuted;
      statusBg = AppColors.backgroundLight;
    } else {
      statusColor = AppColors.warning;
      statusBg = AppColors.warningLight;
    }

    final startFmt = DateFormat('dd MMM yyyy').format(leave.startDate);
    final endFmt = DateFormat('dd MMM yyyy').format(leave.endDate);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.navyPrimary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    leave.leaveType,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: AppColors.navyPrimary),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    leave.status,
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 10, color: statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Row(
              children: [
                const Icon(Icons.date_range, size: 15, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                Text(
                  '$startFmt  ➔  $endFmt',
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary),
                ),
              ],
            ),
            const SizedBox(height: 8),

            Text(
              leave.reason,
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
            ),

            if (leave.remarks != null && leave.remarks!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.backgroundLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Reviewer Remarks: ${leave.remarks}',
                  style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textSecondary),
                ),
              ),
            ],

            if (leave.isPending) ...[
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  icon: const Icon(Icons.cancel_outlined, size: 14, color: AppColors.error),
                  label: const Text('Cancel Request', style: TextStyle(color: AppColors.error, fontSize: 12)),
                  onPressed: () => _confirmCancel(leave.id, provider),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _confirmCancel(String leaveId, LeaveProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Application', style: TextStyle(fontWeight: FontWeight.w800)),
        content: const Text('Are you sure you want to cancel this leave application?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('No')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await provider.cancelLeave(leaveId);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(success ? 'Leave request cancelled.' : (provider.errorMessage ?? 'Failed to cancel leave request.')),
                    backgroundColor: success ? AppColors.success : AppColors.error,
                  ),
                );
              }
            },
            child: const Text('Cancel Application'),
          ),
        ],
      ),
    );
  }

  void _openApplyLeaveDialog(BuildContext context, LeaveProvider provider) {
    String selectedType = 'ACADEMIC';
    DateTime startDate = DateTime.now().add(const Duration(days: 1));
    DateTime endDate = DateTime.now().add(const Duration(days: 2));
    final reasonController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            top: 20,
            left: 20,
            right: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Submit Leave Application',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navyPrimary),
              ),
              const SizedBox(height: 14),

              DropdownButtonFormField<String>(
                initialValue: selectedType,
                decoration: const InputDecoration(labelText: 'Leave Category'),
                items: const [
                  DropdownMenuItem(value: 'ACADEMIC', child: Text('Academic / Exam Leave')),
                  DropdownMenuItem(value: 'MEDICAL', child: Text('Medical Leave')),
                  DropdownMenuItem(value: 'PERSONAL', child: Text('Personal / Family Emergency')),
                  DropdownMenuItem(value: 'DUTY_EXEMPTION', child: Text('Special College Duty')),
                ],
                onChanged: (val) {
                  if (val != null) setModalState(() => selectedType = val);
                },
              ),
              const SizedBox(height: 12),

              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: startDate,
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 90)),
                        );
                        if (picked != null) {
                          setModalState(() {
                            startDate = picked;
                            if (endDate.isBefore(startDate)) endDate = startDate;
                          });
                        }
                      },
                      child: Text('Start: ${DateFormat('dd MMM').format(startDate)}', style: const TextStyle(fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: ctx,
                          initialDate: endDate,
                          firstDate: startDate,
                          lastDate: DateTime.now().add(const Duration(days: 90)),
                        );
                        if (picked != null) {
                          setModalState(() => endDate = picked);
                        }
                      },
                      child: Text('End: ${DateFormat('dd MMM').format(endDate)}', style: const TextStyle(fontSize: 12)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              TextField(
                controller: reasonController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Justification / Reason',
                  hintText: 'Detail academic commitment or medical situation...',
                ),
              ),
              const SizedBox(height: 18),

              ElevatedButton(
                onPressed: () async {
                  final reason = reasonController.text.trim();
                  final messenger = ScaffoldMessenger.of(context);
                  if (reason.isEmpty) {
                    messenger.showSnackBar(
                      const SnackBar(content: Text('Please provide a reason for leave.'), backgroundColor: AppColors.error),
                    );
                    return;
                  }
                  Navigator.pop(ctx);
                  final success = await provider.submitLeave(
                    leaveType: selectedType,
                    startDate: startDate,
                    endDate: endDate,
                    reason: reason,
                  );
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(success ? 'Leave application submitted successfully.' : 'Failed to submit leave.'),
                        backgroundColor: success ? AppColors.success : AppColors.error,
                      ),
                    );
                  }
                },
                child: const Text('SUBMIT LEAVE APPLICATION'),
              ),
            ],
          ),
        ),
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
            Icon(Icons.event_busy, size: 54, color: AppColors.navyPrimary.withValues(alpha: 0.3)),
            const SizedBox(height: 14),
            const Text(
              'No Leave Applications on Record',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'Tap "APPLY LEAVE" to request an official leave of absence from parade drills.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoadError(LeaveProvider provider) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(provider.errorMessage!, textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: provider.fetchLeaves,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
}
