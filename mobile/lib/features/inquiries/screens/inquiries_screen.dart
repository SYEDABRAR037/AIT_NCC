import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../models/inquiry_model.dart';
import '../providers/inquiry_provider.dart';
import 'inquiry_thread_screen.dart';

class InquiriesScreen extends StatefulWidget {
  const InquiriesScreen({super.key});

  @override
  State<InquiriesScreen> createState() => _InquiriesScreenState();
}

class _InquiriesScreenState extends State<InquiriesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<InquiryProvider>(context, listen: false);
      if (provider.inquiries.isEmpty) {
        provider.fetchInquiries();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InquiryProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inquiry & Command Desk'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, size: 20),
            onPressed: () => provider.fetchInquiries(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.navyPrimary,
        foregroundColor: AppColors.white,
        icon: const Icon(Icons.add_comment_outlined),
        label: const Text('NEW INQUIRY', style: TextStyle(fontWeight: FontWeight.w800, letterSpacing: 0.5)),
        onPressed: () => _openNewInquiryDialog(context, provider),
      ),
      body: provider.isLoading && provider.inquiries.isEmpty
          ? const Center(child: CircularProgressIndicator(color: AppColors.navyPrimary))
          : provider.errorMessage != null && provider.inquiries.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(provider.errorMessage!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: provider.fetchInquiries,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
          : RefreshIndicator(
              onRefresh: () => provider.fetchInquiries(),
              color: AppColors.navyPrimary,
              child: provider.inquiries.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(16.0),
                      itemCount: provider.inquiries.length,
                      itemBuilder: (ctx, i) => _buildInquiryCard(provider.inquiries[i]),
                    ),
            ),
    );
  }

  Widget _buildInquiryCard(InquiryModel inquiry) {
    Color statusColor;
    Color statusBg;

    if (inquiry.isResolved) {
      statusColor = AppColors.success;
      statusBg = AppColors.successLight;
    } else if (inquiry.isRejected) {
      statusColor = AppColors.error;
      statusBg = AppColors.errorLight;
    } else {
      statusColor = AppColors.warning;
      statusBg = AppColors.warningLight;
    }

    final dateFormatted = inquiry.createdAt != null
        ? DateFormat('dd MMM yyyy').format(inquiry.createdAt!)
        : 'Official Inquiry';

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
                    inquiry.requestNumber,
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
                    inquiry.status,
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 10, color: statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            Text(
              inquiry.title,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 6),

            Text(
              inquiry.description,
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 12),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Priority: ${inquiry.priority}',
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w600),
                ),
                Text(
                  dateFormatted,
                  style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                ),
              ],
            ),

            if (inquiry.currentReviewerRole != null) ...[
              const SizedBox(height: 6),
              Text(
                'Assigned to: ${inquiry.currentReviewerRole}',
                style: const TextStyle(fontSize: 11, color: AppColors.navyPrimary, fontWeight: FontWeight.w700),
              ),
            ],
            if (inquiry.cadetName != null) ...[
              const SizedBox(height: 6),
              Text(
                '${inquiry.cadetName}${inquiry.cadetRegimentalNumber == null ? '' : ' • ${inquiry.cadetRegimentalNumber}'}',
                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
              ),
            ],
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => InquiryThreadScreen(inquiryId: inquiry.id),
                  ),
                ),
                icon: const Icon(Icons.forum_outlined, size: 18),
                label: Text('Conversation (${inquiry.replyCount})'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openNewInquiryDialog(BuildContext context, InquiryProvider provider) {
    String priority = 'NORMAL';
    final titleController = TextEditingController();
    final descriptionController = TextEditingController();

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
          child: SingleChildScrollView(
            child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Submit Official Inquiry / Request',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navyPrimary),
              ),
              const SizedBox(height: 14),

              TextField(
                controller: titleController,
                maxLength: 200,
                decoration: const InputDecoration(
                  labelText: 'Subject / Title',
                  hintText: 'e.g. Roll number correction on digital record',
                ),
              ),
              const SizedBox(height: 12),

              DropdownButtonFormField<String>(
                initialValue: priority,
                decoration: const InputDecoration(labelText: 'Priority'),
                items: const [
                  DropdownMenuItem(value: 'NORMAL', child: Text('Normal')),
                  DropdownMenuItem(value: 'HIGH', child: Text('High')),
                  DropdownMenuItem(value: 'URGENT', child: Text('Urgent')),
                ],
                onChanged: (value) {
                  if (value != null) setModalState(() => priority = value);
                },
              ),
              const SizedBox(height: 12),

              TextField(
                controller: descriptionController,
                maxLines: 3,
                maxLength: 5000,
                decoration: const InputDecoration(
                  labelText: 'Details / Justification',
                  hintText: 'Explain the nature of your request with particulars...',
                ),
              ),
              const SizedBox(height: 18),

              ElevatedButton(
                onPressed: () async {
                  final title = titleController.text.trim();
                  final desc = descriptionController.text.trim();
                  final messenger = ScaffoldMessenger.of(context);
                  if (title.length < 3 || desc.length < 5) {
                    messenger.showSnackBar(
                      const SnackBar(content: Text('Subject must be at least 3 characters and details at least 5.'), backgroundColor: AppColors.error),
                    );
                    return;
                  }
                  Navigator.pop(ctx);
                  final success = await provider.submitInquiry(
                    title: title,
                    description: desc,
                    priority: priority,
                  );
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(success ? 'Inquiry submitted successfully.' : (provider.errorMessage ?? 'Failed to submit inquiry.')),
                        backgroundColor: success ? AppColors.success : AppColors.error,
                      ),
                    );
                  }
                },
                child: const Text('SUBMIT TO COMMAND DESK'),
              ),
            ],
            ),
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
            Icon(Icons.contact_support_outlined, size: 54, color: AppColors.navyPrimary.withValues(alpha: 0.3)),
            const SizedBox(height: 14),
            const Text(
              'No Inquiries or Requests on Record',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: AppColors.navyPrimary),
            ),
            const SizedBox(height: 6),
            const Text(
              'Tap "NEW INQUIRY" to submit an official query or grievance to the command staff.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
