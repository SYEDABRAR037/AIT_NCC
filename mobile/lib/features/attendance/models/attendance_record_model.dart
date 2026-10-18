class AttendanceStats {
  final int total;
  final int present;
  final int absent;
  final int excused;
  final int percentage;

  AttendanceStats({
    required this.total,
    required this.present,
    required this.absent,
    required this.excused,
    required this.percentage,
  });

  factory AttendanceStats.fromJson(Map<String, dynamic> json) {
    return AttendanceStats(
      total: (json['total'] as num?)?.toInt() ?? 0,
      present: (json['present'] as num?)?.toInt() ?? 0,
      absent: (json['absent'] as num?)?.toInt() ?? 0,
      excused: (json['excused'] as num?)?.toInt() ?? 0,
      percentage: (json['percentage'] as num?)?.toInt() ?? 0,
    );
  }
}

class AttendanceRecordModel {
  final String id;
  final String status;
  final String sessionTitle;
  final String activity;
  final DateTime? date;
  final String? timing;
  final String? location;

  AttendanceRecordModel({
    required this.id,
    required this.status,
    required this.sessionTitle,
    required this.activity,
    this.date,
    this.timing,
    this.location,
  });

  bool get isPresent => status == 'PRESENT';
  bool get isAbsent => status == 'ABSENT';
  bool get isExcused => status == 'EXCUSED';

  factory AttendanceRecordModel.fromJson(Map<String, dynamic> json) {
    final session = json['session'] is Map<String, dynamic> ? json['session'] : <String, dynamic>{};

    return AttendanceRecordModel(
      id: json['id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'ABSENT',
      sessionTitle: session['title']?.toString() ?? 'Parade Training Session',
      activity: session['activity']?.toString() ?? 'DRILL',
      date: session['date'] != null ? DateTime.tryParse(session['date'].toString()) : null,
      timing: session['timing']?.toString(),
      location: session['location']?.toString(),
    );
  }
}
