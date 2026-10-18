class CampParticipantModel {
  final String id;
  final String cadetId;
  final String status;

  CampParticipantModel({
    required this.id,
    required this.cadetId,
    required this.status,
  });

  factory CampParticipantModel.fromJson(Map<String, dynamic> json) {
    return CampParticipantModel(
      id: json['id']?.toString() ?? '',
      cadetId: json['cadetId']?.toString() ?? '',
      status: json['status']?.toString() ?? 'NOMINATED',
    );
  }
}

class CampModel {
  final String id;
  final String name;
  final String location;
  final DateTime startDate;
  final DateTime endDate;
  final String campType;
  final String status;
  final List<CampParticipantModel> participants;

  CampModel({
    required this.id,
    required this.name,
    required this.location,
    required this.startDate,
    required this.endDate,
    required this.campType,
    required this.status,
    required this.participants,
  });

  bool isCadetRegistered(String cadetId) {
    return participants.any((p) => p.cadetId == cadetId);
  }

  String? cadetRegistrationStatus(String cadetId) {
    try {
      final p = participants.firstWhere((p) => p.cadetId == cadetId);
      return p.status;
    } catch (_) {
      return null;
    }
  }

  factory CampModel.fromJson(Map<String, dynamic> json) {
    List<CampParticipantModel> participantList = [];
    if (json['participants'] is List) {
      participantList = (json['participants'] as List)
          .map((p) => CampParticipantModel.fromJson(p as Map<String, dynamic>))
          .toList();
    }

    return CampModel(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'NCC Training Camp',
      location: json['location']?.toString() ?? 'Training Area',
      startDate: DateTime.tryParse(json['startDate']?.toString() ?? '') ?? DateTime.now(),
      endDate: DateTime.tryParse(json['endDate']?.toString() ?? '') ?? DateTime.now(),
      campType: json['campType']?.toString() ?? 'ATC',
      status: json['status']?.toString() ?? 'UPCOMING',
      participants: participantList,
    );
  }
}
