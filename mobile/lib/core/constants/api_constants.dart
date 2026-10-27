import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb, kReleaseMode;

class ApiConstants {
  // Base URL resolution:
  // - Android emulator: 10.0.2.2:5050
  // - iOS simulator / desktop: 127.0.0.1:5050
  // - Release fallback: production API; NCC_API_BASE_URL can override at build time.
  static String get defaultBaseUrl {
    const configuredUrl = String.fromEnvironment('NCC_API_BASE_URL');
    if (configuredUrl.trim().isNotEmpty) {
      return configuredUrl.trim().replaceFirst(RegExp(r'/+$'), '');
    }
    if (kReleaseMode) return productionBaseUrl;
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

  // Password recovery endpoints
  static String get recoveryRequestOtp => '$activeBaseUrl/auth/recovery/request-otp';
  static String get recoveryResendOtp => '$activeBaseUrl/auth/recovery/resend-otp';
  static String get recoveryVerifyOtp => '$activeBaseUrl/auth/recovery/verify-otp';
  static String get recoveryResetPassword => '$activeBaseUrl/auth/recovery/reset-password';

  // Cadet endpoints
  static String get digitalId => '$activeBaseUrl/digital-id/me';
  static String get attendanceMyRecords => '$activeBaseUrl/attendance/my';
  static String get publicNotices => '$activeBaseUrl/public/notices';
  static String get publicEvents => '$activeBaseUrl/public/events';
  static String get leaveApplications => '$activeBaseUrl/leave/my';
  static String get leaveApply => '$activeBaseUrl/leave/apply';
  static String get camps => '$activeBaseUrl/camps';
  static String campApply(String campId) => '$activeBaseUrl/camps/$campId/apply';
  static String get inquiries => '$activeBaseUrl/requests/inquiries';
  static String get inquirySubmit => '$activeBaseUrl/requests/inquiry';
  static String inquiryThread(String id) => '$activeBaseUrl/requests/inquiry/$id';
  static String inquiryReply(String id) => '$activeBaseUrl/requests/inquiry/$id/reply';
  static String inquiryStatus(String id) => '$activeBaseUrl/requests/inquiry/$id/status';
  static String get leaveReview => '$activeBaseUrl/leave/review';
  static String leaveReviewAction(String id) => '$activeBaseUrl/leave/$id/action';

  // Staff endpoints
  static String get staffRoster => '$activeBaseUrl/attendance/summary';
  static String get staffAttendanceSessions => '$activeBaseUrl/attendance/sessions';
  static String staffSessionDetails(String sessionId) => '$activeBaseUrl/attendance/sessions/$sessionId';
  static String staffMarkAttendance(String sessionId) => '$activeBaseUrl/attendance/sessions/$sessionId/mark';
  static String get staffPendingApprovals => '$activeBaseUrl/reviews/pending';
  static String staffReviewAction(String cadetId) => '$activeBaseUrl/reviews/$cadetId/action';

  static String get activeUrl => activeBaseUrl;
}
