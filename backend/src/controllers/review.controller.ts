import { Response } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth.middleware';
import { Role, AccountStatus } from '@prisma/client';

// 1. Get Pending Cadet Registrations
export const getPendingApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const whereClause: any = {
      role: 'CADET',
      status: { in: ['UNDER_REVIEW', 'HOLD'] },
    };

    // Platoon Senior only reviews their platoon's applicants
    if (req.user.role === 'PLATOON_SENIOR') {
      whereClause.platoonName = req.user.platoonName;
    }

    const pending = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        email: true,
        phone: true,
        year: true,
        branch: true,
        platoonName: true,
        enrollmentDetails: true,
        dateOfJoining: true,
        status: true,
        createdAt: true,
        applicationReviews: {
          include: {
            reviewer: { select: { fullName: true, role: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      count: pending.length,
      reviewerRole: req.user.role,
      applications: pending,
    });
  } catch (error) {
    console.error('getPendingApplications error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve pending applications' });
  }
};

// 2. Get Application History for an Applicant
export const getApplicationDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cadetId } = req.params;

    const cadet = await prisma.user.findUnique({
      where: { id: String(cadetId) },
      select: {
        id: true,
        fullName: true,
        regimentalNumber: true,
        collegeRollNumber: true,
        email: true,
        phone: true,
        year: true,
        branch: true,
        platoonName: true,
        enrollmentDetails: true,
        dateOfJoining: true,
        status: true,
        createdAt: true,
        applicationReviews: {
          include: {
            reviewer: { select: { fullName: true, role: true, regimentalNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cadet) {
      res.status(404).json({ success: false, message: 'Cadet application record not found' });
      return;
    }

    res.json({ success: true, cadet });
  } catch (error) {
    console.error('getApplicationDetails error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve application details' });
  }
};

// 3. Process Review Action (Approve, Reject, Hold, Forward, Correction Requested)
export const processReviewAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cadetId } = req.params;
    const { action, remarks } = req.body;

    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    // Allowed reviewer roles
    if (!['ADMIN_ANO', 'PLATOON_SENIOR', 'SENIOR'].includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have authority to review cadet applications.',
      });
      return;
    }

    const cadet = await prisma.user.findUnique({
      where: { id: String(cadetId) },
    });

    if (!cadet) {
      res.status(404).json({ success: false, message: 'Cadet application not found' });
      return;
    }

    // Determine review stage based on reviewer's role
    let stage = 'SENIOR_REVIEW';
    if (req.user.role === 'PLATOON_SENIOR') {
      stage = 'PLATOON_SENIOR_REVIEW';
    } else if (req.user.role === 'ADMIN_ANO') {
      stage = 'ANO_FINAL_APPROVAL';
    }

    let newStatus: AccountStatus = cadet.status;

    if (action === 'REJECT') {
      newStatus = 'REJECTED';
    } else if (action === 'HOLD') {
      newStatus = 'HOLD';
    } else if (action === 'CORRECTION_REQUESTED') {
      newStatus = 'HOLD';
    } else if (action === 'APPROVE') {
      if (req.user.role === 'ADMIN_ANO') {
        newStatus = 'APPROVED'; // ANO final approval -> Active/Approved!
      } else {
        newStatus = 'UNDER_REVIEW'; // Forwarded to next tier
      }
    } else if (action === 'FORWARD') {
      newStatus = 'UNDER_REVIEW';
    } else {
      res.status(400).json({ success: false, message: 'Invalid review action specified' });
      return;
    }

    // Record review action in audit log and update cadet status
    const [reviewRecord, updatedCadet] = await prisma.$transaction([
      prisma.reviewRecord.create({
        data: {
          cadetId: cadet.id,
          reviewerId: req.user.id,
          stage,
          action,
          remarks: remarks ? String(remarks).trim() : null,
        },
        include: {
          reviewer: { select: { fullName: true, role: true } },
        },
      }),
      prisma.user.update({
        where: { id: cadet.id },
        data: { status: newStatus },
        select: {
          id: true,
          fullName: true,
          regimentalNumber: true,
          status: true,
          platoonName: true,
        },
      }),
    ]);

    res.json({
      success: true,
      message: `Cadet application for ${updatedCadet.fullName} marked as ${action} (${newStatus}).`,
      reviewRecord,
      cadet: updatedCadet,
    });
  } catch (error) {
    console.error('processReviewAction error:', error);
    res.status(500).json({ success: false, message: 'Failed to process application review' });
  }
};
