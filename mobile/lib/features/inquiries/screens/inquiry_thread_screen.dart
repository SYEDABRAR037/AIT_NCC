import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../auth/providers/auth_provider.dart';
import '../models/inquiry_model.dart';
import '../providers/inquiry_provider.dart';

class InquiryThreadScreen extends StatefulWidget {
  const InquiryThreadScreen({super.key, required this.inquiryId});

  final String inquiryId;

  @override
  State<InquiryThreadScreen> createState() => _InquiryThreadScreenState();
}

class _InquiryThreadScreenState extends State<InquiryThreadScreen> {
  final _replyController = TextEditingController();
  InquiryModel? _thread;
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadThread());
  }

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _loadThread() async {
    final thread = await context.read<InquiryProvider>().fetchThread(
      widget.inquiryId,
    );
    if (mounted && thread != null) setState(() => _thread = thread);
  }

  bool _canReply(InquiryModel inquiry, String? role, String? userId) {
    if (inquiry.status == 'CLOSED') return false;
    if (inquiry.cadetId == userId) return true;
    return role == 'SENIOR' || role == 'PLATOON_SENIOR' || role == 'ADMIN_ANO';
  }

  bool _canManage(InquiryModel inquiry, String? role, String? userId) {
    if (inquiry.cadetId == userId || inquiry.status == 'CLOSED') return false;
    if (role == 'ADMIN_ANO') return true;
    return role != null &&
        role == inquiry.currentReviewerRole &&
        (role == 'SENIOR' || role == 'PLATOON_SENIOR');
  }

  Future<void> _sendReply(InquiryProvider provider) async {
    final message = _replyController.text.trim();
    if (message.length < 2) return;
    setState(() => _isSending = true);
    final success = await provider.replyToInquiry(
      id: widget.inquiryId,
      message: message,
    );
    if (!mounted) return;
    setState(() => _isSending = false);
    if (success) {
      _replyController.clear();
      await _loadThread();
    } else {
      _showMessage(provider.errorMessage ?? 'Reply was not sent.');
    }
  }

  Future<void> _changeStatus(InquiryProvider provider, String status) async {
    final remarks = TextEditingController();
    final approved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('$status inquiry'),
        content: TextField(
          controller: remarks,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Remarks (optional)'),
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
    if (approved != true || !mounted) {
      remarks.dispose();
      return;
    }
    final success = await provider.updateStatus(
      id: widget.inquiryId,
      status: status,
      remarks: remarks.text,
    );
    remarks.dispose();
    if (!mounted) return;
    if (success) {
      await _loadThread();
    } else {
      _showMessage(provider.errorMessage ?? 'Status was not updated.');
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<InquiryProvider>();
    final user = context.watch<AuthProvider>().currentUser;
    final inquiry = _thread;
    final canReply =
        inquiry != null && _canReply(inquiry, user?.role, user?.id);
    final canManage =
        inquiry != null && _canManage(inquiry, user?.role, user?.id);
    final statusOptions = user?.role == 'ADMIN_ANO'
        ? const ['RESOLVED', 'CLOSED']
        : const ['FORWARDED', 'RESOLVED', 'CLOSED'];

    return Scaffold(
      appBar: AppBar(
        title: Text(inquiry?.requestNumber ?? 'Inquiry thread'),
        actions: [
          if (canManage)
            PopupMenuButton<String>(
              tooltip: 'Update inquiry status',
              onSelected: (status) => _changeStatus(provider, status),
              itemBuilder: (_) => statusOptions
                  .map(
                    (status) => PopupMenuItem(
                      value: status,
                      child: Text(status.replaceAll('_', ' ')),
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
      body: provider.isLoadingThread && inquiry == null
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.navyPrimary),
            )
          : inquiry == null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      provider.threadError ?? 'Inquiry thread unavailable.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _loadThread,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                inquiry.title,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.navyPrimary,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(inquiry.description),
                              const SizedBox(height: 12),
                              Text(
                                '${inquiry.status.replaceAll('_', ' ')}${inquiry.currentReviewerRole == null ? '' : ' • ${inquiry.currentReviewerRole}'}',
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                              if (inquiry.cadetName != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  '${inquiry.cadetName}${inquiry.cadetRegimentalNumber == null ? '' : ' • ${inquiry.cadetRegimentalNumber}'}',
                                  style: const TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Conversation (${inquiry.replies.length})',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: AppColors.navyPrimary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (inquiry.replies.isEmpty)
                        const Card(
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: Text('No replies yet.'),
                          ),
                        ),
                      ...inquiry.replies.map(_replyCard),
                    ],
                  ),
                ),
                if (canReply)
                  SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _replyController,
                              minLines: 1,
                              maxLines: 4,
                              maxLength: 5000,
                              decoration: const InputDecoration(
                                hintText: 'Write a reply',
                                counterText: '',
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IconButton.filled(
                            tooltip: 'Send reply',
                            onPressed: _isSending
                                ? null
                                : () => _sendReply(provider),
                            icon: _isSending
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.send),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _replyCard(InquiryReplyModel reply) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${reply.senderName} • ${reply.senderRole}',
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.navyPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Text(reply.message),
          if (reply.createdAt != null) ...[
            const SizedBox(height: 6),
            Text(
              MaterialLocalizations.of(
                context,
              ).formatMediumDate(reply.createdAt!.toLocal()),
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    ),
  );
}
