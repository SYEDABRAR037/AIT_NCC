import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  triggerPresentAttendanceNotifications,
  triggerAbsentAttendanceNotifications,
  getSessionNotificationAuditLedger,
  maskPhoneNumber,
} from '../services/attendanceNotification.service';

// ============================================================
// PHASE 10: ATTENDANCE MANAGEMENT SYSTEM
// ============================================================

// ---------------------------------------------------------------------------
// Helper: Resolve the set of cadet IDs that the calling officer may manage.
// - ADMIN_ANO / PLATOON_SENIOR: all active cadets (no restriction).
// - SENIOR: cadets explicitly assigned via SeniorAssignment; if none exist
//   yet, falls back to ALL active cadets so sessions are immediately usable.
// ---------------------------------------------------------------------------
async function getAuthorizedCadetIds(
  role: string,
  userId: string
): Promise<string[] | null> {
  // null means "no restriction — return all active cadets"
  if (role === 'ADMIN_ANO' || role === 'PLATOON_SENIOR') return null;

  if (role === 'SENIOR') {
    const assignments = await prisma.seniorAssignment.findMany({
      where: { seniorId: userId },
      select: { cadetId: true },
    });
    if (assignments.length > 0) {
      return assignments.map((a) => a.cadetId);
    }
    // No explicit assignments yet — fall back to all active cadets so the
    // Senior can operate without an empty scope.
    return null;
  }

  return null;
}

// 1. Create an Attendance Session (Platoon Senior / Senior / Admin)
export const createAttendanceSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Role check: Only Platoon Senior, Senior, and Admin can start attendance
    if (!['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO'].includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only Platoon Seniors and Seniors can start attendance sessions.',
      });
      return;
    }

    const { title, activity, timing, startTime, location, focus, targetPlatoon, date } = req.body;

    if (!activity) {
      res.status(400).json({ success: false, message: 'Activity is required' });
      return;
    }

    const sessionDate = date ? new Date(date) : new Date();
    const effectivePlatoon = targetPlatoon || 'Unit Contingent';
    const effectiveTitle = title ? String(title).trim() : `${activity} — Parade Muster`;

    // Determine eligible cadets dynamically from the real database (all active unit cadets)
    const whereClause: any = { role: 'CADET', status: { in: ['APPROVED', 'ACTIVE'] } };

    if (req.user.role === 'SENIOR') {
      const authorizedIds = await getAuthorizedCadetIds(req.user.role, req.user.id);
      if (authorizedIds !== null) {
        whereClause.id = { in: authorizedIds };
      }
    }

    const eligibleCadets = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        platoonName: true,
        biometricTemplate: { select: { id: true } },
      },
    });

    const session = await prisma.trainingSession.create({
      data: {
        title: effectiveTitle,
        activity: String(activity).trim(),
        timing: timing ? String(timing).trim() : '0600 - 0730 hrs',
        startTime: startTime ? String(startTime).trim() : '06:00',
        location: location ? String(location).trim() : 'AIT Parade Grounds',
        focus: focus ? String(focus).trim() : 'Live Biometric Muster',
        conductedBy: req.user.id,
        creatorRole: req.user.role,
        targetPlatoon: effectivePlatoon,
        status: 'ACTIVE',
        expectedCount: eligibleCadets.length,
        presentCount: 0,
        absentCount: 0,
        date: sessionDate,
      },
    });

    // IMPORTANT: Per strict requirement, do NOT pre-mark cadets Present!
    // The session begins in ACTIVE state with 0 present records.
    // Present records are created one-by-one as cadets step in front of the camera.

    res.status(201).json({
      success: true,
      message: `Live attendance session started. ${eligibleCadets.length} eligible cadets expected.`,
      session,
      expectedCount: eligibleCadets.length,
      eligibleCadets: eligibleCadets.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        regimentalNumber: c.regimentalNumber,
        platoonName: c.platoonName,
        hasBiometrics: !!c.biometricTemplate,
      })),
    });
  } catch (error) {
    console.error('createAttendanceSession error:', error);
    res.status(500).json({ success: false, message: 'Failed to create attendance session' });
  }
};

