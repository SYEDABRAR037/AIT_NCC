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
  final String? applicantName;
  final String? applicantRegimentalNumber;
  final String? applicantPlatoon;
  final List<LeaveReviewModel> reviewHistory;

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
    this.applicantName,
    this.applicantRegimentalNumber,
    this.applicantPlatoon,
    this.reviewHistory = const [],
  });

  bool get isApproved => status == 'APPROVED';
  bool get isRejected => status == 'REJECTED';
  bool get isPending => const {
    'SUBMITTED',
    'SENIOR_REVIEW',
    'PLATOON_SENIOR_REVIEW',
    'ANO_REVIEW',
    'RETURNED',
  }.contains(status);
  bool get isCancelled => status == 'CANCELLED';

  factory LeaveModel.fromJson(Map<String, dynamic> json) {
    String? remark;
    if (json['leaveReviews'] is List && (json['leaveReviews'] as List).isNotEmpty) {
      final lastReview = (json['leaveReviews'] as List).last;
      if (lastReview is Map<String, dynamic>) {
        remark = lastReview['remarks']?.toString();
      }
    }

    final cadet = json['cadet'] is Map<String, dynamic>
        ? json['cadet'] as Map<String, dynamic>
        : const <String, dynamic>{};
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
      applicantName: cadet['fullName']?.toString(),
      applicantRegimentalNumber: cadet['regimentalNumber']?.toString(),
      applicantPlatoon: cadet['platoonName']?.toString(),
      reviewHistory: json['leaveReviews'] is List
          ? (json['leaveReviews'] as List)
              .whereType<Map<String, dynamic>>()
              .map(LeaveReviewModel.fromJson)
              .toList()
          : const [],
    );
  }
}

class LeaveReviewModel {
  final String reviewerName;
  final String reviewerRole;
  final String stage;
  final String action;
  final String? remarks;
  final DateTime? createdAt;

  const LeaveReviewModel({
    required this.reviewerName,
    required this.reviewerRole,
    required this.stage,
    required this.action,
    this.remarks,
    this.createdAt,
  });

  factory LeaveReviewModel.fromJson(Map<String, dynamic> json) {
    final reviewer = json['reviewer'] is Map<String, dynamic>
        ? json['reviewer'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return LeaveReviewModel(
      reviewerName: reviewer['fullName']?.toString() ?? 'Reviewer',
      reviewerRole: json['reviewerRole']?.toString() ?? reviewer['role']?.toString() ?? '',
      stage: json['stage']?.toString() ?? '',
      action: json['action']?.toString() ?? '',
      remarks: json['remarks']?.toString(),
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }
}
