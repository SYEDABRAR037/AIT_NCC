import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { notifyLeaveDecision } from '../services/notification.service';

// 1. Cadet submits a leave application
export const submitLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { leaveType, startDate, endDate, reason, documentUrl } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      res.status(400).json({ success: false, message: 'All mandatory fields are required' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      res.status(400).json({ success: false, message: 'End date cannot be prior to start date' });
      return;
    }

    // Create Leave with SUBMITTED status
    const leave = await prisma.leave.create({
      data: {
        cadetId: req.user.id,
        leaveType: String(leaveType),
        startDate: start,
        endDate: end,
        reason: String(reason).trim(),
        documentUrl: documentUrl ? String(documentUrl).trim() : null,
        status: 'SUBMITTED',
      },
      include: {
        cadet: {
          select: {
            fullName: true,
            regimentalNumber: true,
            collegeRollNumber: true,
            platoonName: true,
          },
        },
        leaveReviews: true,
      },
    });

    // Cross-Module Integration: Log into Activity Timeline automatically
    await prisma.timelineEvent.create({
      data: {
        cadetId: req.user.id,
        category: 'LEAVE',
        title: `Leave Application Submitted (${leave.leaveType})`,
        description: `Applied for ${leave.leaveType} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}. Reason: ${leave.reason}`,
        actorId: req.user.id,
        actorRole: req.user.role,
      },
    });

    // Cross-Module Integration: Create notification for mentor / senior
    const mentorAssigned = await prisma.seniorAssignment.findUnique({
      where: { cadetId: req.user.id },
      select: { seniorId: true },
    });

    if (mentorAssigned) {
      await prisma.notification.create({
        data: {
          userId: mentorAssigned.seniorId,
          title: 'New Leave Review Required',
          message: `Cadet ${req.user.fullName} (${req.user.regimentalNumber}) submitted a ${leave.leaveType} leave request.`,
          isUrgent: false,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully. Current stage: Senior Cadet Review.',
      leave,
    });
  } catch (error) {
    console.error('submitLeave error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit leave application' });
  }
};

// 2. Get my own leave history (for cadets)
export const getMyLeaves = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const leaves = await prisma.leave.findMany({
      where: { cadetId: req.user.id },
      include: {
        leaveReviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                fullName: true,
                role: true,
                regimentalNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: leaves.length, leaves });
  } catch (error) {
    console.error('getMyLeaves error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve leave history' });
  }
};

