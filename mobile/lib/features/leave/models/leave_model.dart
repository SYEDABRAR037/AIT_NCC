class LeaveModel {
  final String id;
  final String leaveType;
  final DateTime startDate;
  final DateTime endDate;
  final String reason;
  final String status;
  final String? documentUrl;
  final DateTime? createdAt;
  final String? remarks;

  LeaveModel({
    required this.id,
    required this.leaveType,
    required this.startDate,
    required this.endDate,
    required this.reason,
    required this.status,
    this.documentUrl,
    this.createdAt,
    this.remarks,
  });

  bool get isApproved => status == 'APPROVED';
  bool get isRejected => status == 'REJECTED';
  bool get isPending => status == 'SUBMITTED' || status == 'RECOMMENDED' || status == 'PENDING';
  bool get isCancelled => status == 'CANCELLED';

  factory LeaveModel.fromJson(Map<String, dynamic> json) {
    String? remark;
    if (json['leaveReviews'] is List && (json['leaveReviews'] as List).isNotEmpty) {
      final lastReview = (json['leaveReviews'] as List).last;
      if (lastReview is Map<String, dynamic>) {
        remark = lastReview['remarks']?.toString();
      }
    }

    return LeaveModel(
      id: json['id']?.toString() ?? '',
      leaveType: json['leaveType']?.toString() ?? 'CASUAL',
      startDate: DateTime.tryParse(json['startDate']?.toString() ?? '') ?? DateTime.now(),
      endDate: DateTime.tryParse(json['endDate']?.toString() ?? '') ?? DateTime.now(),
      reason: json['reason']?.toString() ?? '',
      status: json['status']?.toString() ?? 'SUBMITTED',
      documentUrl: json['documentUrl']?.toString(),
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      remarks: remark,
    );
  }
}