// 2. Get all sessions (scoped by role)
export const getAttendanceSessions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const whereClause: any = {};
    // Senior can see all sessions in the unit (not just their own)
    // so that they can pick up and operate any session.

    const sessions = await prisma.trainingSession.findMany({
      where: whereClause,
      include: {
        attendance: {
          select: {
            status: true,
            cadetId: true,
          },
        },
        _count: {
          select: { attendance: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      count: sessions.length,
      sessions: sessions.map((s) => ({
        ...s,
        presentCount: s.attendance.filter((a) => a.status === 'PRESENT').length,
        absentCount: s.attendance.filter((a) => a.status === 'ABSENT').length,
        excusedCount: s.attendance.filter((a) => a.status === 'EXCUSED').length,
        totalEnrolled: s._count.attendance,
      })),
    });
  } catch (error) {
    console.error('getAttendanceSessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance sessions' });
  }
};

// 3. Get attendance records for a specific session
export const getSessionAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.trainingSession.findUnique({
      where: { id: String(sessionId) },
      include: {
        attendance: {
          include: {
            cadet: {
              select: {
                id: true,
                fullName: true,
                regimentalNumber: true,
                collegeRollNumber: true,
                platoonName: true,
                year: true,
                branch: true,
              },
            },
          },
          orderBy: { cadet: { fullName: 'asc' } },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Attendance session not found' });
      return;
    }

    res.json({ success: true, session });
  } catch (error) {
    console.error('getSessionAttendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve session attendance' });
  }
};

// 4. Mark / Update attendance for a cadet in a session
export const markAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { sessionId } = req.params;
    const { cadetId, status } = req.body;

    const validStatuses = ['PRESENT', 'ABSENT', 'EXCUSED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: 'Status must be PRESENT, ABSENT, or EXCUSED' });
      return;
    }

    // Upsert: create if not exists, update if exists
    const record = await prisma.trainingAttendance.upsert({
      where: {
        sessionId_cadetId: {
          sessionId: String(sessionId),
          cadetId: String(cadetId),
        },
      },
      create: {
        sessionId: String(sessionId),
        cadetId: String(cadetId),
        status,
        verifiedBy: req.user.id,
      },
      update: {
        status,
        verifiedBy: req.user.id,
      },
      include: {
        cadet: { select: { id: true, fullName: true, regimentalNumber: true, phone: true } },
      },
    });

    // Database-First Rule: If marked PRESENT, trigger asynchronous SMS & WhatsApp notifications
    if (status === 'PRESENT') {
      const session = await prisma.trainingSession.findUnique({
        where: { id: String(sessionId) },
        select: { id: true, title: true, activity: true, date: true },
      });

      const now = new Date();
      const dateStr = session ? new Date(session.date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : now.toLocaleDateString();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      triggerPresentAttendanceNotifications({
        attendanceId: record.id,
        sessionId: String(sessionId),
        cadet: {
          id: record.cadet.id,
          fullName: record.cadet.fullName,
          phone: record.cadet.phone,
          regimentalNumber: record.cadet.regimentalNumber,
        },
        activityName: session?.activity || session?.title || 'Training Parade',
        dateStr,
        timeStr,
      }).catch((err) => console.error('[MARK ATTENDANCE NOTIFICATION ERROR]:', err));

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          actorName: req.user.fullName,
          action: 'ATTENDANCE_MARKED_PRESENT',
          targetType: 'TrainingAttendance',
          targetId: record.id,
          details: `Manual override marked PRESENT for Cadet ${record.cadet.fullName} (${record.cadet.regimentalNumber}) in Session ${sessionId}`,
        },
      }).catch((err) => console.error('[AUDIT LOG ERROR]:', err));
    }

    res.json({
      success: true,
      message: `Attendance marked as ${status} for ${record.cadet.fullName}`,
      record,
      notifications: status === 'PRESENT' ? { sms: 'QUEUED', whatsapp: 'QUEUED' } : undefined,
    });
  } catch (error) {
    console.error('markAttendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark attendance' });
  }
};

// 5. Get a cadet's own attendance history
export const getMyAttendanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const records = await prisma.trainingAttendance.findMany({
      where: { cadetId: req.user.id },
      include: {
        session: {
          select: {
            id: true,
            title: true,
            activity: true,
            date: true,
            timing: true,
            location: true,
            targetPlatoon: true,
          },
        },
      },
      orderBy: { session: { date: 'desc' } },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const excused = records.filter((r) => r.status === 'EXCUSED').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    res.json({
      success: true,
      stats: { total, present, absent, excused, percentage },
      records,
    });
  } catch (error) {
    console.error('getMyAttendanceHistory error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance history' });
  }
};

