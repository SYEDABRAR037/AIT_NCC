import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/digital_id_model.dart';

class DigitalIdProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  DigitalIdModel? _digitalId;
  bool _isLoading = false;
  String? _errorMessage;

  DigitalIdModel? get digitalId => _digitalId;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchDigitalId() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.digitalId, requiresAuth: true);

      if (response.success && response.rawJson != null) {
        final cadetJson = response.rawJson!['cadet'];
        final token = response.rawJson!['token']?.toString() ?? '';

        if (cadetJson is Map<String, dynamic>) {
          _digitalId = DigitalIdModel.fromJson(cadetJson, token);
          _isLoading = false;
          notifyListeners();
          return;
        }
      }

      _errorMessage = response.message ?? 'Unable to retrieve Digital ID.';
    } catch (e) {
      _errorMessage = 'Network error: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
