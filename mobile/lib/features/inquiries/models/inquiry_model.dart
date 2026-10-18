class InquiryModel {
  final String id;
  final String requestNumber;
  final String requestType;
  final String title;
  final String description;
  final String priority;
  final String status;
  final String? currentReviewerRole;
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
    this.createdAt,
  });

  bool get isResolved => status == 'RESOLVED' || status == 'APPROVED';
  bool get isPending => status == 'SUBMITTED' || status == 'IN_REVIEW' || status == 'FORWARDED';
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
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }
}
