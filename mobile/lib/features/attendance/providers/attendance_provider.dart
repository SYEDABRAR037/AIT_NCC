import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/attendance_record_model.dart';

class AttendanceProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  AttendanceStats? _stats;
  List<AttendanceRecordModel> _records = [];
  bool _isLoading = false;
  String? _errorMessage;

  AttendanceStats? get stats => _stats;
  List<AttendanceRecordModel> get records => _records;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchAttendanceHistory() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.attendanceMyRecords, requiresAuth: true);

      if (response.success && response.rawJson != null) {
        if (response.rawJson!['stats'] is Map<String, dynamic>) {
          _stats = AttendanceStats.fromJson(response.rawJson!['stats']);
        }

        if (response.rawJson!['records'] is List) {
          final list = response.rawJson!['records'] as List;
          _records = list.map((item) => AttendanceRecordModel.fromJson(item as Map<String, dynamic>)).toList();
        }

        _isLoading = false;
        notifyListeners();
        return;
      }

      _errorMessage = response.message ?? 'Unable to retrieve attendance records.';
    } catch (e) {
      _errorMessage = 'Network error: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