// 6. Get attendance summary for a platoon / all cadets (Admin / Platoon Senior)
export const getAttendanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const cadetWhereClause: any = { role: 'CADET', status: { in: ['APPROVED', 'ACTIVE'] } };

    // Scope summary to authorized cadets for SENIOR role
    const authorizedIds = await getAuthorizedCadetIds(req.user.role, req.user.id);
    if (authorizedIds !== null) {
      cadetWhereClause.id = { in: authorizedIds };
    }

    const cadets = await prisma.user.findMany({
      where: cadetWhereClause,
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        platoonName: true,
        year: true,
        branch: true,
        trainingAttendances: {
          select: { status: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const summary = cadets.map((c) => {
      const total = c.trainingAttendances.length;
      const present = c.trainingAttendances.filter((a) => a.status === 'PRESENT').length;
      const absent = c.trainingAttendances.filter((a) => a.status === 'ABSENT').length;
      const excused = c.trainingAttendances.filter((a) => a.status === 'EXCUSED').length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      return {
        id: c.id,
        fullName: c.fullName,
        regimentalNumber: c.regimentalNumber,
        platoonName: c.platoonName,
        year: c.year,
        branch: c.branch,
        stats: { total, present, absent, excused, percentage },
      };
    });

    res.json({ success: true, count: summary.length, summary });
  } catch (error) {
    console.error('getAttendanceSummary error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance summary' });
  }
};

// 7. Bulk Import Attendance from Google Sheets / CSV
export const bulkImportAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { sessionId, records } = req.body;

    if (!sessionId || !Array.isArray(records) || records.length === 0) {
      res.status(400).json({ success: false, message: 'Session ID and valid records list are required' });
      return;
    }

    const session = await prisma.trainingSession.findUnique({ where: { id: String(sessionId) } });
    if (!session) {
      res.status(404).json({ success: false, message: 'Parade training session not found' });
      return;
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const item of records) {
      const identifier = item.regimentalNumber || item.collegeRollNumber || item.identifier;
      if (!identifier) continue;

      const cadet = await prisma.user.findFirst({
        where: {
          OR: [
            { regimentalNumber: { equals: String(identifier).trim(), mode: 'insensitive' } },
            { collegeRollNumber: { equals: String(identifier).trim(), mode: 'insensitive' } },
          ],
        },
      });

      if (!cadet) {
        errors.push(`Cadet with identifier "${identifier}" not found`);
        continue;
      }

      const rawStatus = String(item.status || 'PRESENT').toUpperCase();
      const status = ['PRESENT', 'ABSENT', 'EXCUSED'].includes(rawStatus) ? rawStatus : 'PRESENT';

      await prisma.trainingAttendance.upsert({
        where: {
          sessionId_cadetId: {
            sessionId: session.id,
            cadetId: cadet.id,
          },
        },
        create: {
          sessionId: session.id,
          cadetId: cadet.id,
          status,
          verifiedBy: `SHEET_IMPORT (${req.user.fullName || 'Officer'})`,
        },
        update: {
          status,
          verifiedBy: `SHEET_IMPORT (${req.user.fullName || 'Officer'})`,
        },
      });

      successCount++;
    }

    res.json({
      success: true,
      message: `Successfully processed ${successCount} attendance records from Google Sheet / CSV.`,
      successCount,
      errorsCount: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('bulkImportAttendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk import attendance' });
  }
};

// ============================================================
// PHASE 11: LIVE FACE ATTENDANCE & BIOMETRIC VERIFICATION
// ============================================================

