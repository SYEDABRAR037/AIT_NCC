import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/camp_model.dart';

class CampProvider extends ChangeNotifier {
  CampProvider({ApiService? api}) : _api = api ?? ApiService();

  final ApiService _api;

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
    _errorMessage = null;
    try {
      final response = await _api.post(
        ApiConstants.campApply(campId),
        requiresAuth: true,
      );

      if (response.success) {
        await fetchCamps();
        return true;
      }
      _errorMessage = response.message ?? 'Failed to apply for camp.';
      return false;
    } catch (e) {
      _errorMessage = 'Network error while applying for camp: $e';
      return false;
    }
  }

  Future<bool> updateParticipantStatus({
    required String campId,
    required String cadetId,
    required String status,
    String? remarks,
  }) async {
    _errorMessage = null;
    try {
      final response = await _api.patch(
        '${ApiConstants.camps}/${Uri.encodeComponent(campId)}/participants/${Uri.encodeComponent(cadetId)}',
        body: {'status': status, if (remarks != null && remarks.trim().isNotEmpty) 'remarks': remarks.trim()},
      );
      if (response.success) {
        await fetchCamps();
        return true;
      }
      _errorMessage = response.message ?? 'Unable to update camp nomination.';
    } catch (e) {
      _errorMessage = 'Unable to update camp nomination: $e';
    }
    notifyListeners();
    return false;
  }
}
