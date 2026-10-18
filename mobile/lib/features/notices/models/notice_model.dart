class NoticeModel {
  final String id;
  final String title;
  final String content;
  final String category;
  final bool isUrgent;
  final DateTime? createdAt;

  NoticeModel({
    required this.id,
    required this.title,
    required this.content,
    required this.category,
    required this.isUrgent,
    this.createdAt,
  });

  factory NoticeModel.fromJson(Map<String, dynamic> json) {
    return NoticeModel(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Unit Notice',
      content: json['content']?.toString() ?? '',
      category: json['category']?.toString() ?? 'GENERAL',
      isUrgent: json['isUrgent'] == true,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }
}