// 8. Live Face Verification & Instant Cadet Identification
export const verifyFaceAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Only Platoon Senior and Senior have permission to verify live face attendance
    if (!['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO'].includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Only Platoon Seniors and Seniors can operate live face attendance.',
      });
      return;
    }

    const { sessionId } = req.params;
    const { descriptor, livenessVerified } = req.body;

    if (!Array.isArray(descriptor) || descriptor.length < 128) {
      res.status(400).json({
        success: false,
        message: 'Invalid biometric face descriptor. 128-dimensional embedding required.',
      });
      return;
    }

    // Fetch session and verify it is ACTIVE
    const session = await prisma.trainingSession.findUnique({
      where: { id: String(sessionId) },
      include: {
        attendance: true,
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Attendance session not found.' });
      return;
    }

    if (session.status === 'CLOSED') {
      res.status(400).json({
        success: false,
        code: 'SESSION_CLOSED',
        message: 'This attendance session has ended and is CLOSED. No further attendance can be marked.',
      });
      return;
    }

    // Load registered biometric templates from database
    const allTemplates = await prisma.biometricTemplate.findMany({
      include: {
        cadet: {
          select: {
            id: true,
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            platoonName: true,
            status: true,
            role: true,
            phone: true,
          },
        },
      },
    });

    if (allTemplates.length === 0) {
      res.status(404).json({
        success: false,
        code: 'NO_TEMPLATES_REGISTERED',
        message: 'No registered biometric templates found in the database. Please enroll cadets first.',
      });
      return;
    }

    // Calculate Euclidean distance against all registered templates:
    // d = sqrt(sum((v_i - t_i)^2))
    let bestMatchTemplate: typeof allTemplates[0] | null = null;
    let minDistance = Infinity;

    for (const template of allTemplates) {
      try {
        const storedVector: number[] = JSON.parse(template.descriptor);
        let sumSq = 0;
        for (let i = 0; i < 128; i++) {
          const diff = (descriptor[i] || 0) - (storedVector[i] || 0);
          sumSq += diff * diff;
        }
        const dist = Math.sqrt(sumSq);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatchTemplate = template;
        }
      } catch (err) {
        // Skip malformed templates
      }
    }

    // Strictest institutional threshold for 128-d FaceNet embeddings: 0.52
    const MATCH_THRESHOLD = 0.52;

    if (!bestMatchTemplate || minDistance > MATCH_THRESHOLD) {
      res.status(422).json({
        success: false,
        code: 'FACE_NOT_VERIFIED',
        message: 'Face not verified. Please try again.',
        distance: minDistance < Infinity ? Math.round(minDistance * 1000) / 1000 : null,
      });
      return;
    }

    const matchedCadet = bestMatchTemplate.cadet;

    // Check account status
    if (!['APPROVED', 'ACTIVE'].includes(matchedCadet.status)) {
      res.status(403).json({
        success: false,
        code: 'CADET_INACTIVE',
        cadet: { fullName: matchedCadet.fullName, regimentalNumber: matchedCadet.regimentalNumber },
        message: `Cadet account is ${matchedCadet.status}. Verification not authorized.`,
      });
      return;
    }

    // All approved active cadets in the unit are eligible for live attendance

    if (req.user.role === 'SENIOR') {
      // If explicit assignments exist, enforce scope. Otherwise allow all cadets
      // (graceful fallback when no SeniorAssignment rows have been seeded yet).
      const authorizedIds = await getAuthorizedCadetIds(req.user.role, req.user.id);
      if (authorizedIds !== null && !authorizedIds.includes(matchedCadet.id)) {
        res.status(403).json({
          success: false,
          code: 'NOT_ELIGIBLE',
          cadet: { fullName: matchedCadet.fullName, regimentalNumber: matchedCadet.regimentalNumber },
          message: 'Face recognized, but cadet is not assigned to your senior mentor squad.',
        });
        return;
      }
    }

    // CHECK 2: APPROVED LEAVE
    const sessionDateStart = new Date(session.date);
    sessionDateStart.setHours(0, 0, 0, 0);
    const sessionDateEnd = new Date(session.date);
    sessionDateEnd.setHours(23, 59, 59, 999);

    const approvedLeave = await prisma.leave.findFirst({
      where: {
        cadetId: matchedCadet.id,
        status: 'APPROVED',
        startDate: { lte: sessionDateEnd },
        endDate: { gte: sessionDateStart },
      },
    });

    if (approvedLeave) {
      res.status(400).json({
        success: false,
        code: 'APPROVED_LEAVE',
        cadet: {
          fullName: matchedCadet.fullName,
          regimentalNumber: matchedCadet.regimentalNumber,
          leaveReason: approvedLeave.reason,
        },
        message: 'Absent — Approved Leave. Cadet has an authorized leave sanction for this date.',
      });
      return;
    }

    // CHECK 3: DUPLICATE ATTENDANCE
    const existingAttendance = await prisma.trainingAttendance.findUnique({
      where: {
        sessionId_cadetId: {
          sessionId: session.id,
          cadetId: matchedCadet.id,
        },
      },
    });

    if (existingAttendance && existingAttendance.status === 'PRESENT') {
      const markedTime = new Date(existingAttendance.createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      res.status(409).json({
        success: false,
        code: 'ALREADY_MARKED',
        duplicate: true,
        cadet: {
          id: matchedCadet.id,
          fullName: matchedCadet.fullName,
          regimentalNumber: matchedCadet.regimentalNumber,
        },
        markedTime,
        message: `✓ Already Marked Present\nCadet: ${matchedCadet.fullName}\nTime: ${markedTime}`,
      });
      return;
    }

    // MARK PRESENT WITH METRIC LOGGING
    const confidenceScore = Math.round((1 - minDistance) * 1000) / 10; // e.g. 98.4%
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const record = await prisma.trainingAttendance.upsert({
      where: {
        sessionId_cadetId: {
          sessionId: session.id,
          cadetId: matchedCadet.id,
        },
      },
      create: {
        sessionId: session.id,
        cadetId: matchedCadet.id,
        status: 'PRESENT',
        verificationMethod: 'LIVE_FACE_VERIFIED',
        verificationStatus: 'VERIFIED',
        confidenceScore,
        verifiedBy: `${req.user.fullName} (${req.user.role})`,
        createdAt: now,
      },
      update: {
        status: 'PRESENT',
        verificationMethod: 'LIVE_FACE_VERIFIED',
        verificationStatus: 'VERIFIED',
        confidenceScore,
        verifiedBy: `${req.user.fullName} (${req.user.role})`,
      },
    });

    // Update real-time session counter in DB
    const presentCount = await prisma.trainingAttendance.count({
      where: {
        sessionId: session.id,
        status: 'PRESENT',
      },
    });

    await prisma.trainingSession.update({
      where: { id: session.id },
      data: { presentCount },
    });

    const remainingCount = Math.max(0, session.expectedCount - presentCount);
    const dateFormatted = new Date(session.date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Database-First Rule: Trigger asynchronous SMS & WhatsApp notifications after attendance commit
    triggerPresentAttendanceNotifications({
      attendanceId: record.id,
      sessionId: session.id,
      cadet: {
        id: matchedCadet.id,
        fullName: matchedCadet.fullName,
        phone: matchedCadet.phone,
        regimentalNumber: matchedCadet.regimentalNumber,
      },
      activityName: session.activity || session.title || 'Training Parade',
      dateStr: dateFormatted,
      timeStr: formattedTime,
    }).catch((err) => console.error('[PRESENT NOTIFICATION TRIGGER ERROR]:', err));

    // Audit Logging
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorName: req.user.fullName,
        action: 'ATTENDANCE_MARKED_PRESENT',
        targetType: 'TrainingAttendance',
        targetId: record.id,
        details: `Marked PRESENT via LIVE_FACE_VERIFIED for Cadet ${matchedCadet.fullName} (${matchedCadet.regimentalNumber}) in Session ${session.id}`,
      },
    }).catch((err) => console.error('[AUDIT LOG ERROR]:', err));

    res.json({
      success: true,
      code: 'FACE_VERIFIED',
      message: '✓ FACE VERIFIED',
      cadet: {
        id: matchedCadet.id,
        fullName: matchedCadet.fullName,
        regimentalNumber: matchedCadet.regimentalNumber,
        collegeRollNumber: matchedCadet.collegeRollNumber,
        platoonName: matchedCadet.platoonName,
      },
      time: formattedTime,
      confidenceScore,
      livenessConfirmed: !!livenessVerified,
      sessionStats: {
        expected: session.expectedCount,
        present: presentCount,
        remaining: remainingCount,
      },
      record,
      notifications: {
        sms: 'QUEUED',
        whatsapp: 'QUEUED',
      },
    });
  } catch (error) {
    console.error('verifyFaceAttendance error:', error);
    res.status(500).json({ success: false, message: 'Face attendance verification failed' });
  }
};

