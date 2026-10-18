import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/notice_model.dart';

class NoticeProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<NoticeModel> _notices = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<NoticeModel> get notices => _notices;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchNotices() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.publicNotices, requiresAuth: false);

      if (response.success && response.rawJson != null) {
        if (response.rawJson!['notices'] is List) {
          final list = response.rawJson!['notices'] as List;
          _notices = list.map((item) => NoticeModel.fromJson(item as Map<String, dynamic>)).toList();
        }
        _isLoading = false;
        notifyListeners();
        return;
      }

      _errorMessage = response.message ?? 'Failed to retrieve unit notices.';
    } catch (e) {
      _errorMessage = 'Network error: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