// 3. Cadet cancels a pending leave application
export const cancelLeave = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { leaveId } = req.params;
    const leave = await prisma.leave.findUnique({ where: { id: String(leaveId) } });

    if (!leave) {
      res.status(404).json({ success: false, message: 'Leave record not found' });
      return;
    }

    if (leave.cadetId !== req.user.id && req.user.role !== 'ADMIN_ANO') {
      res.status(403).json({ success: false, message: 'Unauthorized to cancel this leave application' });
      return;
    }

    const cancellableStatuses = ['SUBMITTED', 'SENIOR_REVIEW', 'PLATOON_SENIOR_REVIEW', 'ANO_REVIEW', 'RETURNED'];
    if (!cancellableStatuses.includes(leave.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot cancel leave in ${leave.status} state. Only pending or returned applications can be cancelled.`,
      });
      return;
    }

    const updatedLeave = await prisma.leave.update({
      where: { id: leave.id },
      data: {
        status: 'CANCELLED',
        remarks: 'Cancelled by applicant',
      },
    });

    // Record review audit
    await prisma.leaveReviewRecord.create({
      data: {
        leaveId: leave.id,
        reviewerId: req.user.id,
        reviewerRole: req.user.role,
        stage: 'APPLICANT_CANCELLATION',
        action: 'CANCEL',
        remarks: 'Application withdrawn by cadet',
      },
    });

    // Cross-Module: Timeline
    await prisma.timelineEvent.create({
      data: {
        cadetId: leave.cadetId,
        category: 'LEAVE',
        title: 'Leave Application Withdrawn',
        description: `Withdrew leave application (${leave.leaveType})`,
        actorId: req.user.id,
        actorRole: req.user.role,
      },
    });

    res.json({
      success: true,
      message: 'Leave application withdrawn successfully.',
      leave: updatedLeave,
    });
  } catch (error) {
    console.error('cancelLeave error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel leave' });
  }
};

// 4. Get leave applications for review (Senior / Platoon Senior / Admin / DI)
export const getLeavesForReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const whereClause: any = {};

    if (req.user.role === 'SENIOR') {
      // Senior sees assigned cadets' leaves; if none assigned, falls back to platoon cadets
      const assignments = await prisma.seniorAssignment.findMany({
        where: { seniorId: req.user.id },
        select: { cadetId: true },
      });
      let cadetIds = assignments.map((a) => a.cadetId);

      if (cadetIds.length === 0 && req.user.platoonName) {
        const platoonCadets = await prisma.user.findMany({
          where: { platoonName: req.user.platoonName, role: 'CADET' },
          select: { id: true },
        });
        cadetIds = platoonCadets.map((c) => c.id);
      }

      if (cadetIds.length > 0) {
        whereClause.cadetId = { in: cadetIds };
      }
    } else if (req.user.role === 'PLATOON_SENIOR') {
      // Platoon Senior sees platoon cadets' leaves
      if (req.user.platoonName) {
        const platoonCadets = await prisma.user.findMany({
          where: { platoonName: req.user.platoonName, role: 'CADET' },
          select: { id: true },
        });
        const cadetIds = platoonCadets.map((c) => c.id);
        if (cadetIds.length > 0) {
          whereClause.cadetId = { in: cadetIds };
        }
      }
    }
    // Admin, ANO, and DI see all leaves across all platoons

    const leaves = await prisma.leave.findMany({
      where: whereClause,
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
            company: true,
            role: true,
          },
        },
        leaveReviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                fullName: true,
                role: true,
                regimentalNumber: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, count: leaves.length, leaves });
  } catch (error) {
    console.error('getLeavesForReview error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve leave applications' });
  }
};

// 5. Multi-tier Process Leave Action
// Senior: FORWARD/APPROVE (to Platoon Senior) | RETURN | REJECT
// Platoon Senior: FORWARD/APPROVE (to ANO) | RETURN | REJECT
// Admin/ANO: APPROVE (final sanction) | REJECT | RETURN
export const processLeaveAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const { leaveId } = req.params;
    const { action, remarks } = req.body;

    const validActions = ['FORWARD', 'APPROVE', 'REJECT', 'RETURN', 'HOLD'];
    if (!validActions.includes(action)) {
      res.status(400).json({ success: false, message: 'Invalid leave action specified' });
      return;
    }

    const leave = await prisma.leave.findUnique({
      where: { id: String(leaveId) },
      include: {
        cadet: true,
      },
    });

    if (!leave) {
      res.status(404).json({ success: false, message: 'Leave application not found' });
      return;
    }

    let nextStatus: string = leave.status;
    let currentStage = 'SENIOR_REVIEW';

    if (req.user.role === 'SENIOR') {
      currentStage = 'SENIOR_REVIEW';
      if (action === 'FORWARD' || action === 'APPROVE') {
        nextStatus = 'PLATOON_SENIOR_REVIEW';
      } else if (action === 'RETURN') {
        nextStatus = 'RETURNED';
      } else if (action === 'REJECT') {
        nextStatus = 'REJECTED';
      } else if (action === 'HOLD') {
        nextStatus = 'SENIOR_REVIEW';
      }
    } else if (req.user.role === 'PLATOON_SENIOR') {
      currentStage = 'PLATOON_SENIOR_REVIEW';
      if (action === 'FORWARD' || action === 'APPROVE') {
        nextStatus = 'ANO_REVIEW';
      } else if (action === 'RETURN') {
        nextStatus = 'RETURNED';
      } else if (action === 'REJECT') {
        nextStatus = 'REJECTED';
      } else if (action === 'HOLD') {
        nextStatus = 'PLATOON_SENIOR_REVIEW';
      }
    } else if (req.user.role === 'ADMIN_ANO') {
      currentStage = 'ANO_FINAL_REVIEW';
      if (action === 'APPROVE' || action === 'FORWARD') {
        nextStatus = 'APPROVED';
      } else if (action === 'RETURN') {
        nextStatus = 'RETURNED';
      } else if (action === 'REJECT') {
        nextStatus = 'REJECTED';
      } else if (action === 'HOLD') {
        nextStatus = 'ANO_REVIEW';
      }
    } else {
      res.status(403).json({ success: false, message: 'Clearance denied: Role cannot process leave review.' });
      return;
    }

    // Execute atomic transaction: Update Leave + Create LeaveReviewRecord + Create TimelineEvent
    const [updatedLeave, reviewRecord] = await prisma.$transaction([
      prisma.leave.update({
        where: { id: leave.id },
        data: {
          status: nextStatus,
          remarks: remarks ? String(remarks).trim() : leave.remarks,
          finalDecisionBy: req.user.role === 'ADMIN_ANO' ? req.user.id : leave.finalDecisionBy,
        },
        include: {
          cadet: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              regimentalNumber: true,
            },
          },
          leaveReviews: {
            include: {
              reviewer: { select: { fullName: true, role: true } },
            },
          },
        },
      }),
      prisma.leaveReviewRecord.create({
        data: {
          leaveId: leave.id,
          reviewerId: req.user.id,
          reviewerRole: req.user.role,
          stage: currentStage,
          action,
          remarks: remarks ? String(remarks).trim() : null,
        },
        include: {
          reviewer: { select: { fullName: true, role: true } },
        },
      }),
      prisma.timelineEvent.create({
        data: {
          cadetId: leave.cadetId,
          category: 'LEAVE',
          title: `Leave ${action === 'FORWARD' ? 'Forwarded' : action === 'APPROVE' ? 'Approved' : action === 'RETURN' ? 'Returned' : 'Rejected'} by ${req.user.role}`,
          description: `${req.user.role} (${req.user.fullName}) marked application as ${action}. Remarks: ${remarks || 'None'}`,
          actorId: req.user.id,
          actorRole: req.user.role,
        },
      }),
    ]);

    // Asynchronous dispatch of notification
    if (updatedLeave.cadet) {
      notifyLeaveDecision(
        updatedLeave.cadet,
        leave.leaveType,
        leave.startDate,
        leave.endDate,
        nextStatus,
        req.user.fullName || 'Command Authority',
        remarks || undefined
      ).catch((err) => console.error('Notification dispatch error:', err));
    }

    res.json({
      success: true,
      message: `Leave application successfully updated to ${nextStatus}.`,
      leave: updatedLeave,
      reviewRecord,
    });
  } catch (error) {
    console.error('processLeaveAction error:', error);
    res.status(500).json({ success: false, message: 'Failed to process leave action' });
  }
};

