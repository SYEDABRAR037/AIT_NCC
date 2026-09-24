import { Router } from 'express';
import {
  createAttendanceSession,
  getAttendanceSessions,
  getSessionAttendance,
  markAttendance,
  getMyAttendanceHistory,
  getAttendanceSummary,
  bulkImportAttendance,
  verifyFaceAttendance,
  endAttendanceSession,
  getSessionAbsentList,
  getSessionNotificationsLedger,
  enrollBiometricTemplate,
  getBiometricEnrollmentRoster,
  getEligibleBiometrics,
  getSessionLiveStats,
} from '../controllers/attendance.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Bulk import from Google Sheets / CSV
router.post(
  '/bulk-import',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  bulkImportAttendance
);

// Session creation: Platoon Senior, Senior, and Admin/ANO (Phase 7 Parity)
router.post(
  '/sessions',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  createAttendanceSession
);

router.get(
  '/sessions',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  getAttendanceSessions
);

router.get(
  '/sessions/:sessionId',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  getSessionAttendance
);

// Live Face Verification (Platoon Senior, Senior, and Admin/ANO)
router.post(
  '/sessions/:sessionId/verify-face',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  verifyFaceAttendance
);

// Pre-load Eligible Biometrics for fast local verification (Platoon Senior & Senior only)
router.get(
  '/sessions/:sessionId/eligible-biometrics',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  getEligibleBiometrics
);

// Real-Time Live Counter Stats — Expected / Present / Remaining (DB authoritative)
router.get(
  '/sessions/:sessionId/live-stats',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  getSessionLiveStats
);

// End Attendance Session (Platoon Senior, Senior & ANO)
router.post(
  '/sessions/:sessionId/end',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  endAttendanceSession
);

// Get Absent List for a session
router.get(
  '/sessions/:sessionId/absent-list',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  getSessionAbsentList
);

// Get Notification Audit Ledger for a session
router.get(
  '/sessions/:sessionId/notifications',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  getSessionNotificationsLedger
);

// Biometric Enrollment (Store 128-d face descriptors)
router.post(
  '/biometrics/enroll',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  enrollBiometricTemplate
);

router.get(
  '/biometrics/roster',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  getBiometricEnrollmentRoster
);

// Manual mark attendance fallback (Platoon Senior, Senior, Admin)
router.patch(
  '/sessions/:sessionId/mark',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  markAttendance
);

// Cadet views own history
router.get(
  '/my',
  requireRole(['CADET', 'SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']),
  getMyAttendanceHistory
);

// Platoon / Senior / Admin attendance summary
router.get(
  '/summary',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  getAttendanceSummary
);

export default router;
