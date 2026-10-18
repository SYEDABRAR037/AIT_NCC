import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

class ApiConstants {
  // Base URL resolution:
  // - Android emulator: 10.0.2.2:5050
  // - iOS simulator / desktop: 127.0.0.1:5050
  // - Production fallback: https://ait-ncc.onrender.com/api
  static String get defaultBaseUrl {
    if (kIsWeb) {
      return 'http://127.0.0.1:5050/api';
    }
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:5050/api';
      }
      return 'http://127.0.0.1:5050/api';
    } catch (_) {
      return 'http://127.0.0.1:5050/api';
    }
  }

  static const String productionBaseUrl = 'https://ait-ncc.onrender.com/api';

  // Configurable base URL (can be switched in settings or fallback)
  static String activeBaseUrl = defaultBaseUrl;

  // Auth endpoints
  static String get login => '$activeBaseUrl/auth/login';
  static String get verifyLoginOtp => '$activeBaseUrl/auth/login/verify-otp';
  static String get resendOtp => '$activeBaseUrl/auth/otp/resend';
  static String get me => '$activeBaseUrl/auth/me';
  static String get logout => '$activeBaseUrl/auth/logout';

  // Cadet endpoints
  static String get digitalId => '$activeBaseUrl/digital-id/me';
  static String get attendanceMyRecords => '$activeBaseUrl/attendance/my';
  static String get publicNotices => '$activeBaseUrl/public/notices';
  static String get publicEvents => '$activeBaseUrl/public/events';
  static String get leaveApplications => '$activeBaseUrl/leave/my';
  static String get leaveApply => '$activeBaseUrl/leave/apply';
  static String get camps => '$activeBaseUrl/camps';
  static String campApply(String campId) => '$activeBaseUrl/camps/$campId/apply';
  static String get inquiries => '$activeBaseUrl/requests/my';
  static String get inquirySubmit => '$activeBaseUrl/requests/submit';

  // Staff endpoints
  static String get staffRoster => '$activeBaseUrl/attendance/summary';
  static String get staffAttendanceSessions => '$activeBaseUrl/attendance/sessions';
  static String staffSessionDetails(String sessionId) => '$activeBaseUrl/attendance/sessions/$sessionId';
  static String staffMarkAttendance(String sessionId) => '$activeBaseUrl/attendance/sessions/$sessionId/mark';
  static String get staffPendingApprovals => '$activeBaseUrl/review/pending';
  static String staffReviewAction(String cadetId) => '$activeBaseUrl/review/$cadetId/action';

  static String get activeUrl => activeBaseUrl;
}
