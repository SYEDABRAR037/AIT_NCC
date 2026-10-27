import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/inquiry_model.dart';

class InquiryProvider extends ChangeNotifier {
  InquiryProvider({ApiService? api}) : _api = api ?? ApiService();

  final ApiService _api;

  List<InquiryModel> _inquiries = [];
  bool _isLoading = false;
  String? _errorMessage;
  bool _isLoadingThread = false;
  String? _threadError;

  List<InquiryModel> get inquiries => _inquiries;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isLoadingThread => _isLoadingThread;
  String? get threadError => _threadError;

  Future<void> fetchInquiries() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.inquiries, requiresAuth: true);

      if (response.success && response.rawJson != null) {
        if (response.rawJson!['inquiries'] is List) {
          final list = response.rawJson!['inquiries'] as List;
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
        body: {'subject': title.trim(), 'message': description.trim(), 'priority': priority},
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

  Future<InquiryModel?> fetchThread(String id) async {
    _isLoadingThread = true;
    _threadError = null;
    notifyListeners();
    try {
      final response = await _api.get(ApiConstants.inquiryThread(Uri.encodeComponent(id)));
      final data = response.rawJson?['inquiry'];
      if (response.success && data is Map<String, dynamic>) {
        return InquiryModel.fromJson(data);
      }
      _threadError = response.message ?? 'Unable to load this inquiry thread.';
    } catch (e) {
      _threadError = 'Unable to load this inquiry thread: $e';
    } finally {
      _isLoadingThread = false;
      notifyListeners();
    }
    return null;
  }

  Future<bool> replyToInquiry({required String id, required String message}) async {
    _errorMessage = null;
    try {
      final response = await _api.post(
        ApiConstants.inquiryReply(Uri.encodeComponent(id)),
        body: {'message': message.trim()},
      );
      if (response.success) {
        await fetchInquiries();
        return true;
      }
      _errorMessage = response.message ?? 'Unable to send the reply.';
    } catch (e) {
      _errorMessage = 'Unable to send the reply: $e';
    }
    notifyListeners();
    return false;
  }

  Future<bool> updateStatus({
    required String id,
    required String status,
    String? remarks,
  }) async {
    _errorMessage = null;
    try {
      final response = await _api.patch(
        ApiConstants.inquiryStatus(Uri.encodeComponent(id)),
        body: {'status': status, if (remarks != null && remarks.trim().isNotEmpty) 'remarks': remarks.trim()},
      );
      if (response.success) {
        await fetchInquiries();
        return true;
      }
      _errorMessage = response.message ?? 'Unable to update inquiry status.';
    } catch (e) {
      _errorMessage = 'Unable to update inquiry status: $e';
    }
    notifyListeners();
    return false;
  }
}
