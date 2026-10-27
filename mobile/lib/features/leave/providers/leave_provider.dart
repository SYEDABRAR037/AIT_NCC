import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/leave_model.dart';

class LeaveProvider extends ChangeNotifier {
  LeaveProvider({ApiService? api}) : _api = api ?? ApiService();

  final ApiService _api;

  List<LeaveModel> _leaves = [];
  bool _isLoading = false;
  String? _errorMessage;
  List<LeaveModel> _reviewLeaves = [];
  bool _isLoadingReview = false;
  String? _reviewErrorMessage;

  List<LeaveModel> get leaves => _leaves;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  List<LeaveModel> get reviewLeaves => _reviewLeaves;
  bool get isLoadingReview => _isLoadingReview;
  String? get reviewErrorMessage => _reviewErrorMessage;

  Future<void> fetchReviewLeaves() async {
    _isLoadingReview = true;
    _reviewErrorMessage = null;
    notifyListeners();
    try {
      final response = await _api.get(ApiConstants.leaveReview);
      final values = response.rawJson?['leaves'];
      if (response.success && values is List) {
        _reviewLeaves = values
            .whereType<Map<String, dynamic>>()
            .map(LeaveModel.fromJson)
            .toList();
      } else {
        _reviewErrorMessage = response.message ?? 'Unable to load leave reviews.';
      }
    } catch (e) {
      _reviewErrorMessage = 'Unable to load leave reviews: $e';
    } finally {
      _isLoadingReview = false;
      notifyListeners();
    }
  }

  Future<bool> processReview({
    required String leaveId,
    required String action,
    String? remarks,
  }) async {
    _reviewErrorMessage = null;
    try {
      final response = await _api.patch(
        ApiConstants.leaveReviewAction(Uri.encodeComponent(leaveId)),
        body: {'action': action, if (remarks != null && remarks.trim().isNotEmpty) 'remarks': remarks.trim()},
      );
      if (response.success) {
        await fetchReviewLeaves();
        return true;
      }
      _reviewErrorMessage = response.message ?? 'Unable to process this leave review.';
    } catch (e) {
      _reviewErrorMessage = 'Unable to process this leave review: $e';
    }
    notifyListeners();
    return false;
  }

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
    _errorMessage = null;
    try {
      final response = await _api.post(
        '${ApiConstants.activeBaseUrl}/leave/$leaveId/cancel',
        requiresAuth: true,
      );
      if (response.success) {
        await fetchLeaves();
        return true;
      }
      _errorMessage = response.message ?? 'Failed to cancel leave request.';
      return false;
    } catch (e) {
      _errorMessage = 'Network error while cancelling leave: $e';
      return false;
    }
  }
}