// 9. End Attendance Session & Reconcile Absent List
export const endAttendanceSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!['PLATOON_SENIOR', 'SENIOR', 'ADMIN_ANO'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Unauthorized: Only Platoon Seniors and Seniors can end sessions.' });
      return;
    }

    const { sessionId } = req.params;

    const session = await prisma.trainingSession.findUnique({
      where: { id: String(sessionId) },
      include: {
        attendance: true,
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const endTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Query all eligible cadets for this session from DB
    const whereClause: any = { role: 'CADET', status: { in: ['APPROVED', 'ACTIVE'] } };

    const eligibleCadets = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        platoonName: true,
        phone: true,
      },
    });

    // Determine who was marked PRESENT
    const presentCadetIds = new Set(
      session.attendance.filter((a) => a.status === 'PRESENT').map((a) => a.cadetId)
    );

    const absentCadetsList: any[] = [];
    const sessionDateStart = new Date(session.date);
    sessionDateStart.setHours(0, 0, 0, 0);
    const sessionDateEnd = new Date(session.date);
    sessionDateEnd.setHours(23, 59, 59, 999);
    const sessionDateFormatted = new Date(session.date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let unexcusedCount = 0;
    let excusedCount = 0;

    // Reconcile unverified cadets
    for (const cadet of eligibleCadets) {
      if (!presentCadetIds.has(cadet.id)) {
        // Check for approved leave
        const leave = await prisma.leave.findFirst({
          where: {
            cadetId: cadet.id,
            status: 'APPROVED',
            startDate: { lte: sessionDateEnd },
            endDate: { gte: sessionDateStart },
          },
        });

        const status = leave ? 'EXCUSED' : 'ABSENT';
        const method = leave ? 'APPROVED_LEAVE' : 'NO_ATTENDANCE';
        const reason = leave ? `Approved Leave: ${leave.reason}` : 'Unexcused Absence';

        if (leave) {
          excusedCount++;
        } else {
          unexcusedCount++;
        }

        // Upsert absent record in database
        const absentRecord = await prisma.trainingAttendance.upsert({
          where: {
            sessionId_cadetId: {
              sessionId: session.id,
              cadetId: cadet.id,
            },
          },
          create: {
            sessionId: session.id,
            cadetId: cadet.id,
            status,
            verificationMethod: method,
            verificationStatus: 'FAILED',
            verifiedBy: `SESSION_RECONCILER (${req.user.fullName})`,
          },
          update: {
            status,
            verificationMethod: method,
            verificationStatus: 'FAILED',
            verifiedBy: `SESSION_RECONCILER (${req.user.fullName})`,
          },
        });

        // Database-First Rule: For unexcused absences, automatically queue ABSENT SMS and WhatsApp notifications
        if (!leave) {
          triggerAbsentAttendanceNotifications({
            attendanceId: absentRecord.id,
            sessionId: session.id,
            cadet: {
              id: cadet.id,
              fullName: cadet.fullName,
              phone: cadet.phone,
              regimentalNumber: cadet.regimentalNumber,
            },
            activityName: session.activity || session.title || 'Training Parade',
            dateStr: sessionDateFormatted,
            timeStr: endTime,
          }).catch((err) => console.error('[ABSENT NOTIFICATION TRIGGER ERROR]:', err));
        }

        absentCadetsList.push({
          id: cadet.id,
          fullName: cadet.fullName,
          regimentalNumber: cadet.regimentalNumber,
          platoonName: cadet.platoonName,
          statusCategory: leave ? 'Absent — Approved Leave' : 'Absent — No Attendance',
          reason,
          hasLeave: !!leave,
          smsStatus: leave ? 'EXEMPT (APPROVED LEAVE)' : (cadet.phone ? 'QUEUED' : 'FAILED (NO PHONE)'),
          whatsappStatus: leave ? 'EXEMPT (APPROVED LEAVE)' : (cadet.phone ? 'QUEUED' : 'FAILED (NO PHONE)'),
          maskedPhone: maskPhoneNumber(cadet.phone || ''),
        });
      }
    }

    const finalPresentCount = presentCadetIds.size;
    const finalAbsentCount = absentCadetsList.length;

    const updatedSession = await prisma.trainingSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        endTime,
        presentCount: finalPresentCount,
        absentCount: finalAbsentCount,
      },
    });

    // Audit Logging
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorName: req.user.fullName,
        action: 'ATTENDANCE_SESSION_FINALIZED',
        targetType: 'TrainingSession',
        targetId: session.id,
        details: `Finalized session ${session.id} (${session.title}). Expected=${eligibleCadets.length}, Present=${finalPresentCount}, Absent=${finalAbsentCount} (${unexcusedCount} unexcused, ${excusedCount} approved leave). Queued ${unexcusedCount} Absent SMS and ${unexcusedCount} Absent WhatsApp notifications.`,
      },
    }).catch((err) => console.error('[AUDIT LOG ERROR]:', err));

    res.json({
      success: true,
      message: 'Attendance Session Closed',
      session: updatedSession,
      summary: {
        expected: eligibleCadets.length,
        present: finalPresentCount,
        absent: finalAbsentCount,
        unexcusedCount,
        excusedCount,
        absentNotifications: {
          smsQueued: unexcusedCount,
          whatsappQueued: unexcusedCount,
        },
      },
      absentCadets: absentCadetsList,
    });
  } catch (error) {
    console.error('endAttendanceSession error:', error);
    res.status(500).json({ success: false, message: 'Failed to end attendance session' });
  }
};

