import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/camp_model.dart';

class CampProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<CampModel> _camps = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<CampModel> get camps => _camps;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchCamps() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.camps, requiresAuth: true);

      if (response.success && response.rawJson != null) {
        if (response.rawJson!['camps'] is List) {
          final list = response.rawJson!['camps'] as List;
          _camps = list.map((item) => CampModel.fromJson(item as Map<String, dynamic>)).toList();
        }
        _isLoading = false;
        notifyListeners();
        return;
      }

      _errorMessage = response.message ?? 'Failed to retrieve training camps.';
    } catch (e) {
      _errorMessage = 'Network error: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> applyForCamp(String campId) async {
    try {
      final response = await _api.post(
        ApiConstants.campApply(campId),
        requiresAuth: true,
      );

      if (response.success) {
        await fetchCamps();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}
