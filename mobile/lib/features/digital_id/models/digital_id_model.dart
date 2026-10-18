class DigitalIdModel {
  final String id;
  final String fullName;
  final String rank;
  final String regimentalNumber;
  final String? collegeRollNumber;
  final String? year;
  final String? platoonName;
  final String? team;
  final String status;
  final String? profilePhotoUrl;
  final String token;

  DigitalIdModel({
    required this.id,
    required this.fullName,
    required this.rank,
    required this.regimentalNumber,
    this.collegeRollNumber,
    this.year,
    this.platoonName,
    this.team,
    required this.status,
    this.profilePhotoUrl,
    required this.token,
  });

  bool get isValid => status == 'ACTIVE' || status == 'VALID';

  factory DigitalIdModel.fromJson(Map<String, dynamic> json, String token) {
    return DigitalIdModel(
      id: json['id']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? 'Cadet',
      rank: json['rank']?.toString() ?? 'CDT',
      regimentalNumber: json['regimentalNumber']?.toString() ?? '',
      collegeRollNumber: json['collegeRollNumber']?.toString(),
      year: json['year']?.toString(),
      platoonName: json['platoonName']?.toString(),
      team: json['team']?.toString(),
      status: json['status']?.toString() ?? 'ACTIVE',
      profilePhotoUrl: json['profilePhotoUrl']?.toString(),
      token: token,
    );
  }
}