// 10. Get Absent List for a Session
export const getSessionAbsentList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.trainingSession.findUnique({
      where: { id: String(sessionId) },
      include: {
        attendance: {
          include: {
            cadet: {
              select: {
                id: true,
                fullName: true,
                regimentalNumber: true,
                collegeRollNumber: true,
                platoonName: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    const absentRecords = session.attendance.filter(
      (a) => a.status === 'ABSENT' || a.status === 'EXCUSED'
    );

    res.json({
      success: true,
      sessionTitle: session.title,
      date: session.date,
      status: session.status,
      absentCount: absentRecords.length,
      absents: absentRecords.map((a) => ({
        id: a.cadet.id,
        fullName: a.cadet.fullName,
        regimentalNumber: a.cadet.regimentalNumber,
        collegeRollNumber: a.cadet.collegeRollNumber,
        platoonName: a.cadet.platoonName,
        status: a.status,
        statusLabel: a.verificationMethod === 'APPROVED_LEAVE' ? 'Absent — Approved Leave' : 'Absent — No Attendance',
        verificationMethod: a.verificationMethod,
      })),
    });
  } catch (error) {
    console.error('getSessionAbsentList error:', error);
    res.status(500).json({ success: false, message: 'Failed to get absent list' });
  }
};

// 11. Biometric Enrollment: Store 128-d Face Embedding in DB
export const enrollBiometricTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!['ADMIN_ANO', 'PLATOON_SENIOR', 'SENIOR'].includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Unauthorized: Insufficient enrollment privileges.' });
      return;
    }

    const { cadetId, descriptor, photoSnapshot, qualityScore } = req.body;

    if (!cadetId || !Array.isArray(descriptor) || descriptor.length < 128) {
      res.status(400).json({
        success: false,
        message: 'Cadet ID and valid 128-element descriptor array are required.',
      });
      return;
    }

    const cadet = await prisma.user.findUnique({ where: { id: String(cadetId) } });
    if (!cadet) {
      res.status(404).json({ success: false, message: 'Cadet record not found.' });
      return;
    }

    const template = await prisma.biometricTemplate.upsert({
      where: { cadetId: cadet.id },
      create: {
        cadetId: cadet.id,
        descriptor: JSON.stringify(descriptor),
        photoSnapshot: photoSnapshot || null,
        qualityScore: typeof qualityScore === 'number' ? qualityScore : 0.95,
        registeredBy: `${req.user.fullName} (${req.user.role})`,
      },
      update: {
        descriptor: JSON.stringify(descriptor),
        photoSnapshot: photoSnapshot || null,
        qualityScore: typeof qualityScore === 'number' ? qualityScore : 0.95,
        registeredBy: `${req.user.fullName} (${req.user.role})`,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: `Biometric face template registered successfully for ${cadet.fullName}.`,
      cadet: {
        id: cadet.id,
        fullName: cadet.fullName,
        regimentalNumber: cadet.regimentalNumber,
      },
      registeredAt: template.registeredAt,
    });
  } catch (error) {
    console.error('enrollBiometricTemplate error:', error);
    res.status(500).json({ success: false, message: 'Failed to enroll biometric template' });
  }
};

// 12. Get Biometric Enrollment Roster Status
export const getBiometricEnrollmentRoster = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whereClause: any = { role: 'CADET', status: { in: ['APPROVED', 'ACTIVE'] } };

    const cadets = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        platoonName: true,
        year: true,
        branch: true,
        biometricTemplate: {
          select: {
            id: true,
            registeredAt: true,
            qualityScore: true,
            registeredBy: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({
      success: true,
      count: cadets.length,
      enrolledCount: cadets.filter((c) => !!c.biometricTemplate).length,
      cadets: cadets.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        regimentalNumber: c.regimentalNumber,
        collegeRollNumber: c.collegeRollNumber,
        platoonName: c.platoonName,
        year: c.year,
        branch: c.branch,
        isEnrolled: !!c.biometricTemplate,
        enrollmentDetails: c.biometricTemplate || null,
      })),
    });
  } catch (error) {
    console.error('getBiometricEnrollmentRoster error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve biometric roster' });
  }
};

