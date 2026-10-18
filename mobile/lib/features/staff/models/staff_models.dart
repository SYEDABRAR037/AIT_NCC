class StaffCadetSummaryModel {
  final String id;
  final String fullName;
  final String regimentalNumber;
  final String? platoonName;
  final String? year;
  final String? branch;
  final int total;
  final int present;
  final int absent;
  final int excused;
  final int percentage;

  StaffCadetSummaryModel({
    required this.id,
    required this.fullName,
    required this.regimentalNumber,
    this.platoonName,
    this.year,
    this.branch,
    required this.total,
    required this.present,
    required this.absent,
    required this.excused,
    required this.percentage,
  });

  factory StaffCadetSummaryModel.fromJson(Map<String, dynamic> json) {
    final stats = json['stats'] is Map<String, dynamic> ? json['stats'] : <String, dynamic>{};

    return StaffCadetSummaryModel(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? 'Cadet',
      regimentalNumber: json['regimentalNumber']?.toString() ?? '',
      platoonName: json['platoonName']?.toString(),
      year: json['year']?.toString(),
      branch: json['branch']?.toString(),
      total: (stats['total'] as num?)?.toInt() ?? 0,
      present: (stats['present'] as num?)?.toInt() ?? 0,
      absent: (stats['absent'] as num?)?.toInt() ?? 0,
      excused: (stats['excused'] as num?)?.toInt() ?? 0,
      percentage: (stats['percentage'] as num?)?.toInt() ?? 0,
    );
  }
}

class StaffSessionModel {
  final String id;
  final String title;
  final String activity;
  final DateTime date;
  final String? timing;
  final String? location;
  final String status;

  StaffSessionModel({
    required this.id,
    required this.title,
    required this.activity,
    required this.date,
    this.timing,
    this.location,
    required this.status,
  });

  bool get isActive => status == 'ACTIVE' || status == 'IN_PROGRESS';

  factory StaffSessionModel.fromJson(Map<String, dynamic> json) {
    return StaffSessionModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Parade Drill',
      activity: json['activity']?.toString() ?? 'DRILL',
      date: DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
      timing: json['timing']?.toString(),
      location: json['location']?.toString(),
      status: json['status']?.toString() ?? 'ACTIVE',
    );
  }
}

class PendingApprovalModel {
  final String id;
  final String fullName;
  final String regimentalNumber;
  final String collegeRollNumber;
  final String email;
  final String? phone;
  final String? platoonName;
  final String? year;
  final String status;
  final DateTime? createdAt;

  PendingApprovalModel({
    required this.id,
    required this.fullName,
    required this.regimentalNumber,
    required this.collegeRollNumber,
    required this.email,
    this.phone,
    this.platoonName,
    this.year,
    required this.status,
    this.createdAt,
  });

  factory PendingApprovalModel.fromJson(Map<String, dynamic> json) {
    return PendingApprovalModel(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? 'Cadet Applicant',
      regimentalNumber: json['regimentalNumber']?.toString() ?? '',
      collegeRollNumber: json['collegeRollNumber']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString(),
      platoonName: json['platoonName']?.toString(),
      year: json['year']?.toString(),
      status: json['status']?.toString() ?? 'UNDER_REVIEW',
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }
}
