import { Router } from 'express';
import {
  createAttendanceSession,
  previewAttendanceEligibility,
  getAttendanceSessions,
  getSessionAttendance,
  markAttendance,
  getMyAttendanceHistory,
  getAttendanceSummary,
  bulkImportAttendance,
  issueVerificationChallenge,
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
  '/sessions/eligibility-preview',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  previewAttendanceEligibility
);

router.post(
  '/sessions',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO']),
  createAttendanceSession
);

router.get(
  '/sessions',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO', 'DRILL_INSTRUCTOR']),
  getAttendanceSessions
);

router.get(
  '/sessions/:sessionId',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO', 'DRILL_INSTRUCTOR']),
  getSessionAttendance
);

// Issue single-use verification challenge token (required before face verification)
router.get(
  '/sessions/:sessionId/verification-challenge',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO', 'DRILL_INSTRUCTOR']),
  issueVerificationChallenge
);

// Live Face Verification (Platoon Senior, Senior, Admin/ANO, and Drill Instructor)
router.post(
  '/sessions/:sessionId/verify-face',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO', 'DRILL_INSTRUCTOR']),
  verifyFaceAttendance
);

// Pre-load Eligible Biometrics for fast local verification (Platoon Senior, Senior, Admin/ANO, Drill Instructor)
router.get(
  '/sessions/:sessionId/eligible-biometrics',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO', 'DRILL_INSTRUCTOR']),
  getEligibleBiometrics
);

// Real-Time Live Counter Stats — Expected / Present / Remaining (DB authoritative)
router.get(
  '/sessions/:sessionId/live-stats',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO', 'DRILL_INSTRUCTOR']),
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
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO', 'DRILL_INSTRUCTOR']),
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

// Manual mark attendance fallback (Platoon Senior, Senior, Admin, Drill Instructor)
router.patch(
  '/sessions/:sessionId/mark',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO', 'DRILL_INSTRUCTOR']),
  markAttendance
);

// Cadet views own history
router.get(
  '/my',
  requireRole(['CADET', 'SENIOR', 'PLATOON_SENIOR', 'ADMIN_ANO']),
  getMyAttendanceHistory
);

// Platoon / Senior / Admin / DI attendance summary
router.get(
  '/summary',
  requireRole(['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO', 'DRILL_INSTRUCTOR']),
  getAttendanceSummary
);

export default router;
