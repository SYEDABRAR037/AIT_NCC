class InquiryModel {
  final String id;
  final String requestNumber;
  final String requestType;
  final String title;
  final String description;
  final String priority;
  final String status;
  final String? currentReviewerRole;
  final String? currentReviewerId;
  final String? cadetId;
  final String? cadetName;
  final String? cadetRegimentalNumber;
  final int replyCount;
  final List<InquiryReplyModel> replies;
  final DateTime? createdAt;

  InquiryModel({
    required this.id,
    required this.requestNumber,
    required this.requestType,
    required this.title,
    required this.description,
    required this.priority,
    required this.status,
    this.currentReviewerRole,
    this.currentReviewerId,
    this.cadetId,
    this.cadetName,
    this.cadetRegimentalNumber,
    this.replyCount = 0,
    this.replies = const [],
    this.createdAt,
  });

  bool get isResolved => status == 'RESOLVED' || status == 'CLOSED' || status == 'APPROVED';
  bool get isPending => status == 'SUBMITTED' || status == 'UNDER_REVIEW' || status == 'REPLIED' || status == 'FORWARDED';
  bool get isRejected => status == 'REJECTED';

  factory InquiryModel.fromJson(Map<String, dynamic> json) {
    return InquiryModel(
      id: json['id']?.toString() ?? '',
      requestNumber: json['requestNumber']?.toString() ?? 'REQ-2026-0000',
      requestType: json['requestType']?.toString() ?? 'OTHER',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      priority: json['priority']?.toString() ?? 'NORMAL',
      status: json['status']?.toString() ?? 'SUBMITTED',
      currentReviewerRole: json['currentReviewerRole']?.toString(),
      currentReviewerId: json['currentReviewerId']?.toString(),
      cadetId: json['cadetId']?.toString(),
      cadetName: (json['cadet'] as Map<String, dynamic>?)?['fullName']?.toString(),
      cadetRegimentalNumber: (json['cadet'] as Map<String, dynamic>?)?['regimentalNumber']?.toString(),
      replyCount: (json['_count'] as Map<String, dynamic>?)?['replies'] is int
          ? (json['_count'] as Map<String, dynamic>)['replies'] as int
          : 0,
      replies: json['replies'] is List
          ? (json['replies'] as List)
              .whereType<Map<String, dynamic>>()
              .map(InquiryReplyModel.fromJson)
              .toList()
          : const [],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }
}

class InquiryReplyModel {
  final String id;
  final String senderId;
  final String senderName;
  final String senderRole;
  final String message;
  final DateTime? createdAt;

  const InquiryReplyModel({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.senderRole,
    required this.message,
    this.createdAt,
  });

  factory InquiryReplyModel.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] is Map<String, dynamic>
        ? json['sender'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return InquiryReplyModel(
      id: json['id']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? sender['id']?.toString() ?? '',
      senderName: json['senderName']?.toString() ?? sender['fullName']?.toString() ?? 'Unit member',
      senderRole: json['senderRole']?.toString() ?? sender['role']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }
}
