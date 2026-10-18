import 'package:flutter/foundation.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/services/api_service.dart';
import '../models/staff_models.dart';

class StaffProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  List<StaffCadetSummaryModel> _roster = [];
  List<StaffSessionModel> _sessions = [];
  List<PendingApprovalModel> _pendingApprovals = [];

  bool _isLoadingRoster = false;
  bool _isLoadingSessions = false;
  bool _isLoadingApprovals = false;
  String? _errorMessage;

  List<StaffCadetSummaryModel> get roster => _roster;
  List<StaffSessionModel> get sessions => _sessions;
  List<PendingApprovalModel> get pendingApprovals => _pendingApprovals;

  bool get isLoadingRoster => _isLoadingRoster;
  bool get isLoadingSessions => _isLoadingSessions;
  bool get isLoadingApprovals => _isLoadingApprovals;
  String? get errorMessage => _errorMessage;

  // 1. Fetch Cadet Roster
  Future<void> fetchCadetRoster() async {
    _isLoadingRoster = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.staffRoster, requiresAuth: true);

      if (response.success && response.rawJson != null) {
        if (response.rawJson!['summary'] is List) {
          final list = response.rawJson!['summary'] as List;
          _roster = list.map((item) => StaffCadetSummaryModel.fromJson(item as Map<String, dynamic>)).toList();
        }
        _isLoadingRoster = false;
        notifyListeners();
        return;
      }

      _errorMessage = response.message ?? 'Unable to retrieve cadet roster.';
    } catch (e) {
      _errorMessage = 'Network error: $e';
    } finally {
      _isLoadingRoster = false;
      notifyListeners();
    }
  }

  // 2. Fetch Drill Sessions
  Future<void> fetchSessions() async {
    _isLoadingSessions = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.staffAttendanceSessions, requiresAuth: true);

      if (response.success && response.rawJson != null) {
        if (response.rawJson!['sessions'] is List) {
          final list = response.rawJson!['sessions'] as List;
          _sessions = list.map((item) => StaffSessionModel.fromJson(item as Map<String, dynamic>)).toList();
        }
        _isLoadingSessions = false;
        notifyListeners();
        return;
      }

      _errorMessage = response.message ?? 'Unable to retrieve training sessions.';
    } catch (e) {
      _errorMessage = 'Network error: $e';
    } finally {
      _isLoadingSessions = false;
      notifyListeners();
    }
  }

  // 3. Fetch Pending Cadet Approvals
  Future<void> fetchPendingApprovals() async {
    _isLoadingApprovals = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await _api.get(ApiConstants.staffPendingApprovals, requiresAuth: true);

      if (response.success && response.rawJson != null) {
        final dynamic appsList = response.rawJson!['applications'] ?? response.rawJson!['pendingApplications'];
        if (appsList is List) {
          _pendingApprovals = appsList.map((item) => PendingApprovalModel.fromJson(item as Map<String, dynamic>)).toList();
        }
        _isLoadingApprovals = false;
        notifyListeners();
        return;
      }

      _errorMessage = response.message ?? 'Unable to retrieve pending approvals.';
    } catch (e) {
      _errorMessage = 'Network error: $e';
    } finally {
      _isLoadingApprovals = false;
      notifyListeners();
    }
  }

  // 4. Mark Cadet Attendance in a Session
  Future<bool> markCadetAttendance({
    required String sessionId,
    required String cadetId,
    required String status,
  }) async {
    try {
      final response = await _api.patch(
        ApiConstants.staffMarkAttendance(sessionId),
        body: {'cadetId': cadetId, 'status': status},
        requiresAuth: true,
      );
      return response.success;
    } catch (_) {
      return false;
    }
  }

  // 5. Submit Cadet Review Action
  Future<bool> processApprovalAction({
    required String cadetId,
    required String action,
    required String remarks,
  }) async {
    try {
      final response = await _api.post(
        ApiConstants.staffReviewAction(cadetId),
        body: {'action': action, 'remarks': remarks},
        requiresAuth: true,
      );

      if (response.success) {
        await fetchPendingApprovals();
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}

extension ApiPatch on ApiService {
  Future<ApiResponse> patch(String url, {dynamic body, bool requiresAuth = true}) {
    return put(url, body: body, requiresAuth: requiresAuth);
  }
}
