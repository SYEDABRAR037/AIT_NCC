import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../models/inquiry_model.dart';
import '../providers/inquiry_provider.dart';

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
                  'Type: ${inquiry.requestType.replaceAll('_', ' ')}',
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
          ],
        ),
      ),
    );
  }

  void _openNewInquiryDialog(BuildContext context, InquiryProvider provider) {
    String selectedType = 'OTHER';
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
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Submit Official Inquiry / Request',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navyPrimary),
              ),
              const SizedBox(height: 14),

              DropdownButtonFormField<String>(
                initialValue: selectedType,
                decoration: const InputDecoration(labelText: 'Inquiry Category'),
                items: const [
                  DropdownMenuItem(value: 'DOCUMENT_REQUEST', child: Text('Document Request')),
                  DropdownMenuItem(value: 'PROFILE_CORRECTION', child: Text('Profile Correction')),
                  DropdownMenuItem(value: 'CERTIFICATE_VERIFICATION', child: Text('Certificate Verification')),
                  DropdownMenuItem(value: 'DUTY_RELATED', child: Text('Duty Related Query')),
                  DropdownMenuItem(value: 'OTHER', child: Text('General Operational Query')),
                ],
                onChanged: (val) {
                  if (val != null) setModalState(() => selectedType = val);
                },
              ),
              const SizedBox(height: 12),

              TextField(
                controller: titleController,
                decoration: const InputDecoration(
                  labelText: 'Subject / Title',
                  hintText: 'e.g. Roll number correction on digital record',
                ),
              ),
              const SizedBox(height: 12),

              TextField(
                controller: descriptionController,
                maxLines: 3,
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
                  if (title.isEmpty || desc.isEmpty) {
                    messenger.showSnackBar(
                      const SnackBar(content: Text('Please fill in title and description.'), backgroundColor: AppColors.error),
                    );
                    return;
                  }
                  Navigator.pop(ctx);
                  final success = await provider.submitInquiry(
                    requestType: selectedType,
                    title: title,
                    description: desc,
                    priority: priority,
                  );
                  if (mounted) {
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(success ? 'Inquiry submitted successfully.' : 'Failed to submit inquiry.'),
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
