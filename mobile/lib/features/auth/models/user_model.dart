class UserModel {
  final String id;
  final String fullName;
  final String regimentalNumber;
  final String? collegeRollNumber;
  final String email;
  final String? phone;
  final String? year;
  final String? branch;
  final String? platoonName;
  final String role;
  final String status;
  final String? profilePhotoUrl;

  UserModel({
    required this.id,
    required this.fullName,
    required this.regimentalNumber,
    this.collegeRollNumber,
    required this.email,
    this.phone,
    this.year,
    this.branch,
    this.platoonName,
    required this.role,
    required this.status,
    this.profilePhotoUrl,
  });

  bool get isCadet => role == 'CADET';
  bool get isAno => role == 'ADMIN_ANO';
  bool get isSenior => role == 'SENIOR' || role == 'PLATOON_SENIOR';
  bool get isStaff => !isCadet;
  bool get isActive => status == 'ACTIVE';

  String get roleDisplayName {
    switch (role) {
      case 'ADMIN_ANO':
        return 'Associate NCC Officer';
      case 'SENIOR':
        return 'Senior Under Officer';
      case 'PLATOON_SENIOR':
        return 'Platoon Commander';
      case 'DRILL_INSTRUCTOR':
        return 'Drill Instructor';
      case 'CADET':
      default:
        return 'Cadet';
    }
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? 'Cadet',
      regimentalNumber: json['regimentalNumber']?.toString() ?? '',
      collegeRollNumber: json['collegeRollNumber']?.toString(),
      email: json['email']?.toString() ?? '',
      phone: json['phone']?.toString(),
      year: json['year']?.toString(),
      branch: json['branch']?.toString(),
      platoonName: json['platoonName']?.toString(),
      role: json['role']?.toString() ?? 'CADET',
      status: json['status']?.toString() ?? 'ACTIVE',
      profilePhotoUrl: json['profilePhotoUrl']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fullName': fullName,
      'regimentalNumber': regimentalNumber,
      'collegeRollNumber': collegeRollNumber,
      'email': email,
      'phone': phone,
      'year': year,
      'branch': branch,
      'platoonName': platoonName,
      'role': role,
      'status': status,
      'profilePhotoUrl': profilePhotoUrl,
    };
  }
}
