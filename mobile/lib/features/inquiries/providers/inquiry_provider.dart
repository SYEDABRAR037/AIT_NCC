import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/inquiry_model.dart';

class InquiryProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<InquiryModel> _inquiries = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<InquiryModel> get inquiries => _inquiries;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchInquiries() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.inquiries, requiresAuth: true);

      if (response.success && response.rawJson != null) {
        if (response.rawJson!['requests'] is List) {
          final list = response.rawJson!['requests'] as List;
          _inquiries = list.map((item) => InquiryModel.fromJson(item as Map<String, dynamic>)).toList();
        }
        _isLoading = false;
        notifyListeners();
        return;
      }

      _errorMessage = response.message ?? 'Failed to retrieve inquiries.';
    } catch (e) {
      _errorMessage = 'Network error: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> submitInquiry({
    required String requestType,
    required String title,
    required String description,
    String priority = 'NORMAL',
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.post(
        ApiConstants.inquirySubmit,
        body: {
          'requestType': requestType,
          'title': title.trim(),
          'description': description.trim(),
          'priority': priority,
        },
        requiresAuth: true,
      );

      if (response.success) {
        await fetchInquiries();
        return true;
      }

      _errorMessage = response.message ?? 'Failed to submit inquiry.';
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'Error submitting inquiry: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }
}
