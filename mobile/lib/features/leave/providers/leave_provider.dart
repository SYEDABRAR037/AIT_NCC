import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/leave_model.dart';

class LeaveProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<LeaveModel> _leaves = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<LeaveModel> get leaves => _leaves;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchLeaves() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.leaveApplications, requiresAuth: true);

      if (response.success && response.rawJson != null) {
        if (response.rawJson!['leaves'] is List) {
          final list = response.rawJson!['leaves'] as List;
          _leaves = list.map((item) => LeaveModel.fromJson(item as Map<String, dynamic>)).toList();
        }
        _isLoading = false;
        notifyListeners();
        return;
      }

      _errorMessage = response.message ?? 'Unable to retrieve leave applications.';
    } catch (e) {
      _errorMessage = 'Network error: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> submitLeave({
    required String leaveType,
    required DateTime startDate,
    required DateTime endDate,
    required String reason,
    String? documentUrl,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.post(
        ApiConstants.leaveApply,
        body: {
          'leaveType': leaveType,
          'startDate': startDate.toIso8601String(),
          'endDate': endDate.toIso8601String(),
          'reason': reason.trim(),
          if (documentUrl != null && documentUrl.isNotEmpty) 'documentUrl': documentUrl.trim(),
        },
        requiresAuth: true,
      );

      if (response.success) {
        await fetchLeaves();
        return true;
      }

      _errorMessage = response.message ?? 'Failed to submit leave application.';
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'Error submitting leave: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> cancelLeave(String leaveId) async {
    try {
      final response = await _api.post(
        '${ApiConstants.activeBaseUrl}/leave/$leaveId/cancel',
        requiresAuth: true,
      );
      if (response.success) {
        await fetchLeaves();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}