// 13. Pre-load Eligible Biometrics for Active Attendance Session (Section 9 Requirement)
export const getEligibleBiometrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { sessionId } = req.params;
    const session = await prisma.trainingSession.findUnique({
      where: { id: String(sessionId) },
      select: {
        id: true,
        title: true,
        targetPlatoon: true,
        status: true,
        expectedCount: true,
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Attendance session not found' });
      return;
    }

    const whereClause: any = { role: 'CADET', status: { in: ['APPROVED', 'ACTIVE'] } };

    if (req.user.role === 'SENIOR') {
      const authorizedIds = await getAuthorizedCadetIds(req.user.role, req.user.id);
      if (authorizedIds !== null) {
        whereClause.id = { in: authorizedIds };
      }
    }

    const cadets = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        platoonName: true,
        biometricTemplate: {
          select: {
            descriptor: true,
            qualityScore: true,
          },
        },
      },
    });

    const eligibleCadets = cadets.map((c) => {
      let descriptor: number[] | null = null;
      if (c.biometricTemplate?.descriptor) {
        try {
          descriptor = JSON.parse(c.biometricTemplate.descriptor);
        } catch (e) {}
      }
      return {
        id: c.id,
        fullName: c.fullName,
        regimentalNumber: c.regimentalNumber,
        collegeRollNumber: c.collegeRollNumber,
        platoonName: c.platoonName,
        hasBiometrics: !!descriptor,
        descriptor,
      };
    });

    res.json({
      success: true,
      sessionId: session.id,
      targetPlatoon: session.targetPlatoon,
      totalEligible: eligibleCadets.length,
      enrolledCount: eligibleCadets.filter((c) => c.hasBiometrics).length,
      cadets: eligibleCadets,
    });
  } catch (error) {
    console.error('getEligibleBiometrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load eligible biometrics' });
  }
};

// 14. Get Notification Delivery Ledger for a Session
export const getSessionNotificationsLedger = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const ledger = await getSessionNotificationAuditLedger(String(sessionId));
    res.json({
      success: true,
      sessionId,
      count: ledger.length,
      notifications: ledger,
    });
  } catch (error) {
    console.error('getSessionNotificationsLedger error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notification audit ledger' });
  }
};

// ============================================================
// 15. Real-Time Live Counter Stats (Expected / Present / Remaining)
// Called on: initial modal open, periodic polling, page refresh recovery
// ============================================================
export const getSessionLiveStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { sessionId } = req.params;

    const session = await prisma.trainingSession.findUnique({
      where: { id: String(sessionId) },
      select: { id: true, expectedCount: true, presentCount: true, status: true },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Session not found' });
      return;
    }

    // Always re-count from attendance records — DB is the single source of truth
    const livePresent = await prisma.trainingAttendance.count({
      where: { sessionId: session.id, status: 'PRESENT' },
    });

    const liveExpected = session.expectedCount;
    const liveRemaining = Math.max(0, liveExpected - livePresent);

    // Non-blocking drift correction: sync presentCount in session row if stale
    if (session.presentCount !== livePresent) {
      prisma.trainingSession.update({
        where: { id: session.id },
        data: { presentCount: livePresent },
      }).catch(() => {});
    }

    res.json({
      success: true,
      sessionId: session.id,
      sessionStatus: session.status,
      stats: {
        expected: liveExpected,
        present: livePresent,
        remaining: liveRemaining,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('getSessionLiveStats error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve live session stats' });
  }
};
